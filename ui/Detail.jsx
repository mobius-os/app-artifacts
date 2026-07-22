import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  artifactFilename,
  injectArtifactStorageShim,
  shareNeedsUpdate,
  publishedShare,
  stoppedShare,
  versionPath,
  isValidShareToken,
  recoveredShare,
} from '../domain.js'
import { loadChatTitles } from '../storage.js'
import { ArtifactFrame } from '../preview/ArtifactFrame.jsx'
import { VersionSheet } from './VersionTimeline.jsx'
import { ArtifactOptionsSheet, DeleteSheet, ShareSheet } from './ShareSheet.jsx'
import {
  ArrowLeftIcon,
  CodeIcon,
  EyeIcon,
  MoreIcon,
  ReloadIcon,
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

export function Detail({ artifactId, storage, token, onPreviewFrame, onClose, onDeleted }) {
  const [record, setRecord] = useState(null)
  const [share, setShare] = useState(null)
  const [shareKnown, setShareKnown] = useState(false)
  const [status, setStatus] = useState('loading')
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [sourceReloadTick, setSourceReloadTick] = useState(0)
  const [viewMode, setViewMode] = useState('preview')
  const [sourceState, setSourceState] = useState({ key: '', status: 'idle', html: '', message: '' })
  const [shareOpen, setShareOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [toast, setToast] = useState(null)
  const [chatInfo, setChatInfo] = useState({ permission: 'loading', title: null })

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
    setShare(null)
    setShareKnown(false)
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
    // The platform writes a publish token hint into the app's OWN storage, so
    // an absent shares/<id>.json does not prove nothing is public: a failed
    // record write, or a lost record, would otherwise strand a live page with
    // no in-app way to revoke it. Read the hint once per artifact and recover
    // the token from it.
    let hintChecked = false
    const recoverFromHint = async () => {
      if (hintChecked) return null
      let raw
      try {
        raw = await storage.getText(
          `projects/${artifactId}/build/publish-token.txt`,
        )
      } catch {
        // Transient read failure: do NOT latch, so the next poll retries rather
        // than permanently giving up on recovering a still-live share.
        return null
      }
      hintChecked = true
      const token = String(raw || '').trim()
      if (!isValidShareToken(token)) return null
      return recoveredShare({ id: artifactId, token })
    }
    const acceptShare = (value) => {
      if (!active) return
      if (value) {
        setShare(value)
        setShareKnown(true)
        return
      }
      // Keep a recovered share visible: the poll re-reads the still-missing
      // record every few seconds, and clearing would make Stop sharing flicker
      // away from a page that is genuinely still live.
      setShare((current) => (current?.recovered ? current : null))
      setShareKnown(true)
      recoverFromHint().then((recovered) => {
        if (!active || !recovered) return
        setShare((current) => (current?.published ? current : recovered))
      })
    }
    const unsubscribeRecord = storage.subscribe(recordPath, acceptRecord)
    const unsubscribeShare = storage.subscribe(sharePath, acceptShare)
    storage.getFresh(recordPath).then(acceptRecord).catch((error) => {
      if (active) {
        setStatus('error')
        showToast(error?.message || 'Artifact could not be loaded.', 'error')
      }
    })
    storage.getFresh(sharePath).then(acceptShare).catch(() => {})
    const refresh = async () => {
      if (refreshing || document.visibilityState === 'hidden') return
      refreshing = true
      try {
        const [nextRecord, nextShareResult] = await Promise.all([
          storage.getFresh(recordPath),
          storage.getFresh(sharePath)
            .then((value) => ({ loaded: true, value }))
            .catch(() => ({ loaded: false, value: null })),
        ])
        acceptRecord(nextRecord)
        if (nextShareResult.loaded) acceptShare(nextShareResult.value)
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

  async function readVersionHtml(version) {
    const html = await storage.getText(versionPath(record.id, version))
    if (html == null) throw new Error(`Version ${version} is missing.`)
    return html
  }

  async function stageVersion(version) {
    const html = await readVersionHtml(version)
    await storage.removeFolder(`projects/${record.id}/build/site`)
    const publishedHtml = injectArtifactStorageShim(html, { variant: 'published' })
    await storage.setText(`projects/${record.id}/build/site/index.html`, publishedHtml)
  }

  async function publish(version) {
    if (!record || busy) return
    setBusy('publish')
    const updating = Boolean(share?.published)
    try {
      await stageVersion(version)
      const result = await storage.publish(record.id)
      // The snapshot is live now; that is the source of truth. Reflect it in
      // the UI immediately, then persist the share record BEST-EFFORT. If that
      // write fails, the platform already wrote a token hint into the project
      // that recoverFromHint reads back on the next load — so there is nothing
      // to compensate, and the old rollback dance (which also mis-staged a
      // recovered share's null version) is gone.
      const next = publishedShare({
        id: record.id, version, token: result.token, url: result.url,
      })
      setShare(next)
      setShareKnown(true)
      showToast(updating ? `Shared version updated to v${version}.` : 'Public link created.', 'success')
      try {
        await storage.setJSON(`shares/${record.id}.json`, next)
      } catch { /* live + recoverable from the token hint; nothing to undo */ }
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
      // The URL is dead now — reflect it before the metadata write so a failed
      // record save cannot leave the UI stuck showing a live share for a link
      // that is already gone.
      const next = stoppedShare(share)
      setShare(next)
      setShareKnown(true)
      showToast('Public link removed.', 'success')
      try {
        await storage.setJSON(`shares/${record.id}.json`, next)
      } catch { /* the link is down; a stale record self-heals on next load */ }
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
      if (!shareKnown || share?.published) {
        try {
          await storage.unpublish(record.id)
        } catch {
          showToast('Couldn\'t revoke the public link \u2014 try again', 'error')
          setBusy('')
          return
        }
      }
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
    setOptionsOpen(false)
    postToShell({ type: 'moebius:open-chat', chatId: record.chat_id })
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
        <button className="af-detail-heading" type="button" onClick={() => setVersionsOpen(true)} aria-label={`Choose artifact version, currently ${previewVersion}`}>
          <h1>{record.title || 'Untitled artifact'}</h1>
          <span>{previewVersion === currentVersion ? `v${currentVersion}` : `Viewing v${previewVersion}`}</span>
        </button>
        <div className="af-view-toggle" role="group" aria-label="Artifact view">
          <button className={viewMode === 'preview' ? 'is-active' : ''} type="button" aria-pressed={viewMode === 'preview'} aria-label="Preview" title="Preview" onClick={() => setViewMode('preview')}><EyeIcon size={20} /></button>
          <button className={viewMode === 'source' ? 'is-active' : ''} type="button" aria-pressed={viewMode === 'source'} aria-label="Source" title="Source" onClick={() => setViewMode('source')}><CodeIcon size={20} /></button>
        </div>
        <button className={`af-btn af-btn-icon af-btn-ghost af-header-action${needsUpdate ? ' has-update' : ''}`} type="button" onClick={() => setOptionsOpen(true)} aria-label="Artifact options"><MoreIcon /></button>
      </header>

      <main className="af-artifact-stage">
        {viewMode === 'preview'
          ? (
            <ArtifactFrame
              artifactId={record.id}
              version={previewVersion}
              storage={storage}
              onPreviewFrame={onPreviewFrame}
              writable={previewVersion === currentVersion}
            />
          )
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
      </main>

      <ShareSheet open={shareOpen} artifact={record} share={publicShare} busy={Boolean(busy)} needsUpdate={needsUpdate} onClose={() => setShareOpen(false)} onPublish={publish} onCopy={copyLink} onStop={stopSharing} />
      <ArtifactOptionsSheet
        open={optionsOpen}
        busy={Boolean(busy)}
        description={record.description}
        originLabel={deletedChat ? 'Chat deleted' : showChatTitle && fromLabel ? `From: ${fromLabel}` : 'Return to the conversation'}
        originDisabled={deletedChat}
        shareLabel={share?.published ? 'Manage sharing' : 'Share'}
        shareDescription={share?.published ? (needsUpdate ? `Update public link to v${currentVersion}` : 'Public link is current') : 'Publish a public snapshot'}
        onClose={() => setOptionsOpen(false)}
        onShare={() => {
          setOptionsOpen(false)
          setShareOpen(true)
        }}
        onOpenOrigin={openOriginChat}
        onCopy={copyHtml}
        onDownload={downloadHtml}
        onDelete={() => {
          setOptionsOpen(false)
          setDeleteOpen(true)
        }}
      />
      <VersionSheet
        open={versionsOpen}
        versions={record.versions}
        currentVersion={currentVersion}
        selectedVersion={previewVersion}
        onSelect={(version) => setSelectedVersion(version === currentVersion ? null : version)}
        onClose={() => setVersionsOpen(false)}
      />
      <DeleteSheet open={deleteOpen} title={record.title} busy={busy === 'delete'} onClose={() => setDeleteOpen(false)} onDelete={deleteArtifact} />
      {toast && <div className={`af-toast${toast.tone ? ` is-${toast.tone}` : ''}`} role="status" key={toast.key}>{toast.message}</div>}
    </div>
  )
}
