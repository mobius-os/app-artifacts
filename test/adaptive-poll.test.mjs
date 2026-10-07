import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { startAdaptivePoll } from '../ui/adaptivePoll.js'

async function advance(ms) {
  mock.timers.tick(ms)
  // Let the awaited tick and its rescheduling settle.
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
}

test('an idle view backs off to the slow cadence and a change restores the fast one', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const results = []
    let changed = false
    const poll = startAdaptivePoll(async () => {
      results.push(changed)
      return changed
    }, { minMs: 1000, maxMs: 4000 })

    await advance(1000) // first tick, unchanged -> next in 2000
    await advance(1999)
    assert.equal(results.length, 1)
    await advance(1) // second tick -> next in 4000 (capped)
    assert.equal(results.length, 2)
    await advance(4000)
    assert.equal(results.length, 3)
    await advance(4000)
    assert.equal(results.length, 4, 'the cadence never exceeds maxMs')

    changed = true
    await advance(4000) // a change resets to minMs
    await advance(1000)
    assert.equal(results.length, 6)
    poll.stop()
    await advance(10000)
    assert.equal(results.length, 6, 'a stopped poll never ticks again')
  } finally {
    mock.timers.reset()
  }
})

test('poke returns an idle poll to the fast cadence', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    let ticks = 0
    const poll = startAdaptivePoll(async () => { ticks += 1; return false }, { minMs: 1000, maxMs: 8000 })
    await advance(1000)
    await advance(2000)
    assert.equal(ticks, 2) // now waiting 4000
    poll.poke()
    await advance(1000)
    assert.equal(ticks, 3)
    poll.stop()
  } finally {
    mock.timers.reset()
  }
})

test('frame visibility follows the Möbius frame signal when the host provides it', async () => {
  const { watchFrameVisibility } = await import('../ui/adaptivePoll.js')
  let emit = null
  let unsubscribed = false
  const mobius = {
    visible: true,
    runtimeFeatures: { frameVisibility: true },
    onVisibilityChange(cb) {
      emit = cb
      cb(true)
      return () => { unsubscribed = true }
    },
  }
  // The document stays visible while the shell hides the frame.
  const doc = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }
  const changes = []
  const watch = watchFrameVisibility((visible) => changes.push(visible), { mobius, doc })
  assert.equal(watch.isVisible(), true)
  emit(false)
  assert.equal(watch.isVisible(), false)
  emit(true)
  assert.deepEqual(changes, [false, true], 'the initial report is not a change')
  watch.stop()
  assert.equal(unsubscribed, true)
})

test('frame visibility falls back to the document on older hosts', async () => {
  const { watchFrameVisibility } = await import('../ui/adaptivePoll.js')
  let listener = null
  const doc = {
    visibilityState: 'visible',
    addEventListener(_name, cb) { listener = cb },
    removeEventListener() { listener = null },
  }
  const changes = []
  const watch = watchFrameVisibility((visible) => changes.push(visible), { mobius: {}, doc })
  doc.visibilityState = 'hidden'
  listener()
  assert.equal(watch.isVisible(), false)
  assert.deepEqual(changes, [false])
  watch.stop()
  assert.equal(listener, null)
})

test('an idle view never waits longer than about ten seconds', async () => {
  const { POLL_MAX_MS } = await import('../ui/adaptivePoll.js')
  assert.ok(POLL_MAX_MS <= 10000)
})
