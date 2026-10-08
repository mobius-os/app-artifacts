import assert from 'node:assert/strict'
import test from 'node:test'
import { CONTENT_LIST_THRESHOLD, readFolder } from '../ui/catalogSnapshot.js'

// Enough new records to take the content-bearing listing path, with one record
// too large to carry its content inline.
function bulkStorage({ failFirstRead }) {
  const count = CONTENT_LIST_THRESHOLD + 2
  const entries = Array.from({ length: count }, (_, i) => ({
    path: `artifacts/p${i}.json`,
    modified_at: '2026-10-07T10:00:00Z',
    size: 10 + i,
  }))
  let reads = 0
  return {
    reads: () => reads,
    async list(_prefix, options) {
      if (!options?.includeContent) return entries.map((entry) => ({ ...entry }))
      return entries.map((entry, i) => (
        i === 0 ? { ...entry } : { ...entry, content: JSON.stringify({ id: `p${i}` }) }
      ))
    },
    async getFresh(path) {
      reads += 1
      if (failFirstRead && reads === 1) throw new Error('transient read failure')
      return { id: path.slice('artifacts/'.length, -'.json'.length) }
    },
  }
}

test('a failed bulk read is retried on the next poll instead of cached as missing', async () => {
  const storage = bulkStorage({ failFirstRead: true })
  const first = await readFolder(storage, 'artifacts/')
  assert.equal(first.some((record) => record.id === 'p0'), false)
  assert.equal(first.length, CONTENT_LIST_THRESHOLD + 1)

  // Same listing stamps: only the record that failed is read again.
  const second = await readFolder(storage, 'artifacts/')
  assert.equal(second.some((record) => record.id === 'p0'), true)
  assert.equal(second.length, CONTENT_LIST_THRESHOLD + 2)
  assert.equal(storage.reads(), 2)
})

test('an unchanged folder is not re-read after a successful bulk read', async () => {
  const storage = bulkStorage({ failFirstRead: false })
  await readFolder(storage, 'artifacts/')
  const again = await readFolder(storage, 'artifacts/')
  assert.equal(again.length, CONTENT_LIST_THRESHOLD + 2)
  assert.equal(storage.reads(), 1)
})

// A runtime-backed folder: listings carry server stamps, content listings carry
// the runtime's effective bodies (cached, with queued local writes on top), and
// getFresh reaches the server only while online.
function runtimeFolder(prefix, records) {
  const server = new Map(records.map((record) => [`${prefix}${record.id}.json`, record]))
  const queued = new Map()
  let online = true
  let freshReads = 0
  const effective = (path) => queued.get(path) ?? server.get(path)
  return {
    goOffline() { online = false },
    queueLocal(record) { queued.set(`${prefix}${record.id}.json`, record) },
    freshReads: () => freshReads,
    async list(_prefix, options = {}) {
      return [...new Set([...server.keys(), ...queued.keys()])].map((path) => ({
        path,
        ...(server.has(path) ? { modified_at: '2026-10-07T10:00:00Z', size: 10 } : {}),
        ...(options.includeContent ? { content: JSON.stringify(effective(path)) } : {}),
      }))
    },
    async get(path) {
      return effective(path) ?? null
    },
    async getFresh(path) {
      freshReads += 1
      if (!online) throw new Error('Offline')
      return server.get(path) ?? null
    },
  }
}

test('opening the gallery offline shows the runtime-cached catalog', async () => {
  const storage = runtimeFolder('artifacts/', [{ id: 'p0' }, { id: 'p1' }])
  storage.goOffline()
  const records = await readFolder(storage, 'artifacts/')
  assert.deepEqual(records.map((record) => record.id), ['p0', 'p1'])
})

test('a record that cannot be re-read offline keeps its cached body', async () => {
  const storage = runtimeFolder('artifacts/', [{ id: 'p0' }])
  await readFolder(storage, 'artifacts/')
  storage.goOffline()
  // A missing stamp marks the record changed, forcing a read that now fails.
  const list = storage.list
  storage.list = async (...args) => (await list(...args)).map(({ modified_at, size, ...entry }) => entry)
  const records = await readFolder(storage, 'artifacts/')
  assert.deepEqual(records.map((record) => record.id), ['p0'])
})

test('a queued publish or stop is not replaced by the unchanged server value', async () => {
  const storage = runtimeFolder('shares/', [{ id: 'p0', project_id: 'p0', published: false }])
  const first = await readFolder(storage, 'shares/', { withContent: true })
  assert.equal(first[0].published, false)

  storage.queueLocal({ id: 'p0', project_id: 'p0', published: true })
  const queued = await readFolder(storage, 'shares/', { withContent: true })
  assert.equal(queued[0].published, true)
  const again = await readFolder(storage, 'shares/', { withContent: true })
  assert.equal(again[0].published, true, 'the next poll must not flip back')
  assert.equal(storage.freshReads(), 0, 'content listings need no per-record reads')
})

test('after the first content read, unchanged polls only list metadata', async () => {
  const storage = runtimeFolder('artifacts/', [{ id: 'p0' }, { id: 'p1' }])
  const listings = []
  const list = storage.list
  storage.list = (prefix, options = {}) => {
    listings.push(Boolean(options.includeContent))
    return list(prefix, options)
  }
  await readFolder(storage, 'artifacts/')
  await readFolder(storage, 'artifacts/')
  await readFolder(storage, 'artifacts/')
  assert.deepEqual(listings, [true, false, false])
  assert.equal(storage.freshReads(), 0)
})
