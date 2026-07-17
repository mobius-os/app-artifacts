import React from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { CheckIcon, ChevronDownIcon } from './Icons.jsx'

function relativeTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'
  return formatDistanceToNowStrict(date, { addSuffix: true })
}

function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function VersionTimeline({ versions, currentVersion, selectedVersion, onSelect }) {
  const ordered = [...(Array.isArray(versions) ? versions : [])]
    .sort((a, b) => Number(b.v) - Number(a.v))
  if (!ordered.length) return null

  return (
    <details className="af-disc">
      <summary>
        <span>Version history</span>
        <span className="af-disc-count">{ordered.length}</span>
        <ChevronDownIcon className="af-disc-chevron" size={18} />
      </summary>
      <div className="af-timeline">
        {ordered.map((item) => {
          const selected = Number(item.v) === Number(selectedVersion)
          return (
            <button
              key={item.v}
              type="button"
              className={`af-version${selected ? ' is-selected' : ''}`}
              onClick={() => onSelect(Number(item.v))}
              aria-pressed={selected}
            >
              <span className="af-version-rail" aria-hidden="true">
                <span className="af-version-dot">{selected && <CheckIcon size={12} />}</span>
              </span>
              <span className="af-version-content">
                <span className="af-version-title">
                  Version {item.v}
                  {Number(item.v) === Number(currentVersion) && <span className="af-chip">Current</span>}
                </span>
                {item.note && <span className="af-version-note">{item.note}</span>}
                <span className="af-version-meta">{relativeTime(item.created_at)} · {formatBytes(item.bytes)}</span>
              </span>
            </button>
          )
        })}
      </div>
    </details>
  )
}
