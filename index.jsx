import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ARTIFACT_STORAGE_INDEX_KEY,
  ARTIFACT_STORAGE_MAX_PENDING,
  artifactIntent,
  planArtifactStorageRequest,
  isTrustedArtifactStorageMessage,
} from './domain.js'
import { makeStorage } from './storage.js'
import { CSS } from './theme.js'
import { Gallery } from './ui/Gallery.jsx'
import { Detail } from './ui/Detail.jsx'


async function listArtifactKeys(storage, artifactId) {
  const keys = await storage.artifactDataKeys(artifactId)
  // An artifact written by an older version may still hold the retired
  // __mobius_keys index file. The server counts it as a stored value, so it
  // would silently occupy one of the 100 key slots and its bytes forever.
  // Hide it from authors AND retire it opportunistically — best-effort, since
  // failing to clean up must never fail the list.
  if (keys.includes(ARTIFACT_STORAGE_INDEX_KEY)) {
    try {
      await storage.artifactDataRemove(artifactId, ARTIFACT_STORAGE_INDEX_KEY)
    } catch { /* a stale index is harmless; the filter below still hides it */ }
  }
  return keys.filter((key) => key !== ARTIFACT_STORAGE_INDEX_KEY).sort()
}


async function executeArtifactStoragePlan(storage, plan) {
  // Every op is a single server call. There is deliberately NO client-maintained
  // key index: two tabs each read the old index, wrote their own key, and the
  // second index write dropped the first — leaving a value that existed but
  // could not be listed. The server derives the list from the directory, which
  // cannot disagree with itself, and enforces the key cap authoritatively.
  if (plan.op === 'get') return storage.artifactDataGet(plan.artifactId, plan.key)
  if (plan.op === 'list') return listArtifactKeys(storage, plan.artifactId)
  if (plan.op === 'set') {
    await storage.artifactDataSet(plan.artifactId, plan.key, plan.value)
    return undefined
  }
  await storage.artifactDataRemove(plan.artifactId, plan.key)
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
    // Deliberately do NOT clear storageRequestsRef here. Its entries are
    // removed when each request settles, so clearing on remount would reset the
    // in-flight cap while the old document's fetches (values up to 64 KB each)
    // are still queued — letting a reload admit another full batch on top.
    // Stale entries can't collide either: the key includes the child's random
    // per-document nonce, so a fresh document never reuses one.
    if (frame) {
      previewFrameRef.current = { frame, ...context }
      return
    }
    if (previewFrameRef.current?.artifactId === context.artifactId) {
      previewFrameRef.current = null
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
      // A sandboxed frame may navigate ITSELF, and its contentWindow stays the
      // same object, so event.source cannot tell the staged artifact apart from
      // a page it navigated to. Both documents are opaque origins, so
      // event.origin cannot either. The session key was injected into the
      // staged document only, and a replacement document never saw it — so a
      // navigated-away frame silently loses storage authority. Checked before
      // any reply, since replies go to '*'.
      if (!isTrustedArtifactStorageMessage(message, mounted)) return
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
