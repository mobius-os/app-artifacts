import React from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { ArtifactIcon, ChevronRightIcon } from './Icons.jsx'

function relativeTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'recently'
  return formatDistanceToNowStrict(date, { addSuffix: true })
}

export function ArtifactCard({ artifact, shared, onOpen }) {
  const version = Number(artifact.current_version) || 1
  return (
    <button
      type="button"
      className="af-card"
      onClick={() => onOpen(artifact.id)}
      aria-label={`Open ${artifact.title || 'artifact'}, version ${version}`}
    >
      <span className="af-card-icon" aria-hidden="true"><ArtifactIcon size={21} /></span>
      <span className="af-card-main">
        <span className="af-card-topline">
          <span className="af-card-title">{artifact.title || 'Untitled artifact'}</span>
          {shared && <span className="af-badge af-badge-shared">Shared</span>}
        </span>
        {artifact.description && <span className="af-card-description">{artifact.description}</span>}
        <span className="af-card-meta">
          <span className="af-chip">v{version}</span>
          <span>{relativeTime(artifact.updated_at || artifact.created_at)}</span>
        </span>
      </span>
      <span className="af-card-chevron" aria-hidden="true"><ChevronRightIcon size={18} /></span>
    </button>
  )
}
