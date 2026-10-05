import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { artifactShellShortcutShimSource } from '../preview/shellShortcuts.js'

const SEARCH = { actionId: 'search', binding: { key: 'k', mod: true, shift: false, alt: false } }

function previewShortcuts() {
  const windowListeners = new Map()
  const documentListeners = new Map()
  const posted = []
  const parent = { postMessage(data, origin) { posted.push({ data: JSON.parse(JSON.stringify(data)), origin }) } }
  const document = {
    addEventListener(type, listener, capture) { documentListeners.set(type, { listener, capture }) },
  }
  vm.runInNewContext(artifactShellShortcutShimSource(), {
    parent,
    document,
    String,
    addEventListener(type, listener) { windowListeners.set(type, listener) },
  })
  return {
    parent,
    posted,
    keydown: documentListeners.get('keydown'),
    receive(data, source = parent) { windowListeners.get('message')({ data, source }) },
  }
}

function keyEvent(key, overrides = {}) {
  return {
    key,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    isComposing: false,
    repeat: false,
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true },
    stopImmediatePropagation() { this.stopped = true },
    ...overrides,
  }
}

test('the preview asks the app frame for its shortcuts on load', () => {
  const frame = previewShortcuts()
  assert.deepEqual(frame.posted, [{ data: { type: 'moebius:frame-shortcuts-request' }, origin: '*' }])
  assert.equal(frame.keydown.capture, true)
})

test('an advertised chord runs the shell action and never reaches the page', () => {
  const frame = previewShortcuts()
  frame.receive({ type: 'moebius:frame-shortcuts', shortcuts: [SEARCH] })
  frame.posted.length = 0

  for (const overrides of [{ metaKey: true }, { ctrlKey: true }]) {
    const event = keyEvent('K', overrides)
    frame.keydown.listener(event)
    assert.equal(event.prevented, true)
    assert.equal(event.stopped, true)
  }
  assert.deepEqual(frame.posted.map((p) => p.data), [
    { type: 'moebius:shell-shortcut', actionId: 'search' },
    { type: 'moebius:shell-shortcut', actionId: 'search' },
  ])
})

test('unadvertised keys, extra modifiers, repeats, and composition stay with the page', () => {
  const frame = previewShortcuts()
  frame.receive({ type: 'moebius:frame-shortcuts', shortcuts: [SEARCH] })
  frame.posted.length = 0

  for (const event of [
    keyEvent('k'),
    keyEvent('j', { metaKey: true }),
    keyEvent('k', { metaKey: true, shiftKey: true }),
    keyEvent('k', { metaKey: true, altKey: true }),
    keyEvent('k', { metaKey: true, repeat: true }),
    keyEvent('k', { metaKey: true, isComposing: true }),
  ]) {
    frame.keydown.listener(event)
    assert.equal(event.prevented, false)
    assert.equal(event.stopped, false)
  }
  assert.deepEqual(frame.posted, [])
})

test('AltGr never runs a Ctrl+Alt shortcut, a real Ctrl+Alt chord still does', () => {
  const frame = previewShortcuts()
  const binding = { actionId: 'chord', binding: { key: 'q', mod: true, shift: false, alt: true } }
  frame.receive({ type: 'moebius:frame-shortcuts', shortcuts: [binding] })
  frame.posted.length = 0

  const altGr = keyEvent('q', { ctrlKey: true, altKey: true, getModifierState: (m) => m === 'AltGraph' })
  frame.keydown.listener(altGr)
  assert.equal(altGr.prevented, false)
  assert.equal(altGr.stopped, false)
  assert.deepEqual(frame.posted, [])

  const chord = keyEvent('q', { ctrlKey: true, altKey: true, getModifierState: () => false })
  frame.keydown.listener(chord)
  assert.equal(chord.prevented, true)
  assert.deepEqual(frame.posted.map((p) => p.data), [{ type: 'moebius:shell-shortcut', actionId: 'chord' }])
})

test('nothing is captured before an advertisement or from a non-parent sender', () => {
  const frame = previewShortcuts()
  frame.posted.length = 0
  const before = keyEvent('k', { metaKey: true })
  frame.keydown.listener(before)

  frame.receive({ type: 'moebius:frame-shortcuts', shortcuts: [SEARCH] }, { postMessage() {} })
  const forged = keyEvent('k', { metaKey: true })
  frame.keydown.listener(forged)

  assert.equal(before.prevented, false)
  assert.equal(forged.prevented, false)
  assert.deepEqual(frame.posted, [])
})

test('interactive previews inject the shell shortcut shim', async () => {
  const source = await readFile(new URL('../preview/ArtifactFrame.jsx', import.meta.url), 'utf8')
  assert.match(source, /injectArtifactShellShortcutShim\(/)
})
