import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { shareNeedsUpdate, publishedShare, stoppedShare, versionPath } from '../domain.js'
import { loadChatTitles } from '../storage.js'
import { ArtifactFrame } from '../preview/ArtifactFrame.jsx'
import { VersionTimeline } from './VersionTimeline.jsx'
import { DeleteSheet, ShareSheet } from './ShareSheet.jsx'
import {
  ArrowLeftIcon,
  ChatIcon,
  ExpandIcon,
  MoreIcon,
  ReloadIcon,
  ShareIcon,
  SparkIcon,
} from './Icons.jsx'

function postToShell(message) {
  window.parent.postMessage(message, '*')
}

function toPublicUrl(value) {
  try { return new URL(value, window.location.origin).href } catch { return String(value || '') }
}

export function Detail({ artifactId, storage, token, onClose, onDeleted }) {
  const [record, setRecord] = useState(null)
  const [share, setShare] = useState(null)
  const [status, setStatus] = useState('loading')
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [toast, setToast] = useState(null)
  const [chatInfo, setChatInfo] = useState({ permission: 'loading', title: null })
  const fullscreenNav = useRef(null)

  const showToast = useCallback((message, tone = '') => {
    setToast({ message, tone, key: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    let active = true
    let refreshing = false
    setStatus('loading')
    setSelectedVersion(null)
    const recordPath = `artifacts/${artifactId}.json`
    const sharePath = `shares/${artifactId}.json`
    const acceptRecord = (value) => {
      if (!active) return
      setRecord((current) => {
        if (!value) return null
        if (!current || current.id !== value.id) return value
        const currentTime = new Date(current.updated_at || current.created_at || 0).getTime()
        const nextTime = new Date(value.updated_at || value.created_at || 0).getTime()
        const currentVersion = Number(current.current_version) || 0
        const nextVersion = Number(value.current_version) || 0
        return nextVersion > currentVersion || nextTime >= currentTime ? value : current
      })
      setStatus(value ? 'ready' : 'missing')
    }
    const unsubscribeRecord = storage.subscribe(recordPath, acceptRecord)
    const unsubscribeShare = storage.subscribe(sharePath, (value) => { if (active) setShare(value || null) })
    storage.getFresh(recordPath).then(acceptRecord).catch((error) => {
      if (active) {
        setStatus('error')
        showToast(error?.message || 'Artifact could not be loaded.', 'error')
      }
    })
    storage.getFresh(sharePath).then((value) => { if (active) setShare(value || null) }).catch(() => {})
    const refresh = async () => {
      if (refreshing || document.visibilityState === 'hidden') return
      refreshing = true
      try {
        const [nextRecord, nextShare] = await Promise.all([
          storage.getFresh(recordPath),
          storage.getFresh(sharePath).catch(() => null),
        ])
        acceptRecord(nextRecord)
        if (active) setShare(nextShare || null)
      } catch {
        // Keep the subscribed last-known record; the next visible poll retries.
      } finally {
        refreshing = false
      }
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh() }
    const timer = window.setInterval(refresh, 3500)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      unsubscribeRecord?.()
      unsubscribeShare?.()
    }
  }, [artifactId, showToast, storage])

  useEffect(() => {
    if (!record?.chat_id) {
      setChatInfo({ permission: 'allowed', title: null })
      return undefined
    }
    let active = true
    loadChatTitles(token)
      .then(({ permission, titles }) => {
        if (active) setChatInfo({ permission, title: titles.get(String(record.chat_id)) || null })
      })
      .catch(() => {
        if (active) setChatInfo({ permission: 'error', title: null })
      })
    return () => { active = false }
  }, [record?.chat_id, token])

  useEffect(() => () => {
    try { fullscreenNav.current?.close?.() } catch {}
  }, [])

  const currentVersion = Number(record?.current_version) || 1
  const previewVersion = selectedVersion || currentVersion
  const publicShare = useMemo(() => share ? { ...share, url: toPublicUrl(share.url) } : null, [share])
  const needsUpdate = shareNeedsUpdate(record, share)

  const toggleFullscreen = useCallback(async () => {
    if (fullscreen) {
      fullscreenNav.current?.close?.()
      fullscreenNav.current = null
      setFullscreen(false)
      return
    }
    const nav = window.mobius?.nav
    if (!nav?.open) {
      setFullscreen(true)
      return
    }
    const handle = nav.open('artifact-preview', () => {
      fullscreenNav.current = null
      setFullscreen(false)
    })
    fullscreenNav.current = handle
    const outcome = await handle.outcome
    if (fullscreenNav.current !== handle) return
    if (outcome.status === 'owned' || outcome.status === 'standalone') {
      setFullscreen(true)
    } else {
      fullscreenNav.current = null
      showToast('Fullscreen is unavailable right now.')
    }
  }, [fullscreen, showToast])

  async function publish(version) {
    if (!record || busy) return
    setBusy('publish')
    try {
      const html = await storage.getText(versionPath(record.id, version))
      if (html == null) throw new Error(`Version ${version} is missing.`)
      await storage.setText(`projects/${record.id}/build/site/index.html`, html)
      const result = await storage.publish(record.id)
      const next = publishedShare({
        id: record.id,
        version,
        token: result.token,
        url: result.url,
      })
      await storage.setJSON(`shares/${record.id}.json`, next)
      setShare(next)
      showToast(share?.published ? `Shared version updated to v${version}.` : 'Public link created.', 'success')
    } catch (error) {
      showToast(error?.message || 'Artifact could not be shared.', 'error')
    } finally {
      setBusy('')
    }
  }

  async function stopSharing() {
    if (!record || busy) return
    setBusy('stop')
    try {
      await storage.unpublish(record.id)
      const next = stoppedShare(share)
      await storage.setJSON(`shares/${record.id}.json`, next)
      setShare(next)
      showToast('Public link removed.', 'success')
    } catch (error) {
      showToast(error?.message || 'Sharing could not be stopped.', 'error')
    } finally {
      setBusy('')
    }
  }

  async function copyLink() {
    const url = publicShare?.url
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      showToast('Public link copied.', 'success')
    } catch {
      showToast('Copy is unavailable. Open the page and copy its address.', 'error')
    }
  }

  async function deleteArtifact() {
    if (!record || busy) return
    setBusy('delete')
    try {
      await storage.unpublish(record.id)
      const results = await Promise.allSettled([
        storage.removeFolder(`versions/${record.id}`),
        storage.removeFolder(`projects/${record.id}`),
        storage.remove(`shares/${record.id}.json`),
        storage.remove(`artifacts/${record.id}.json`),
      ])
      const failed = results.find((result) => result.status === 'rejected')
      if (failed) throw failed.reason
      onDeleted(record.id)
    } catch (error) {
      showToast(error?.message || 'Artifact could not be deleted.', 'error')
      setBusy('')
    }
  }

  function openOriginChat() {
    if (!record?.chat_id) {
      showToast('The origin chat is no longer available.')
      return
    }
    if (chatInfo.permission === 'allowed' && !chatInfo.title) {
      showToast('The origin chat was deleted.')
      return
    }
    postToShell({ type: 'moebius:open-chat', chatId: record.chat_id })
  }

  function askAgent() {
    postToShell({
      type: 'moebius:new-chat',
      draft: `Please update the artifact “${record?.title || 'Untitled artifact'}” (artifact id: ${artifactId}).`,
    })
  }

  if (status === 'loading') {
    return <div className="af-detail-loading"><div className="af-skeleton af-skeleton-title" /><div className="af-skeleton af-skeleton-window" /></div>
  }

  if (status === 'missing' || status === 'error' || !record) {
    return (
      <div className="af-view">
        <header className="af-detail-header"><button className="af-btn af-btn-icon af-btn-ghost" type="button" onClick={onClose} aria-label="Back to artifacts"><ArrowLeftIcon /></button><h1>Artifact unavailable</h1></header>
        <div className="af-empty"><div className="af-empty-mark is-error">!</div><h2 className="af-empty-title">This artifact could not be found</h2><p className="af-empty-text">It may have been deleted while the catalog was open.</p><button className="af-btn af-btn-secondary" type="button" onClick={onClose}>Back to artifacts</button></div>
      </div>
    )
  }

  const deletedChat = chatInfo.permission === 'allowed' && !chatInfo.title
  const showChatTitle = chatInfo.permission !== 'forbidden'
  const fromLabel = chatInfo.permission === 'loading'
    ? 'Finding origin chat…'
    : deletedChat
      ? 'a deleted chat'
      : chatInfo.permission === 'error'
        ? 'chat title unavailable'
        : chatInfo.title

  return (
    <div className="af-view af-detail">
      <header className="af-detail-header">
        <button className="af-btn af-btn-icon af-btn-ghost" type="button" onClick={onClose} aria-label="Back to artifacts"><ArrowLeftIcon /></button>
        <div className="af-detail-heading"><h1>{record.title || 'Untitled artifact'}</h1><span>v{currentVersion}</span></div>
        <button className="af-btn af-btn-icon af-btn-ghost" type="button" onClick={() => setDeleteOpen(true)} aria-label="Artifact options"><MoreIcon /></button>
      </header>

      <main className="af-detail-scroll">
        <div className="af-detail-page">
          <div className={`af-preview-shell${fullscreen ? ' is-fullscreen' : ''}`}>
            <div className="af-preview-toolbar">
              <span>Previewing v{previewVersion}</span>
              <div>
                <button className="af-btn af-btn-icon af-preview-tool" type="button" onClick={() => setReloadTick((n) => n + 1)} aria-label="Reload preview"><ReloadIcon size={17} /></button>
                <button className="af-btn af-btn-icon af-preview-tool" type="button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit fullscreen preview' : 'Open fullscreen preview'}><ExpandIcon size={17} /></button>
              </div>
            </div>
            <ArtifactFrame artifactId={record.id} version={previewVersion} storage={storage} reloadTick={reloadTick} fullscreen={fullscreen} />
          </div>

          <section className="af-detail-meta" aria-label="Artifact information">
            {record.description && <p className="af-detail-description">{record.description}</p>}
            <div className="af-meta-row">
              <span className="af-chip">Version {currentVersion}</span>
              {share?.published && <span className="af-badge af-badge-shared">Shared v{share.shared_version}</span>}
            </div>
            {showChatTitle && <p className="af-origin">From: <strong>{fromLabel}</strong></p>}
          </section>

          <section className="af-actions" aria-label="Artifact actions">
            <button className="af-action" type="button" onClick={() => setShareOpen(true)}><span className="af-action-icon"><ShareIcon /></span><span><strong>{share?.published ? 'Manage sharing' : 'Share'}</strong><small>{share?.published ? (needsUpdate ? `Update to v${currentVersion}` : 'Public link is current') : 'Publish a snapshot'}</small></span></button>
            <button className={`af-action${deletedChat ? ' is-disabled' : ''}`} type="button" aria-disabled={deletedChat} onClick={openOriginChat}><span className="af-action-icon"><ChatIcon /></span><span><strong>Open origin chat</strong><small>{deletedChat ? 'Chat deleted' : 'Return to the conversation'}</small></span></button>
            <button className="af-action" type="button" onClick={askAgent}><span className="af-action-icon"><SparkIcon /></span><span><strong>Ask agent to change this</strong><small>Start with this artifact’s id</small></span></button>
          </section>

          <VersionTimeline
            versions={record.versions}
            currentVersion={currentVersion}
            selectedVersion={previewVersion}
            onSelect={(version) => setSelectedVersion(version === currentVersion ? null : version)}
          />
        </div>
      </main>

      <ShareSheet open={shareOpen} artifact={record} share={publicShare} busy={Boolean(busy)} needsUpdate={needsUpdate} onClose={() => setShareOpen(false)} onPublish={publish} onCopy={copyLink} onStop={stopSharing} />
      <DeleteSheet open={deleteOpen} title={record.title} busy={busy === 'delete'} onClose={() => setDeleteOpen(false)} onDelete={deleteArtifact} />
      {toast && <div className={`af-toast${toast.tone ? ` is-${toast.tone}` : ''}`} role="status" key={toast.key}>{toast.message}</div>}
    </div>
  )
}
