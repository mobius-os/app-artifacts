import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ARTIFACT_STORAGE_INDEX_KEY,
  ARTIFACT_STORAGE_MAX_PENDING,
  artifactIntent,
  isValidArtifactStorageKey,
  planArtifactStorageRequest,
} from './domain.js'
import { makeStorage } from './storage.js'
import { CSS } from './theme.js'
import { Gallery } from './ui/Gallery.jsx'
import { Detail } from './ui/Detail.jsx'

// The durable list index consumes one of the server's 100 capped key slots.
const MAX_USER_STORAGE_KEYS = 99

function storageKeys(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter(isValidArtifactStorageKey))].sort()
}

async function readStorageKeys(storage, artifactId) {
  return storageKeys(await storage.artifactDataGet(artifactId, ARTIFACT_STORAGE_INDEX_KEY))
}

async function executeArtifactStoragePlan(storage, plan) {
  if (plan.op === 'get') return storage.artifactDataGet(plan.artifactId, plan.key)
  if (plan.op === 'list') return readStorageKeys(storage, plan.artifactId)
  if (plan.op === 'set') {
    const keys = await readStorageKeys(storage, plan.artifactId)
    if (keys.includes(plan.key)) {
      await storage.artifactDataSet(plan.artifactId, plan.key, plan.value)
      return undefined
    }
    if (keys.length >= MAX_USER_STORAGE_KEYS) {
      const error = new Error('key-limit')
      error.bridgeError = 'key-limit'
      throw error
    }
    await storage.artifactDataSet(plan.artifactId, plan.key, plan.value)
    try {
      await storage.artifactDataSet(
        plan.artifactId,
        ARTIFACT_STORAGE_INDEX_KEY,
        [...keys, plan.key].sort(),
      )
    } catch (error) {
      try { await storage.artifactDataRemove(plan.artifactId, plan.key) } catch {}
      throw error
    }
    return undefined
  }

  const keys = await readStorageKeys(storage, plan.artifactId)
  if (!keys.includes(plan.key)) {
    await storage.artifactDataRemove(plan.artifactId, plan.key)
    return undefined
  }
  const previousValue = await storage.artifactDataGet(plan.artifactId, plan.key)
  await storage.artifactDataRemove(plan.artifactId, plan.key)
  try {
    const nextKeys = keys.filter((key) => key !== plan.key)
    if (nextKeys.length) {
      await storage.artifactDataSet(plan.artifactId, ARTIFACT_STORAGE_INDEX_KEY, nextKeys)
    } else {
      await storage.artifactDataRemove(plan.artifactId, ARTIFACT_STORAGE_INDEX_KEY)
    }
  } catch (error) {
    try { await storage.artifactDataSet(plan.artifactId, plan.key, previousValue) } catch {}
    throw error
  }
  return undefined
}

export default function ArtifactsApp({ appId, token }) {
  const storage = useMemo(() => makeStorage(appId, token), [appId, token])
  const [selectedId, setSelectedId] = useState(null)
  const navRef = useRef(null)
  const previewFrameRef = useRef(null)
  const storageRequestsRef = useRef(new Set())
  const storageMutationRef = useRef(Promise.resolve())

  const onPreviewFrame = useCallback((frame, context) => {
    if (frame) {
      previewFrameRef.current = { frame, ...context }
      storageRequestsRef.current.clear()
      return
    }
    if (previewFrameRef.current?.artifactId === context.artifactId) {
      previewFrameRef.current = null
      storageRequestsRef.current.clear()
    }
  }, [])

  const closeDetail = useCallback(() => {
    try { navRef.current?.close?.() } catch {}
    navRef.current = null
    setSelectedId(null)
  }, [])

  const openDetail = useCallback(async (id) => {
    if (!id || id === selectedId) return
    try { navRef.current?.close?.() } catch {}
    const nav = window.mobius?.nav
    if (!nav?.open) {
      setSelectedId(id)
      return
    }
    const handle = nav.open('artifact-detail', () => {
      navRef.current = null
      setSelectedId(null)
    })
    navRef.current = handle
    const outcome = await handle.outcome
    if (navRef.current !== handle) return
    if (outcome.status === 'owned' || outcome.status === 'standalone') setSelectedId(id)
    else navRef.current = null
  }, [selectedId])

  useEffect(() => {
    const onIntent = (event) => {
      if (event.source !== window.parent) return
      if (event.data?.type !== 'moebius:app-intent') return
      const id = artifactIntent(event.data.intent)
      if (id) openDetail(id)
    }
    window.addEventListener('message', onIntent)
    return () => window.removeEventListener('message', onIntent)
  }, [openDetail])

  useEffect(() => {
    const reply = (target, requestId, nonce, result) => {
      try {
        target.postMessage({
          type: 'moebius:artifact-storage-result',
          requestId,
          nonce,
          ...result,
        }, '*')
      } catch {}
    }
    const onStorageMessage = (event) => {
      const mounted = previewFrameRef.current
      if (!mounted || event.source !== mounted.frame.contentWindow) return
      const message = event.data
      if (message?.type !== 'moebius:artifact-storage') return
      const requestId = typeof message.requestId === 'string' ? message.requestId : ''
      const nonce = typeof message.nonce === 'string' ? message.nonce : ''
      let plan
      try {
        plan = planArtifactStorageRequest(message, mounted)
      } catch (error) {
        if (/^[A-Za-z0-9_-]{1,128}$/.test(requestId)
          && /^[A-Za-z0-9_-]{1,128}$/.test(nonce)) {
          reply(event.source, requestId, nonce, {
            ok: false,
            error: error?.bridgeError || 'invalid-request',
          })
        }
        return
      }
      const pendingKey = `${plan.nonce}:${plan.requestId}`
      if (storageRequestsRef.current.has(pendingKey)) {
        reply(event.source, plan.requestId, plan.nonce, { ok: false, error: 'duplicate-request' })
        return
      }
      if (storageRequestsRef.current.size >= ARTIFACT_STORAGE_MAX_PENDING) {
        reply(event.source, plan.requestId, plan.nonce, { ok: false, error: 'too-many-requests' })
        return
      }
      storageRequestsRef.current.add(pendingKey)
      const execute = () => executeArtifactStoragePlan(storage, plan)
      const serialized = plan.op !== 'get'
      const task = serialized
        ? storageMutationRef.current.then(execute, execute)
        : execute()
      if (serialized) {
        storageMutationRef.current = task.catch(() => {})
      }
      task
        .then((value) => reply(event.source, plan.requestId, plan.nonce, { ok: true, value }))
        .catch((error) => reply(event.source, plan.requestId, plan.nonce, {
          ok: false,
          error: error?.bridgeError || 'request-failed',
        }))
        .finally(() => storageRequestsRef.current.delete(pendingKey))
    }
    window.addEventListener('message', onStorageMessage)
    return () => window.removeEventListener('message', onStorageMessage)
  }, [storage])

  useEffect(() => () => {
    try { navRef.current?.close?.() } catch {}
  }, [])

  return (
    <div className="af-root">
      <style>{CSS}</style>
      {selectedId
        ? <Detail artifactId={selectedId} storage={storage} token={token} onPreviewFrame={onPreviewFrame} onClose={closeDetail} onDeleted={closeDetail} />
        : <Gallery storage={storage} onOpen={openDetail} />}
    </div>
  )
}
