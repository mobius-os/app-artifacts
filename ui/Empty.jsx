import React from 'react'
import { ArtifactIcon } from './Icons.jsx'

export function Empty() {
  return (
    <div className="af-empty">
      <div className="af-empty-mark" aria-hidden="true"><ArtifactIcon size={30} /></div>
      <h2 className="af-empty-title">Your artifacts will live here</h2>
      <p className="af-empty-text">
        Ask the agent in any chat to build an interactive page, a visualization, or a polished document or report, and it will show up here to preview, version, and share.
      </p>
    </div>
  )
}

export function LoadError({ message, onRetry }) {
  return (
    <div className="af-empty af-empty-compact" role="status">
      <div className="af-empty-mark is-error" aria-hidden="true">!</div>
      <h2 className="af-empty-title">Artifacts could not be loaded</h2>
      <p className="af-empty-text">{message || 'Check your connection and try again.'}</p>
      <button className="af-btn af-btn-secondary" type="button" onClick={onRetry}>Try again</button>
    </div>
  )
}
