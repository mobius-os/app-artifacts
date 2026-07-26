import assert from 'node:assert/strict'
import test from 'node:test'

import { reuseRecordList, reuseRecordMap } from '../ui/catalogSnapshot.js'

test('unchanged gallery records preserve their existing references', () => {
  const current = [{ id: 'one', title: 'One', current_version: 2 }]
  const next = [{ id: 'one', title: 'One', current_version: 2 }]

  assert.equal(reuseRecordList(current, next), current)
})

test('changed gallery records publish the fresh snapshot', () => {
  const current = [{ id: 'one', current_version: 1 }]
  const next = [{ id: 'one', current_version: 2 }]

  assert.equal(reuseRecordList(current, next), next)
})

test('unchanged share records preserve their existing map', () => {
  const current = new Map([['one', { project_id: 'one', published: true }]])
  const next = new Map([['one', { project_id: 'one', published: true }]])

  assert.equal(reuseRecordMap(current, next), current)
})

test('changed share records publish the fresh map', () => {
  const current = new Map([['one', { project_id: 'one', published: false }]])
  const next = new Map([['one', { project_id: 'one', published: true }]])

  assert.equal(reuseRecordMap(current, next), next)
})
