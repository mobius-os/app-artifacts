import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { artifactFilename, shareNeedsUpdate, publishedShare, stoppedShare, versionPath } from '../domain.js'
import { loadChatTitles } from '../storage.js'
import { ArtifactFrame } from '../preview/ArtifactFrame.jsx'
import { VersionTimeline } from './VersionTimeline.jsx'
import { ArtifactOptionsSheet, DeleteSheet, ShareSheet } from './ShareSheet.jsx'
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

const TOO_LARGE_MESSAGE = 'This artifact is too large to share — ask the agent to trim it.'

function isPayloadTooLarge(error) {
  return Number(error?.status || error?.response?.status) === 413
    || /\b413\b/.test(String(error?.message || ''))
}

function shareFailureMessage(error, fallback) {
  if (error?.userMessage) return error.userMessage
  if (isPayloadTooLarge(error)) return TOO_LARGE_MESSAGE
  return error?.message || fallback
}

function compensatedError(message, cause) {
  const error = new Error(message)
  error.status = cause?.status
  error.userMessage = message
  return error
}

export function Detail({ artifactId, storage, token, onClose, onDeleted }) {
  const [record, setRecord] = useState(null)
  const [share, setShare] = useState(null)
  const [status, setStatus] = useState('loading')
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [sourceReloadTick, setSourceReloadTick] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [viewMode, setViewMode] = useState('preview')
  const [sourceState, setSourceState] = useState({ key: '', status: 'idle', html: '', message: '' })
  const [shareOpen, setShareOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
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
    setViewMode('preview')
    setSourceState({ key: '', status: 'idle', html: '', message: '' })
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
  const sourceKey = record ? `${record.id}:${previewVersion}` : ''
  const publicShare = useMemo(() => share ? { ...share, url: toPublicUrl(share.url) } : null, [share])
  const needsUpdate = shareNeedsUpdate(record, share)

  useEffect(() => {
    if (viewMode !== 'source' || !record) return undefined
    let active = true
    setSourceState({ key: sourceKey, status: 'loading', html: '', message: '' })
    storage.getText(versionPath(record.id, previewVersion))
      .then((html) => {
        if (!active) return
        if (html == null) throw new Error(`Version ${previewVersion} is missing.`)
        setSourceState({ key: sourceKey, status: 'ready', html, message: '' })
      })
      .catch((error) => {
        if (active) setSourceState({
          key: sourceKey,
          status: 'error',
          html: '',
          message: error?.message || 'Source could not be loaded.',
        })
      })
    return () => { active = false }
  }, [previewVersion, record?.id, sourceKey, sourceReloadTick, storage, viewMode])

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

  async function readVersionHtml(version) {
    const html = await storage.getText(versionPath(record.id, version))
    if (html == null) throw new Error(`Version ${version} is missing.`)
    return html
  }

  async function stageVersion(version) {
    const html = await readVersionHtml(version)
    await storage.removeFolder(`projects/${record.id}/build/site`)
    await storage.setText(`projects/${record.id}/build/site/index.html`, html)
  }

  async function publish(version) {
    if (!record || busy) return
    setBusy('publish')
    const previousShare = share?.published ? share : null
    try {
      await stageVersion(version)
      const result = await storage.publish(record.id)
      const next = publishedShare({
        id: record.id,
        version,
        token: result.token,
        url: result.url,
      })
      try {
        await storage.setJSON(`shares/${record.id}.json`, next)
      } catch (persistenceError) {
        const tooLarge = isPayloadTooLarge(persistenceError)
        if (previousShare) {
          try {
            await stageVersion(previousShare.shared_version)
            await storage.publish(record.id)
          } catch {
            throw compensatedError(
              tooLarge
                ? `${TOO_LARGE_MESSAGE} The previous public snapshot could not be restored.`
                : 'The shared version could not be saved, and the previous public snapshot could not be restored.',
              persistenceError,
            )
          }
          throw compensatedError(
            tooLarge
              ? `${TOO_LARGE_MESSAGE} The previous shared version is still live.`
              : 'The shared version could not be saved. The previous shared version is still live.',
            persistenceError,
          )
        }
        try {
          await storage.unpublish(record.id)
        } catch {
          setShare(next)
          throw compensatedError(
            tooLarge
              ? `${TOO_LARGE_MESSAGE} The new public link could not be removed; try Stop sharing.`
              : 'Share state could not be saved, and the new public link could not be removed. Try Stop sharing.',
            persistenceError,
          )
        }
        throw compensatedError(
          tooLarge
            ? `${TOO_LARGE_MESSAGE} The new public link was removed.`
            : 'Share state could not be saved, so the new public link was removed.',
          persistenceError,
        )
      }
      setShare(next)
      showToast(previousShare ? `Shared version updated to v${version}.` : 'Public link created.', 'success')
    } catch (error) {
      showToast(shareFailureMessage(error, 'Artifact could not be shared.'), 'error')
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
      showToast(shareFailureMessage(error, 'Sharing could not be stopped.'), 'error')
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

  async function selectedHtml() {
    if (sourceState.key === sourceKey && sourceState.status === 'ready') return sourceState.html
    return readVersionHtml(previewVersion)
  }

  async function copyHtml() {
    if (!record || busy) return
    setBusy('copy')
    try {
      const html = await selectedHtml()
      await navigator.clipboard.writeText(html)
      setOptionsOpen(false)
      showToast('Copied.', 'success')
    } catch {
      showToast('Copy is unavailable. Switch to Source and select the HTML.', 'error')
    } finally {
      setBusy('')
    }
  }

  async function downloadHtml() {
    if (!record || busy) return
    setBusy('download')
    try {
      const html = await selectedHtml()
      const blob = new Blob([html], { type: 'application/octet-stream' })
      const objectUrl = URL.createObjectURL(blob)
      try {
        const anchor = document.createElement('a')
        anchor.href = objectUrl
        anchor.download = artifactFilename(record.title, previewVersion)
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
      setOptionsOpen(false)
      showToast('Download started.', 'success')
    } catch (error) {
      showToast(error?.message || 'HTML could not be downloaded.', 'error')
    } finally {
      setBusy('')
    }
  }

  async function deleteArtifact() {
    if (!record || busy) return
    setBusy('delete')
    try {
      if (share?.published) await storage.unpublish(record.id)
      await storage.removeFolder(`versions/${record.id}`)
      await storage.removeFolder(`projects/${record.id}`)
      await storage.remove(`shares/${record.id}.json`)
      await storage.remove(`artifacts/${record.id}.json`)
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
        <button className="af-btn af-btn-icon af-btn-ghost" type="button" onClick={() => setOptionsOpen(true)} aria-label="Artifact options"><MoreIcon /></button>
      </header>

      <main className="af-detail-scroll">
        <div className="af-detail-page">
          <div className={`af-preview-shell${fullscreen ? ' is-fullscreen' : ''}`}>
            <div className="af-preview-toolbar">
              <div className="af-preview-context">
                <span>Version v{previewVersion}</span>
                <div className="af-segment" role="group" aria-label="Artifact view">
                  <button className={viewMode === 'preview' ? 'is-selected' : ''} type="button" aria-pressed={viewMode === 'preview'} onClick={() => setViewMode('preview')}>Preview</button>
                  <button className={viewMode === 'source' ? 'is-selected' : ''} type="button" aria-pressed={viewMode === 'source'} onClick={() => setViewMode('source')}>Source</button>
                </div>
              </div>
              <div className="af-preview-tools">
                <button
                  className="af-btn af-btn-icon af-preview-tool"
                  type="button"
                  onClick={() => viewMode === 'source' ? setSourceReloadTick((n) => n + 1) : setReloadTick((n) => n + 1)}
                  aria-label={viewMode === 'source' ? 'Reload source' : 'Reload preview'}
                >
                  <ReloadIcon size={17} />
                </button>
                <button className="af-btn af-btn-icon af-preview-tool" type="button" onClick={toggleFullscreen} aria-label={fullscreen ? `Exit fullscreen ${viewMode}` : `Open fullscreen ${viewMode}`}><ExpandIcon size={17} /></button>
              </div>
            </div>
            {viewMode === 'preview'
              ? <ArtifactFrame artifactId={record.id} version={previewVersion} storage={storage} reloadTick={reloadTick} fullscreen={fullscreen} />
              : (
                <div className="af-source" aria-label={`HTML source, version ${previewVersion}`}>
                  {(sourceState.key !== sourceKey || sourceState.status === 'loading') && (
                    <div className="af-source-state" aria-label="Loading artifact source"><div className="af-skeleton af-skeleton-window" /></div>
                  )}
                  {sourceState.key === sourceKey && sourceState.status === 'error' && (
                    <div className="af-preview-error" role="status">
                      <div className="af-preview-error-mark" aria-hidden="true">!</div>
                      <strong>Source unavailable</strong>
                      <p>{sourceState.message}</p>
                      <button className="af-btn af-btn-secondary" type="button" onClick={() => setSourceReloadTick((n) => n + 1)}><ReloadIcon size={17} /> Reload</button>
                    </div>
                  )}
                  {sourceState.key === sourceKey && sourceState.status === 'ready' && <pre><code>{sourceState.html}</code></pre>}
                </div>
              )}
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
      <ArtifactOptionsSheet
        open={optionsOpen}
        busy={Boolean(busy)}
        onClose={() => setOptionsOpen(false)}
        onCopy={copyHtml}
        onDownload={downloadHtml}
        onDelete={() => {
          setOptionsOpen(false)
          setDeleteOpen(true)
        }}
      />
      <DeleteSheet open={deleteOpen} title={record.title} busy={busy === 'delete'} onClose={() => setDeleteOpen(false)} onDelete={deleteArtifact} />
      {toast && <div className={`af-toast${toast.tone ? ` is-${toast.tone}` : ''}`} role="status" key={toast.key}>{toast.message}</div>}
    </div>
  )
}
