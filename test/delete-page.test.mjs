import test from 'node:test'
import assert from 'node:assert/strict'
import { makeStorage } from '../storage.js'
import { removePageStorage } from '../ui/deletePage.js'

const recordPath = 'artifacts/p1.json'
const cleanupPaths = [
  'folder/versions/p1',
  'folder/projects/p1',
  'folder/artifact-data/p1',
  'shares/p1.json',
]

function harness(t, { removal = 'accepted', missing = false, confirmation = 'ok', failCleanup } = {}) {
  const calls = []
  let serverRecord = missing ? null : { id: 'p1' }
  let cachedRecord = serverRecord
  const content = new Set(cleanupPaths)
  const runtime = {
    async get() { return cachedRecord },
    async remove(path) {
      calls.push(`remove ${path}`)
      if (path !== recordPath) {
        if (path === failCleanup) throw new Error('cleanup failed')
        content.delete(path)
        return { synced: true }
      }
      if (removal === 'throws') throw new Error('record removal failed')
      // The runtime optimistically tombstones the cache. Queued deletes keep
      // the server record; a fatal refusal is dead-lettered and can still
      // resolve with the legacy { synced: true } result.
      cachedRecord = null
      if (removal === 'queued') return { queued: true }
      if (removal === 'accepted') serverRecord = null
      return { synced: true }
    },
  }
  const previousWindow = globalThis.window
  globalThis.window = { mobius: { storage: runtime } }
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  })
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const prefix = '/api/storage/apps/1/'
    assert.ok(url.startsWith(prefix), `unexpected request: ${url}`)
    const path = url.slice(prefix.length)
    const method = options.method || 'GET'
    calls.push(`${method} ${path}`)
    if (method === 'GET' && path === recordPath) {
      if (confirmation === 'offline') throw new TypeError('network unavailable')
      if (confirmation === 'forbidden') return new Response('', { status: 403 })
      return serverRecord === null
        ? new Response('', { status: 404 })
        : Response.json(serverRecord)
    }
    assert.equal(method, 'DELETE')
    assert.ok(cleanupPaths.includes(path), 'record removal must use the runtime, not a direct DELETE')
    if (path === failCleanup) return new Response('', { status: 500 })
    content.delete(path)
    return new Response(null, { status: 204 })
  })
  return {
    calls,
    content,
    storage: makeStorage(1, 'test-token'),
    serverRecord: () => serverRecord,
  }
}

function assertContentKept(h) {
  assert.deepEqual([...h.content], cleanupPaths)
  assert.ok(!h.calls.some((call) => call.startsWith('DELETE ')))
  assert.ok(!h.calls.includes('remove shares/p1.json'))
}

for (const missing of [false, true]) {
  test(`${missing ? 'an already-missing' : 'a removed'} record is confirmed absent before all four cleanup attempts`, async (t) => {
    const h = harness(t, { missing })
    await removePageStorage(h.storage, 'p1')
    assert.deepEqual(h.calls, [
      `remove ${recordPath}`,
      `GET ${recordPath}`,
      'DELETE folder/versions/p1',
      'DELETE folder/projects/p1',
      'DELETE folder/artifact-data/p1',
      'remove shares/p1.json',
    ])
    assert.equal(h.serverRecord(), null)
    assert.equal(h.content.size, 0)
  })
}

test('a thrown record removal leaves every content target intact', async (t) => {
  const h = harness(t, { removal: 'throws' })
  await assert.rejects(removePageStorage(h.storage, 'p1'), /record removal failed/)
  assert.deepEqual(h.calls, [`remove ${recordPath}`])
  assertContentKept(h)
})

for (const missing of [false, true]) {
  test(`a queued removal never starts cleanup${missing ? ', even if the server record was already missing' : ''}`, async (t) => {
    const h = harness(t, { removal: 'queued', missing })
    await assert.rejects(removePageStorage(h.storage, 'p1'), /pending/)
    assert.deepEqual(h.calls, [`remove ${recordPath}`])
    assertContentKept(h)
  })
}

test('a refused-but-synced removal cannot use an optimistic cache miss as confirmation', async (t) => {
  const h = harness(t, { removal: 'refused' })
  await assert.rejects(removePageStorage(h.storage, 'p1'), /could not be confirmed/)
  assert.equal(await h.storage.get(recordPath), null)
  assert.deepEqual(h.serverRecord(), { id: 'p1' })
  assert.deepEqual(h.calls, [`remove ${recordPath}`, `GET ${recordPath}`])
  assertContentKept(h)
})

for (const confirmation of ['offline', 'forbidden']) {
  test(`confirmation read failure (${confirmation}) preserves content after record removal`, async (t) => {
    const h = harness(t, { confirmation })
    await assert.rejects(removePageStorage(h.storage, 'p1'), /network unavailable|Could not read/)
    assert.equal(h.serverRecord(), null)
    assert.deepEqual(h.calls, [`remove ${recordPath}`, `GET ${recordPath}`])
    assertContentKept(h)
  })
}

for (const failCleanup of cleanupPaths) {
  test(`failure cleaning ${failCleanup} cannot block the other cleanup targets or fail deletion`, async (t) => {
    const h = harness(t, { failCleanup })
    await removePageStorage(h.storage, 'p1')
    assert.equal(h.serverRecord(), null)
    assert.deepEqual([...h.content], [failCleanup])
    assert.equal(h.calls.length, 6)
  })
}
