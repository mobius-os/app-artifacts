import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { artifactStorageShimSource } from '../domain.js'

function bootShim(options, { pathname = '/', fetch } = {}) {
  const listeners = []
  const posted = []
  const parent = {
    postMessage(message, targetOrigin) {
      posted.push({ message, targetOrigin })
    },
  }
  let random = 0
  const window = {
    parent,
    location: { pathname },
    fetch,
    crypto: {
      getRandomValues(values) {
        for (let index = 0; index < values.length; index += 1) values[index] = ++random
        return values
      },
    },
    addEventListener(type, listener) {
      if (type === 'message') listeners.push(listener)
    },
    setTimeout,
    clearTimeout,
  }
  vm.runInNewContext(artifactStorageShimSource(options), {
    window,
    TextEncoder,
    Uint32Array,
    Map,
    Set,
    Promise,
    Error,
    Object,
    Array,
    Number,
    Math,
    JSON,
    encodeURIComponent,
  })
  return { listeners, parent, posted, storage: window.mobiusArtifact.storage, window }
}

test('preview shim uses the parent bridge and accepts only source-and-nonce-matched replies', async () => {
  const shim = bootShim({ variant: 'preview', writable: true })
  assert.equal(shim.storage.mode, 'editor')
  assert.equal(shim.storage.writable, true)

  await assert.rejects(shim.storage.get('../other'), (error) => error.code === 'invalid-key')
  assert.equal(shim.posted.length, 0)

  const result = shim.storage.get('score')
  assert.equal(shim.posted.length, 1)
  const request = shim.posted[0].message
  assert.equal(shim.posted[0].targetOrigin, '*')
  assert.equal(request.op, 'get')
  assert.equal(request.key, 'score')

  shim.listeners[0]({
    source: {},
    data: {
      type: 'moebius:artifact-storage-result',
      requestId: request.requestId,
      nonce: request.nonce,
      ok: true,
      value: 98,
    },
  })
  shim.listeners[0]({
    source: shim.parent,
    data: {
      type: 'moebius:artifact-storage-result',
      requestId: request.requestId,
      nonce: 'wrong-nonce',
      ok: true,
      value: 99,
    },
  })
  shim.listeners[0]({
    source: shim.parent,
    data: {
      type: 'moebius:artifact-storage-result',
      requestId: request.requestId,
      nonce: request.nonce,
      ok: true,
      value: 100,
    },
  })
  assert.equal(await result, 100)

  shim.listeners[0]({
    source: shim.parent,
    data: {
      type: 'moebius:artifact-storage-result',
      requestId: request.requestId,
      nonce: request.nonce,
      ok: true,
      value: 101,
    },
  })
})

test('historical preview shim rejects writes without sending a request', async () => {
  const shim = bootShim({ variant: 'preview', writable: false })
  assert.equal(shim.storage.mode, 'editor')
  assert.equal(shim.storage.writable, false)
  await assert.rejects(shim.storage.set('score', 2), (error) => error.name === 'ReadOnlyError')
  await assert.rejects(shim.storage.remove('score'), (error) => error.name === 'ReadOnlyError')
  assert.equal(shim.posted.length, 0)
})

test('preview shim bounds concurrent bridge requests', async () => {
  const shim = bootShim({ variant: 'preview', writable: true })
  const pending = Array.from({ length: 32 }, (_, index) => shim.storage.get(`key-${index}`))
  await assert.rejects(
    shim.storage.get('overflow'),
    (error) => error.code === 'too-many-requests',
  )
  assert.equal(shim.posted.length, 32)
  for (const { message } of shim.posted) {
    shim.listeners[0]({
      source: shim.parent,
      data: {
        type: 'moebius:artifact-storage-result',
        requestId: message.requestId,
        nonce: message.nonce,
        ok: true,
        value: message.key,
      },
    })
  }
  assert.deepEqual([...await Promise.all(pending)], Array.from({ length: 32 }, (_, index) => `key-${index}`))
})

test('published shim derives its token from the path and is stably read-only', async () => {
  const token = '0123456789abcdef0123456789abcdef'
  const requests = []
  const shim = bootShim(
    { variant: 'published' },
    {
      pathname: `/sites/${token}/index.html`,
      fetch: async (url, options) => {
        requests.push({ url, options })
        if (url.endsWith('/__mobius_keys')) {
          return {
            ok: true,
            status: 200,
            json: async () => ['zeta', '../escape', 'alpha', 'alpha'],
          }
        }
        return { ok: true, status: 200, json: async () => ({ count: 3 }) }
      },
    },
  )
  assert.equal(shim.storage.mode, 'public-readonly')
  assert.equal(shim.storage.writable, false)
  assert.deepEqual(await shim.storage.get('dashboard'), { count: 3 })
  assert.deepEqual([...await shim.storage.list()], ['alpha', 'zeta'])
  assert.equal(requests[0].url, `/api/published-sites/${token}/data/dashboard`)
  assert.equal(requests[0].options.cache, 'no-store')
  assert.equal(requests[0].options.credentials, 'omit')

  const requestCount = requests.length
  await assert.rejects(shim.storage.set('dashboard', {}), (error) => (
    error.name === 'ReadOnlyError' && error.code === 'read-only'
  ))
  await assert.rejects(shim.storage.remove('dashboard'), (error) => error.name === 'ReadOnlyError')
  assert.equal(requests.length, requestCount)
})
