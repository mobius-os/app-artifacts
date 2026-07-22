import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ReloadIcon } from '../ui/Icons.jsx'
import { injectArtifactStorageShim, versionPath } from '../domain.js'

export function ArtifactFrame({
  artifactId,
  version,
  storage,
  onPreviewFrame,
  writable = true,
  reloadTick = 0,
}) {
  const [state, setState] = useState({ status: 'loading', html: null, message: '' })
  const [localReload, setLocalReload] = useState(0)

  useEffect(() => {
    let active = true
    setState({ status: 'loading', html: null, message: '' })
    storage.getText(versionPath(artifactId, version))
      .then((html) => {
        if (!active) return
        if (html == null) throw new Error(`Version ${version} is missing.`)
        setState({ status: 'ready', html, message: '' })
      })
      .catch((error) => {
        if (active) setState({
          status: 'error',
          html: null,
          message: error?.message || 'This artifact could not be rendered.',
        })
      })
    return () => { active = false }
  }, [artifactId, version, storage, reloadTick, localReload])

  // One key per staged document, handed to the parent bridge as this frame's
  // proof of identity. Regenerated whenever the document is rebuilt, so a
  // stale key cannot outlive the document it was minted for.
  const preview = useMemo(() => {
    if (state.html == null) return { html: null, sessionKey: '' }
    const bytes = new Uint32Array(4)
    try { crypto.getRandomValues(bytes) } catch {
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 4294967296)
      }
    }
    const sessionKey = Array.from(bytes, (n) => n.toString(36)).join('-')
    return {
      html: injectArtifactStorageShim(state.html, {
        variant: 'preview', writable, sessionKey,
      }),
      sessionKey,
    }
  }, [state.html, writable])
  const previewHtml = preview.html

  const registerFrame = useCallback((frame) => {
    onPreviewFrame?.(frame, {
      artifactId, writable, sessionKey: preview.sessionKey,
    })
  }, [artifactId, onPreviewFrame, writable, preview.sessionKey])

  return (
    <div className="af-preview">
      {state.status === 'loading' && (
        <div className="af-preview-loading" aria-label="Loading artifact preview">
          <div className="af-skeleton af-skeleton-window" />
        </div>
      )}
      {state.status === 'error' && (
        <div className="af-preview-error" role="status">
          <div className="af-preview-error-mark" aria-hidden="true">!</div>
          <strong>Preview unavailable</strong>
          <p>{state.message}</p>
          <button className="af-btn af-btn-secondary" type="button" onClick={() => setLocalReload((n) => n + 1)}>
            <ReloadIcon size={17} /> Reload
          </button>
        </div>
      )}
      {state.status === 'ready' && (
        <iframe
          key={`${artifactId}:${version}:${reloadTick}:${localReload}`}
          className="af-preview-frame"
          title={`Artifact preview, version ${version}`}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          srcDoc={previewHtml}
          ref={registerFrame}
        />
      )}
    </div>
  )
}
