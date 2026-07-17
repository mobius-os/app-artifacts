import React, { useEffect, useState } from 'react'
import { ReloadIcon } from '../ui/Icons.jsx'
import { versionPath } from '../domain.js'

export function ArtifactFrame({ artifactId, version, storage, reloadTick = 0, fullscreen = false }) {
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

  return (
    <div className={`af-preview${fullscreen ? ' is-fullscreen' : ''}`}>
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
          srcDoc={state.html}
        />
      )}
    </div>
  )
}
