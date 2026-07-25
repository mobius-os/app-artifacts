import test from 'node:test'
import assert from 'node:assert/strict'
import { copyPlainText } from '../ui/clipboard.js'

test('copyPlainText prefers the async clipboard API', async () => {
  const writes = []
  const copied = await copyPlainText('public link', {
    navigatorRef: { clipboard: { writeText: async (value) => writes.push(value) } },
    documentRef: null,
  })

  assert.equal(copied, true)
  assert.deepEqual(writes, ['public link'])
})

test('copyPlainText falls back to a temporary selection when clipboard access is rejected', async () => {
  const events = []
  const textarea = {
    style: {},
    value: '',
    setAttribute(name, value) { events.push(['attribute', name, value]) },
    focus(options) { events.push(['focus', options]) },
    select() { events.push(['select']) },
    setSelectionRange(start, end) { events.push(['range', start, end]) },
    remove() { events.push(['remove']) },
  }
  const previousFocus = {
    focus(options) { events.push(['restore-focus', options]) },
  }
  const documentRef = {
    activeElement: previousFocus,
    body: {
      appendChild(node) {
        assert.equal(node, textarea)
        events.push(['append'])
      },
    },
    createElement(tag) {
      assert.equal(tag, 'textarea')
      return textarea
    },
    execCommand(command) {
      assert.equal(command, 'copy')
      events.push(['copy'])
      return true
    },
  }

  const copied = await copyPlainText('artifact source', {
    navigatorRef: {
      clipboard: {
        async writeText() { throw new Error('not allowed') },
      },
    },
    documentRef,
  })

  assert.equal(copied, true)
  assert.equal(textarea.value, 'artifact source')
  assert.ok(events.some(([name]) => name === 'copy'))
  assert.ok(events.some(([name]) => name === 'remove'))
  assert.ok(events.some(([name]) => name === 'restore-focus'))
})

test('copyPlainText reports failure and cleans up when both copy paths fail', async () => {
  let removed = false
  const textarea = {
    style: {},
    value: '',
    setAttribute() {},
    focus() {},
    select() {},
    setSelectionRange() {},
    remove() { removed = true },
  }
  const copied = await copyPlainText('artifact source', {
    navigatorRef: {},
    documentRef: {
      activeElement: null,
      body: { appendChild() {} },
      createElement: () => textarea,
      execCommand() { throw new Error('copy denied') },
    },
  })

  assert.equal(copied, false)
  assert.equal(removed, true)
})
