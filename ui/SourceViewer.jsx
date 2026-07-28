import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'
import { sourceKind, sourceTokens } from '../source-syntax.js'

const sourceTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'transparent', color: 'var(--text)' },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'var(--mono)',
    lineHeight: '1.6',
    fontSize: '13.5px',
  },
  '.cm-content': { padding: '14px 16px 30vh' },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
  },
  '.cm-syn-comment': { color: 'var(--code-comment)', fontStyle: 'italic' },
  '.cm-syn-string': { color: 'var(--code-string)' },
  '.cm-syn-keyword': { color: 'var(--code-keyword)', fontWeight: '650' },
  '.cm-syn-literal': { color: 'var(--code-literal)' },
  '.cm-syn-number': { color: 'var(--code-number)' },
  '.cm-syn-tag': { color: 'var(--code-tag)' },
})

function sourceHighlight(path) {
  if (!sourceKind(path)) return []
  return ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = this.build(view) }
    update(update) {
      if (update.docChanged || update.viewportChanged) this.decorations = this.build(update.view)
    }
    build(view) {
      const marks = []
      for (const { from, to } of view.visibleRanges) {
        const text = view.state.sliceDoc(from, to)
        for (const token of sourceTokens(path, text)) {
          marks.push(Decoration.mark({ class: token.className }).range(from + token.from, from + token.to))
        }
      }
      return Decoration.set(marks, true)
    }
  }, { decorations: (plugin) => plugin.decorations })
}

/** A read-only CodeMirror surface matching Web Studio's source presentation. */
export function SourceViewer({ value, docKey, label }) {
  const host = useRef(null)

  useEffect(() => {
    const state = EditorState.create({
      doc: value || '',
      extensions: [
        sourceHighlight('artifact.html'),
        EditorView.lineWrapping,
        sourceTheme,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
      ],
    })
    const view = new EditorView({ state, parent: host.current })
    return () => view.destroy()
  }, [docKey, value])

  return <div ref={host} className="af-cm-host" role="region" aria-label={label} />
}
