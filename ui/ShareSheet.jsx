import React, { useEffect, useRef } from 'react'
import { ArrowUpRightIcon, ChatIcon, CopyIcon, DownloadIcon, ShareIcon, TrashIcon } from './Icons.jsx'

function useSheetFocus(open, busy, onClose) {
  const sheetRef = useRef(null)
  const busyRef = useRef(busy)
  const closeRef = useRef(onClose)
  busyRef.current = busy
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return undefined
    const previous = document.activeElement
    const focusable = () => Array.from(sheetRef.current?.querySelectorAll('button:not(:disabled), a[href]') || [])
    const timer = window.setTimeout(() => focusable()[0]?.focus(), 0)
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown)
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [open])
  return sheetRef
}

export function ShareSheet({
  open,
  artifact,
  share,
  busy,
  needsUpdate,
  onClose,
  onPublish,
  onCopy,
  onStop,
}) {
  const sheetRef = useSheetFocus(open, busy, onClose)
  if (!open) return null
  const current = Number(artifact?.current_version) || 1
  const shared = Boolean(share?.published)
  return (
    <div className="af-scrim" role="presentation" onClick={busy ? undefined : onClose}>
      <section
        ref={sheetRef}
        className="af-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="af-share-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="af-sheet-handle" aria-hidden="true" />
        <div className="af-sheet-heading">
          <span className="af-sheet-icon" aria-hidden="true"><ShareIcon size={21} /></span>
          <div>
            <h2 id="af-share-title">{shared ? 'Shared artifact' : 'Share this artifact'}</h2>
            <p>{shared
              ? (share.recovered
                // Recovered from the platform's token hint after the share
                // record was lost — the version only ever lived in that record,
                // so claim nothing about it.
                ? 'This artifact has a public link, but its saved share details were lost. Stop sharing to take it down.'
                : `Public snapshot: version ${share.shared_version}`)
              : `Publish version ${current} as a public snapshot.`}</p>
          </div>
        </div>

        {shared && (
          <div className="af-share-url">
            <span>{share.url}</span>
            <button className="af-btn af-btn-icon" type="button" aria-label="Copy public link" onClick={onCopy}>
              <CopyIcon size={18} />
            </button>
          </div>
        )}

        {shared && share.url && (
          <a className="af-btn af-btn-secondary af-btn-block" href={share.url} target="_blank" rel="noopener noreferrer">
            Open public page <ArrowUpRightIcon size={17} />
          </a>
        )}

        <div className="af-sheet-actions is-stacked">
          {!shared && (
            <button className="af-btn af-btn-primary af-btn-block" type="button" onClick={() => onPublish(current)} disabled={busy}>
              {busy ? 'Publishing…' : `Share version ${current}`}
            </button>
          )}
          {shared && needsUpdate && (
            <button className="af-btn af-btn-primary af-btn-block" type="button" onClick={() => onPublish(current)} disabled={busy}>
              {busy ? 'Updating…' : `Update shared version to v${current}`}
            </button>
          )}
          {shared && (
            <button className="af-btn af-btn-danger-ghost af-btn-block" type="button" onClick={onStop} disabled={busy}>
              {busy ? 'Stopping…' : 'Stop sharing'}
            </button>
          )}
          <button className="af-btn af-btn-ghost af-btn-block" type="button" onClick={onClose} disabled={busy}>Done</button>
        </div>
      </section>
    </div>
  )
}

export function ArtifactOptionsSheet({
  open,
  busy,
  description,
  originLabel,
  originDisabled,
  shareLabel,
  shareDescription,
  onClose,
  onShare,
  onOpenOrigin,
  onCopy,
  onDownload,
  onDelete,
}) {
  const sheetRef = useSheetFocus(open, busy, onClose)
  if (!open) return null
  return (
    <div className="af-scrim" role="presentation" onClick={busy ? undefined : onClose}>
      <section
        ref={sheetRef}
        className="af-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="af-options-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="af-sheet-handle" aria-hidden="true" />
        <h2 id="af-options-title">Artifact options</h2>
        {description && <p className="af-sheet-copy af-options-description">{description}</p>}
        <div className="af-option-list">
          <button className="af-option" type="button" onClick={onShare} disabled={busy}>
            <span className="af-option-icon" aria-hidden="true"><ShareIcon /></span>
            <span><strong>{shareLabel}</strong><small>{shareDescription}</small></span>
          </button>
          <button className="af-option" type="button" onClick={onOpenOrigin} disabled={busy || originDisabled}>
            <span className="af-option-icon" aria-hidden="true"><ChatIcon /></span>
            <span><strong>Open origin chat</strong><small>{originLabel}</small></span>
          </button>
          <button className="af-option" type="button" onClick={onCopy} disabled={busy}>
            <span className="af-option-icon" aria-hidden="true"><CopyIcon /></span>
            <span><strong>Copy HTML</strong><small>Copy the selected version as plain text</small></span>
          </button>
          <button className="af-option" type="button" onClick={onDownload} disabled={busy}>
            <span className="af-option-icon" aria-hidden="true"><DownloadIcon /></span>
            <span><strong>Download HTML (includes scripts)</strong><small>Scripts may run when the downloaded file is opened</small></span>
          </button>
          <button className="af-option is-danger" type="button" onClick={onDelete} disabled={busy}>
            <span className="af-option-icon" aria-hidden="true"><TrashIcon /></span>
            <span><strong>Delete…</strong><small>Remove every version and public share</small></span>
          </button>
        </div>
        <div className="af-sheet-actions">
          <button className="af-btn af-btn-secondary" type="button" onClick={onClose} disabled={busy}>Done</button>
        </div>
      </section>
    </div>
  )
}

export function DeleteSheet({ open, title, busy, onClose, onDelete }) {
  const sheetRef = useSheetFocus(open, busy, onClose)
  if (!open) return null
  return (
    <div className="af-scrim" role="presentation" onClick={busy ? undefined : onClose}>
      <section
        ref={sheetRef}
        className="af-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="af-delete-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="af-sheet-handle" aria-hidden="true" />
        <h2 id="af-delete-title">Delete “{title || 'Untitled artifact'}”?</h2>
        <p className="af-sheet-copy">This removes every version and stops public sharing. This action cannot be undone.</p>
        <div className="af-sheet-actions">
          <button className="af-btn af-btn-secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="af-btn af-btn-danger" type="button" onClick={onDelete} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete artifact'}
          </button>
        </div>
      </section>
    </div>
  )
}
