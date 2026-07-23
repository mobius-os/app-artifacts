import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createSharePollGate,
  MISSING_SHARE_RECHECK_MS,
} from '../ui/sharePolling.js'

test('a confirmed missing share is not re-read on every detail poll', () => {
  const gate = createSharePollGate()
  gate.observe(null, 1_000)

  assert.equal(gate.isMissing(), true)
  assert.equal(gate.shouldRead(1_000 + MISSING_SHARE_RECHECK_MS - 1), false)
  assert.equal(gate.shouldRead(1_000 + MISSING_SHARE_RECHECK_MS), true)
})

test('focus and visibility recovery can force a missing-share recheck', () => {
  const gate = createSharePollGate()
  gate.observe(null, 1_000)

  assert.equal(gate.shouldRead(2_000, { force: true }), true)
})

test('present shares keep the normal live polling cadence', () => {
  const gate = createSharePollGate()
  gate.observe(null, 1_000)
  gate.observe({ published: true }, 2_000)

  assert.equal(gate.isMissing(), false)
  assert.equal(gate.shouldRead(2_001), true)
})

test('a failed due read remains due until an observation advances the gate', () => {
  const gate = createSharePollGate({ missingRecheckMs: 10 })
  gate.observe(null, 100)

  assert.equal(gate.shouldRead(110), true)
  assert.equal(gate.shouldRead(111), true)
  gate.observe(null, 111)
  assert.equal(gate.shouldRead(120), false)
  assert.equal(gate.shouldRead(121), true)
})
