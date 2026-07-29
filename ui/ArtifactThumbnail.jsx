import React, { useEffect, useMemo, useRef, useState } from 'react'
import { versionPath } from '../domain.js'

function staticPreviewDocument(source) {
  const parser = new DOMParser()
  const document = parser.parseFromString(source, 'text/html')
  document.querySelectorAll(
    'script, iframe, frame, object, embed, portal, base, link[rel="stylesheet"], meta[http-equiv="refresh"]',
  ).forEach((node) => node.remove())

  const policy = document.createElement('meta')
  policy.httpEquiv = 'Content-Security-Policy'
  policy.content = "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src 'none'; frame-src 'none'; connect-src 'none'"
  document.head.prepend(policy)
  return `<!doctype html>${document.documentElement.outerHTML}`
}

export function ArtifactThumbnail({ artifact, storage }) {
  const hostRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState({ status: 'idle', html: '' })
  const version = Number(artifact.current_version) || 1

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true)
    }, { rootMargin: '800px 0px' })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || state.status === 'ready' || state.status === 'fallback') {
      return undefined
    }
    let active = true
    setState({ status: 'loading', html: '' })
    storage.getText(versionPath(artifact.id, version))
      .then((source) => {
        if (!active) return
        if (source == null) throw new Error('Preview source is missing.')
        setState({ status: 'staged', html: staticPreviewDocument(source) })
      })
      .catch(() => {
        if (active) setState({ status: 'fallback', html: '' })
      })
    return () => { active = false }
  }, [artifact.id, storage, version, visible])

  const title = useMemo(() => `Preview of ${artifact.title || 'artifact'}`, [artifact.title])

  return (
    <div ref={hostRef} className="af-card-preview" aria-hidden="true">
      <div className="af-card-preview-backing" />
      {(state.status === 'staged' || state.status === 'ready') && (
        <iframe
          className={state.status === 'ready' ? 'is-ready' : ''}
          title={title}
          sandbox=""
          srcDoc={state.html}
          tabIndex="-1"
          onLoad={() => setState((current) => current.status === 'staged'
            ? { ...current, status: 'ready' }
            : current)}
        />
      )}
    </div>
  )
}
