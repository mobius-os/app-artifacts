import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { artifactIntent } from './domain.js'
import { makeStorage } from './storage.js'
import { CSS } from './theme.js'
import { Gallery } from './ui/Gallery.jsx'
import { Detail } from './ui/Detail.jsx'

export default function ArtifactsApp({ appId, token }) {
  const storage = useMemo(() => makeStorage(appId, token), [appId, token])
  const [selectedId, setSelectedId] = useState(null)
  const navRef = useRef(null)

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

  useEffect(() => () => {
    try { navRef.current?.close?.() } catch {}
  }, [])

  return (
    <div className="af-root">
      <style>{CSS}</style>
      {selectedId
        ? <Detail artifactId={selectedId} storage={storage} token={token} onClose={closeDetail} onDeleted={closeDetail} />
        : <Gallery storage={storage} onOpen={openDetail} />}
    </div>
  )
}
