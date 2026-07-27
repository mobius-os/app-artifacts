import React from 'react'
import { ChevronRightIcon } from './Icons.jsx'
import { ArtifactThumbnail } from './ArtifactThumbnail.jsx'

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function ArtifactCard({ artifact, shared, storage, previewPaused, onOpen }) {
  const version = Number(artifact.current_version) || 1
  return (
    <article className="af-card">
      <ArtifactThumbnail artifact={artifact} storage={storage} paused={previewPaused} />
      <div className="af-card-body">
        <span className="af-card-main">
          <span className="af-card-topline">
            <span className="af-card-title">{artifact.title || 'Untitled artifact'}</span>
            {shared && <span className="af-badge af-badge-shared">Shared</span>}
          </span>
          {artifact.description && <span className="af-card-description">{artifact.description}</span>}
          <span className="af-card-meta">
            <span className="af-chip">v{version}</span>
            <span>{formatDate(artifact.updated_at || artifact.created_at)}</span>
          </span>
        </span>
        <span className="af-card-chevron" aria-hidden="true"><ChevronRightIcon size={18} /></span>
      </div>
      <button
        type="button"
        className="af-card-open"
        onClick={() => onOpen(artifact.id)}
        aria-label={`Open ${artifact.title || 'artifact'}, version ${version}`}
      />
    </article>
  )
}
