import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ArtifactCard } from './ArtifactCard.jsx'
import { Empty, LoadError } from './Empty.jsx'
import { ArtifactIcon } from './Icons.jsx'

const POLL_MS = 3500

async function readFolder(storage, prefix) {
  const entries = await storage.list(prefix)
  const paths = entries
    .map((entry) => entry?.path || (entry?.name ? `${prefix}${entry.name}` : null))
    .filter((path) => typeof path === 'string' && path.endsWith('.json'))
  const values = await Promise.all(paths.map((path) => storage.getFresh(path).catch(() => null)))
  return values.filter((value) => value && typeof value === 'object')
}

export function Gallery({ storage, onOpen, onStartChat }) {
  const [artifacts, setArtifacts] = useState([])
  const [shares, setShares] = useState(new Map())
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const loadId = useRef(0)
  const loading = useRef(false)

  const load = useCallback(async () => {
    if (loading.current) return
    loading.current = true
    const id = ++loadId.current
    try {
      const [records, shareRecords] = await Promise.all([
        readFolder(storage, 'artifacts/'),
        readFolder(storage, 'shares/'),
      ])
      if (id !== loadId.current) return
      records.sort((a, b) => {
        const right = new Date(b.updated_at || b.created_at || 0).getTime()
        const left = new Date(a.updated_at || a.created_at || 0).getTime()
        return right - left
      })
      setArtifacts(records)
      setShares(new Map(shareRecords.map((share) => [share.project_id, share])))
      setStatus('ready')
      setError('')
    } catch (cause) {
      if (id !== loadId.current) return
      setError(cause?.message || 'Check your connection and try again.')
      setStatus((current) => current === 'ready' ? 'ready' : 'error')
    } finally {
      loading.current = false
    }
  }, [storage])

  useEffect(() => {
    load()
    const refreshVisible = () => {
      if (document.visibilityState !== 'hidden') load()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load()
    }
    const timer = window.setInterval(refreshVisible, POLL_MS)
    window.addEventListener('focus', refreshVisible)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      loadId.current += 1
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshVisible)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load])

  return (
    <div className="af-view af-gallery">
      <header className="af-header">
        <div className="af-brand">
          <span className="af-mark" aria-hidden="true"><ArtifactIcon size={20} /></span>
          <div className="af-brand-copy">
            <h1>Artifacts</h1>
            <p>{status === 'loading' ? 'Loading your catalog…' : `${artifacts.length} ${artifacts.length === 1 ? 'artifact' : 'artifacts'}`}</p>
          </div>
        </div>
      </header>

      <main className="af-scroll" id="af-main">
        <div className="af-page">
          {status === 'loading' && (
            <div className="af-card-list" aria-label="Loading artifacts">
              {[0, 1, 2].map((item) => <div className="af-card af-card-skeleton" key={item}><div className="af-skeleton af-skeleton-icon" /><div className="af-skeleton-lines"><div className="af-skeleton" /><div className="af-skeleton is-short" /></div></div>)}
            </div>
          )}
          {status === 'error' && <LoadError message={error} onRetry={load} />}
          {status === 'ready' && artifacts.length === 0 && <Empty onStartChat={onStartChat} />}
          {status === 'ready' && artifacts.length > 0 && (
            <div className="af-card-list">
              {artifacts.map((artifact) => (
                <ArtifactCard
                  key={artifact.id}
                  artifact={artifact}
                  shared={shares.get(artifact.id)?.published === true}
                  onOpen={onOpen}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
