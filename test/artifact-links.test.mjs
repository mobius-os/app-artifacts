import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { artifactPreviewLinkShimSource } from '../preview/artifactLinks.js'

function previewLinks({ destinations = {} } = {}) {
  const listeners = new Map()
  const scrolls = []
  const document = {
    addEventListener(type, listener) { listeners.set(type, listener) },
    getElementById(id) { return destinations[id] ?? null },
  }
  const window = {
    document,
    scrollTo(...args) { scrolls.push(args) },
  }
  vm.runInNewContext(artifactPreviewLinkShimSource(), {
    window,
    String,
    Array,
    decodeURIComponent,
  })
  return { click: listeners.get('click'), scrolls }
}

function anchor(attributes = {}) {
  const values = new Map(Object.entries(attributes))
  return {
    closest(selector) { return selector === 'a[href]' ? this : null },
    getAttribute(name) { return values.has(name) ? values.get(name) : null },
    hasAttribute(name) { return values.has(name) },
    setAttribute(name, value) { values.set(name, value) },
  }
}

function clickEvent(target, overrides = {}) {
  return {
    target,
    button: 0,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    prevented: false,
    preventDefault() { this.prevented = true },
    ...overrides,
  }
}

test('fragment links scroll inside the artifact without navigating its frame', () => {
  let scrolled = 0
  const links = previewLinks({
    destinations: { remaining: { scrollIntoView() { scrolled += 1 } } },
  })
  const event = clickEvent(anchor({ href: '#remaining' }))

  links.click(event)

  assert.equal(event.prevented, true)
  assert.equal(scrolled, 1)
  assert.deepEqual(links.scrolls, [])
})

test('empty and missing fragments never escape the srcDoc preview', () => {
  const links = previewLinks()
  const top = clickEvent(anchor({ href: '' }))
  const missing = clickEvent(anchor({ href: '#missing' }))

  links.click(top)
  links.click(missing)

  assert.equal(top.prevented, true)
  assert.equal(missing.prevented, true)
  assert.deepEqual(links.scrolls, [[0, 0]])
})

test('ordinary links open outside the preview and keep existing rel tokens', () => {
  const links = previewLinks()
  const target = anchor({ href: 'https://example.com/report', rel: 'external' })
  const event = clickEvent(target)

  links.click(event)

  assert.equal(event.prevented, false)
  assert.equal(target.getAttribute('target'), '_blank')
  assert.equal(target.getAttribute('rel'), 'external noopener noreferrer')
})

test('modified clicks, downloads, and script links keep authored behavior', () => {
  const links = previewLinks()
  for (const [target, overrides] of [
    [anchor({ href: 'https://example.com' }), { metaKey: true }],
    [anchor({ href: '/export', download: '' }), {}],
    [anchor({ href: 'javascript:void(0)' }), {}],
  ]) {
    const event = clickEvent(target, overrides)
    links.click(event)
    assert.equal(event.prevented, false)
    assert.equal(target.getAttribute('target'), null)
  }
})
