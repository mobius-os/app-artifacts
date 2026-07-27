import React, { useCallback, useEffect, useRef, useState } from 'react'
import { friendlyLoadError, isValidProjectId } from '../domain.js'
import { ArtifactCard } from './ArtifactCard.jsx'
import { Empty, LoadError } from './Empty.jsx'
import { reuseRecordList, reuseRecordMap } from './catalogSnapshot.js'
import { SKILLS_ICON } from './skillIcon.js'

const POLL_MS = 3500

function recordDate(record) {
  const date = new Date(record.updated_at || record.created_at || 0)
  return Number.isNaN(date.getTime()) ? null : date
}

function dateKey(date) {
  if (!date) return 'unknown'
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function dateHeading(date) {
  if (!date) return 'Earlier'
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (dateKey(date) === dateKey(today)) return 'Today'
  if (dateKey(date) === dateKey(yesterday)) return 'Yesterday'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  }).format(date)
}

function groupArtifacts(artifacts) {
  const groups = []
  artifacts.forEach((artifact) => {
    const date = recordDate(artifact)
    const key = dateKey(date)
    let group = groups[groups.length - 1]
    if (!group || group.key !== key) {
      group = { key, label: dateHeading(date), artifacts: [] }
      groups.push(group)
    }
    group.artifacts.push(artifact)
  })
  return groups
}

async function readFolder(storage, prefix) {
  const entries = await storage.list(prefix, { includeContent: true })
  const values = await Promise.all(entries.map(async (entry) => {
    const path = entry?.path || (entry?.name ? `${prefix}${entry.name}` : null)
    if (typeof path !== 'string' || !path.endsWith('.json')) return null
    if (entry?.content !== undefined) {
      if (typeof entry.content !== 'string') return entry.content
      try {
        return JSON.parse(entry.content)
      } catch {
        return null
      }
    }
    return storage.getFresh(path).catch(() => null)
  }))
  return values.filter((value) => value && typeof value === 'object')
}

export function Gallery({ appId, storage, onOpen }) {
  const [artifacts, setArtifacts] = useState([])
  const [shares, setShares] = useState(new Map())
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const loadId = useRef(0)
  const loading = useRef(false)
  const scrolling = useRef(false)
  const scrollTimer = useRef(null)
  const [previewPaused, setPreviewPaused] = useState(false)

  const load = useCallback(async () => {
    if (loading.current) return
    loading.current = true
    const id = ++loadId.current
    try {
      const allRecords = await readFolder(storage, 'artifacts/')
      // Sharing badges enrich the catalogue but never own it. If that folder
      // is temporarily unavailable, every artifact must still be accessible.
      const shareRecords = await readFolder(storage, 'shares/').catch(() => [])
      if (id !== loadId.current) return
      // A record's own `id` is interpolated into storage paths and request URLs
      // downstream, and only deep-linked ids were validated before. Drop any
      // record whose id isn't a plain artifact id so a malformed one (e.g.
      // containing `../` or `?`) can never reshape a later authenticated read.
      const records = allRecords.filter((value) => isValidProjectId(value?.id))
      records.sort((a, b) => {
        const right = new Date(b.updated_at || b.created_at || 0).getTime()
        const left = new Date(a.updated_at || a.created_at || 0).getTime()
        return right - left
      })
      const nextShares = new Map(shareRecords.map((share) => [share.project_id, share]))
      setArtifacts((current) => reuseRecordList(current, records))
      setShares((current) => reuseRecordMap(current, nextShares))
      setStatus('ready')
      setError('')
    } catch (cause) {
      if (id !== loadId.current) return
      console.error('Could not load the artifact gallery.', cause)
      setError(friendlyLoadError(cause))
      setStatus((current) => current === 'ready' ? 'ready' : 'error')
    } finally {
      loading.current = false
    }
  }, [storage])

  const groups = groupArtifacts(artifacts)
  const versionCount = artifacts.reduce(
    (total, artifact) => total + Math.max(1, Number(artifact.current_version) || 1),
    0,
  )
  const sharedCount = [...shares.values()].filter((share) => share?.published === true).length

  useEffect(() => {
    load()
    const refreshVisible = () => {
      if (document.visibilityState !== 'hidden' && !scrolling.current) load()
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
      if (scrollTimer.current) window.clearTimeout(scrollTimer.current)
    }
  }, [load])

  const pausePreviewsWhileScrolling = () => {
    if (!scrolling.current) {
      scrolling.current = true
      setPreviewPaused(true)
    }
    if (scrollTimer.current) window.clearTimeout(scrollTimer.current)
    scrollTimer.current = window.setTimeout(() => {
      scrolling.current = false
      scrollTimer.current = null
      setPreviewPaused(false)
    }, 140)
  }

  return (
    <div className="af-view af-gallery">
      <header className="af-header">
        <div className="af-brand">
          <span className="af-mark" aria-hidden="true">
            <img src={`/api/apps/${appId}/icon?size=64`} alt="" />
          </span>
          <div className="af-brand-copy">
            <h1>Artifacts</h1>
            <p>{status === 'loading' ? 'Loading your catalog…' : `${artifacts.length} ${artifacts.length === 1 ? 'artifact' : 'artifacts'} · ${versionCount} ${versionCount === 1 ? 'version' : 'versions'}${sharedCount ? ` · ${sharedCount} shared` : ''}`}</p>
          </div>
        </div>
      </header>

      <main className="af-scroll" id="af-main" onScroll={pausePreviewsWhileScrolling}>
        <div className="af-page">
          <section className="af-skill-note" aria-label="About Artifacts">
            <img className="af-skill-note-icon" src={SKILLS_ICON} alt="" aria-hidden="true" />
            <div>
              <strong>Artifacts comes with a creation skill.</strong>
              <span>Ask for a mockup, diagram, interactive explainer, or polished report in any chat; Möbius will keep it here with its versions and source conversation.</span>
            </div>
          </section>
          {status === 'loading' && (
            <div className="af-card-list" aria-label="Loading artifacts">
              {[0, 1, 2].map((item) => <div className="af-card af-card-skeleton" key={item}><div className="af-card-preview"><div className="af-skeleton" /></div><div className="af-card-body"><div className="af-skeleton af-skeleton-icon" /><div className="af-skeleton-lines"><div className="af-skeleton" /><div className="af-skeleton is-short" /></div></div></div>)}
            </div>
          )}
          {status === 'error' && <LoadError message={error} onRetry={load} />}
          {status === 'ready' && artifacts.length === 0 && <Empty />}
          {status === 'ready' && artifacts.length > 0 && (
            <div className="af-history">
              {groups.map((group) => (
                <section className="af-date-group" key={group.key} aria-labelledby={`artifacts-${group.key}`}>
                  <h2 id={`artifacts-${group.key}`}>{group.label}</h2>
                  <div className="af-card-list">
                    {group.artifacts.map((artifact) => (
                      <ArtifactCard
                        key={artifact.id}
                        artifact={artifact}
                        shared={shares.get(artifact.id)?.published === true}
                        storage={storage}
                        previewPaused={previewPaused}
                        onOpen={onOpen}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
