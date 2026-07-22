import React, { useEffect, useRef, useState } from 'react'
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
  const [expanded, setExpanded] = useState(false)
  const items = Array.isArray(versions) ? versions : []
  if (!items.length) return null
  const ordered = expanded
    ? [...items].sort((a, b) => Number(b.v) - Number(a.v))
    : null

  return (
    <details className="af-disc" onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary>
        <span>Version history</span>
        <span className="af-disc-count">{items.length}</span>
        <ChevronDownIcon className="af-disc-chevron" size={18} />
      </summary>
      {expanded && <div className="af-timeline">
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
      </div>}
    </details>
  )
}

export function VersionSheet({ open, versions, currentVersion, selectedVersion, onSelect, onClose }) {
  const sheetRef = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const previous = document.activeElement
    const timer = window.setTimeout(() => sheetRef.current?.querySelector('button')?.focus(), 0)
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown)
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [open, onClose])

  if (!open) return null
  const ordered = [...(Array.isArray(versions) ? versions : [])]
    .sort((a, b) => Number(b.v) - Number(a.v))

  return (
    <div className="af-scrim" role="presentation" onClick={onClose}>
      <section
        ref={sheetRef}
        className="af-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="af-versions-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="af-sheet-handle" aria-hidden="true" />
        <h2 id="af-versions-title">Version history</h2>
        <div className="af-timeline af-version-sheet-list">
          {ordered.map((item) => {
            const selected = Number(item.v) === Number(selectedVersion)
            return (
              <button
                key={item.v}
                type="button"
                className={`af-version${selected ? ' is-selected' : ''}`}
                onClick={() => {
                  onSelect(Number(item.v))
                  onClose()
                }}
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
        <div className="af-sheet-actions">
          <button className="af-btn af-btn-secondary" type="button" onClick={onClose}>Done</button>
        </div>
      </section>
    </div>
  )
}
