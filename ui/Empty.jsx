import React from 'react'
import { ArtifactIcon, ChatIcon } from './Icons.jsx'

export function Empty({ onStartChat }) {
  return (
    <div className="af-empty">
      <div className="af-empty-mark" aria-hidden="true"><ArtifactIcon size={30} /></div>
      <h2 className="af-empty-title">Your artifacts will live here</h2>
      <p className="af-empty-text">
        Ask the agent in any chat to build an interactive page, calculator, visualization, or report.
      </p>
      <button className="af-btn af-btn-primary" type="button" onClick={onStartChat}>
        <ChatIcon size={18} /> Start a chat
      </button>
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
