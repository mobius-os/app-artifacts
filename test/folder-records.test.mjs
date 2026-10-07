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
