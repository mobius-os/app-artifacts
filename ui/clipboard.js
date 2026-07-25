/** Copy text from both ordinary browsers and framed/mobile PWA contexts.
 *
 * The async Clipboard API is preferred, but it is not consistently available
 * inside app frames. The hidden textarea path runs in the same user gesture
 * and is still supported by the browsers that reject navigator.clipboard.
 */
export async function copyPlainText(text, {
  navigatorRef = globalThis.navigator,
  documentRef = globalThis.document,
} = {}) {
  if (!text) return false

  try {
    const clipboard = navigatorRef?.clipboard
    if (typeof clipboard?.writeText === 'function') {
      await clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the selection-based copy path.
  }

  if (!documentRef?.body || typeof documentRef.execCommand !== 'function') return false

  let textarea
  const previousFocus = documentRef.activeElement
  try {
    textarea = documentRef.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.setAttribute('aria-hidden', 'true')
    Object.assign(textarea.style, {
      position: 'fixed',
      inset: '0 auto auto -9999px',
      opacity: '0',
      fontSize: '16px',
    })
    documentRef.body.appendChild(textarea)
    textarea.focus({ preventScroll: true })
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)
    return documentRef.execCommand('copy') === true
  } catch {
    return false
  } finally {
    textarea?.remove()
    try { previousFocus?.focus?.({ preventScroll: true }) } catch { /* best-effort */ }
  }
}
