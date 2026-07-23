import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createDetailSync,
  MISSING_HINT_RECHECK_MS,
} from '../ui/detailSync.js'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

async function flush() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function harness({ now = () => 0 } = {}) {
  const fresh = []
  const text = []
  const subscriptions = new Map()
  const records = []
  const shares = []
  const recovered = []
  const recordErrors = []
  const storage = {
    getFresh(path) {
      const call = { path, ...deferred() }
      fresh.push(call)
      return call.promise
    },
    getText(path) {
      const call = { path, ...deferred() }
      text.push(call)
      return call.promise
    },
    subscribe(path, callback) {
      subscriptions.set(path, callback)
      return () => subscriptions.delete(path)
    },
  }
  const sync = createDetailSync({
    artifactId: 'deck-01',
    storage,
    now,
    onRecord: (value) => records.push(value),
    onRecordError: (error) => recordErrors.push(error),
    onShare: (value) => shares.push(value),
    onRecoveredShare: (value) => recovered.push(value),
  })
  return {
    sync,
    fresh,
    text,
    subscriptions,
    records,
    shares,
    recovered,
    recordErrors,
    recordCalls: () => fresh.filter(({ path }) => path.startsWith('artifacts/')),
    shareCalls: () => fresh.filter(({ path }) => path.startsWith('shares/')),
  }
}

test('stale detail reads cannot overwrite subscription or local state', async () => {
  const state = harness()
  state.sync.start()
  const staleRecord = state.recordCalls()[0]
  const staleShare = state.shareCalls()[0]

  const recordSubscription = state.subscriptions.get('artifacts/deck-01.json')
  const shareSubscription = state.subscriptions.get('shares/deck-01.json')
  recordSubscription({ id: 'deck-01', current_version: 0 })
  shareSubscription({ project_id: 'deck-01', published: false })
  const subscribedRecord = { id: 'deck-01', current_version: 2 }
  const subscribed = { project_id: 'deck-01', published: true, shared_version: 2 }
  recordSubscription(subscribedRecord)
  shareSubscription(subscribed)
  staleRecord.resolve({ id: 'deck-01', current_version: 1 })
  staleShare.resolve(null)
  await flush()
  assert.equal(state.records.length, 2)
  assert.deepEqual(state.records.at(-1), subscribedRecord)
  assert.equal(state.shares.length, 2)
  assert.deepEqual(state.shares.at(-1), subscribed)

  void state.sync.refresh({ forceShare: true })
  const secondShareRead = state.shareCalls()[1]
  const local = { project_id: 'deck-01', published: false, stopped_at: 'now' }
  state.sync.acceptLocalShare(local)
  secondShareRead.resolve({ project_id: 'deck-01', published: true, shared_version: 1 })
  await flush()
  assert.equal(state.shares.length, 3)
  assert.deepEqual(state.shares.at(-1), local)
  state.sync.dispose()
})

test('cache-first subscription values before getFresh remain provisional', async () => {
  const state = harness()
  state.sync.start()
  const cachedRecord = { id: 'deck-01', current_version: 1 }
  const cachedShare = { project_id: 'deck-01', published: false }
  state.subscriptions.get('artifacts/deck-01.json')(cachedRecord)
  state.subscriptions.get('shares/deck-01.json')(cachedShare)
  assert.deepEqual(state.records, [cachedRecord])
  assert.deepEqual(state.shares, [cachedShare])

  const freshRecord = { id: 'deck-01', current_version: 2 }
  const freshShare = { project_id: 'deck-01', published: true, shared_version: 2 }
  state.recordCalls()[0].resolve(freshRecord)
  state.shareCalls()[0].resolve(freshShare)
  await flush()
  assert.deepEqual(state.records, [cachedRecord, freshRecord])
  assert.deepEqual(state.shares, [cachedShare, freshShare])
  state.sync.dispose()
})

test('late first cache subscription values cannot overwrite getFresh', async () => {
  const state = harness()
  state.sync.start()
  const freshRecord = { id: 'deck-01', current_version: 2 }
  const freshShare = { project_id: 'deck-01', published: true, shared_version: 2 }
  state.recordCalls()[0].resolve(freshRecord)
  state.shareCalls()[0].resolve(freshShare)
  await flush()

  state.subscriptions.get('artifacts/deck-01.json')({
    id: 'deck-01',
    current_version: 1,
  })
  state.subscriptions.get('shares/deck-01.json')({
    project_id: 'deck-01',
    published: false,
  })
  assert.deepEqual(state.records, [freshRecord])
  assert.deepEqual(state.shares, [freshShare])
  state.sync.dispose()
})

test('a forced share read is independent and trails an in-flight share read', async () => {
  const state = harness()
  state.sync.start()
  state.recordCalls()[0].resolve({ id: 'deck-01' })
  state.shareCalls()[0].resolve(null)
  await flush()
  state.text[0].resolve(null)
  await flush()

  // The normal refresh skips the known-missing share and leaves only its
  // record request in flight.
  void state.sync.refresh()
  assert.equal(state.shareCalls().length, 1)

  // Focus/visibility force is not coupled to that record request.
  void state.sync.refresh({ forceShare: true })
  assert.equal(state.shareCalls().length, 2)

  // A second force while the share request itself is in flight is retained.
  void state.sync.refresh({ forceShare: true })
  state.shareCalls()[1].resolve(null)
  await flush()
  assert.equal(state.shareCalls().length, 3)
  state.sync.dispose()
})

test('a record failure does not discard a successful share result', async () => {
  const state = harness()
  state.sync.start()
  state.recordCalls()[0].resolve({ id: 'deck-01', current_version: 1 })
  state.shareCalls()[0].resolve({ project_id: 'deck-01', published: false })
  await flush()

  const refresh = state.sync.refresh({ forceShare: true })
  const nextRecord = state.recordCalls()[1]
  const nextShare = state.shareCalls()[1]
  const remote = { project_id: 'deck-01', published: true, shared_version: 3 }
  nextRecord.reject(new Error('record offline'))
  nextShare.resolve(remote)
  await refresh
  assert.deepEqual(state.shares.at(-1), remote)
  state.sync.dispose()
})

test('an absent hint is retried and can recover a token created later', async () => {
  let clock = 0
  const state = harness({ now: () => clock })
  state.sync.start()
  state.recordCalls()[0].resolve({ id: 'deck-01' })
  state.shareCalls()[0].resolve(null)
  await flush()
  state.text[0].resolve(null)
  await flush()
  assert.equal(state.recovered.length, 0)

  clock = MISSING_HINT_RECHECK_MS - 1
  void state.sync.refresh()
  assert.equal(state.text.length, 1)

  clock = MISSING_HINT_RECHECK_MS
  void state.sync.refresh()
  assert.equal(state.text.length, 2)
  state.text[1].resolve('a'.repeat(32))
  await flush()
  assert.equal(state.recovered.length, 1)
  assert.equal(state.recovered[0].url, `/sites/${'a'.repeat(32)}/`)
  state.sync.dispose()
})

test('an invalid hint remains eligible for a bounded later retry', async () => {
  let clock = 0
  const state = harness({ now: () => clock })
  state.sync.start()
  state.recordCalls()[0].resolve({ id: 'deck-01' })
  state.shareCalls()[0].resolve(null)
  await flush()
  state.text[0].resolve('../not-a-token')
  await flush()
  assert.equal(state.recovered.length, 0)

  clock = MISSING_HINT_RECHECK_MS
  void state.sync.refresh()
  state.text[1].resolve('b'.repeat(32))
  await flush()
  assert.equal(state.recovered[0].url, `/sites/${'b'.repeat(32)}/`)
  state.sync.dispose()
})
