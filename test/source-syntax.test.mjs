import test from 'node:test'
import assert from 'node:assert/strict'

import { sourceKind, sourceTokens } from '../source-syntax.js'

test('highlights artifact HTML tags, strings, comments, and embedded source', () => {
  assert.equal(sourceKind('artifact.html'), 'html')
  const tokens = sourceTokens(
    'artifact.html',
    '<!-- note --><main class="hero"><script>const ready = true</script></main>',
  )
  assert.deepEqual(tokens.map((token) => token.className), [
    'cm-syn-comment',
    'cm-syn-tag',
    'cm-syn-keyword',
    'cm-syn-string',
    'cm-syn-tag',
    'cm-syn-keyword',
    'cm-syn-literal',
    'cm-syn-tag',
    'cm-syn-tag',
  ])
})

test('does not treat CSS hex colours as comments or numbers', () => {
  const tokens = sourceTokens('artifact.html', '<style>.hero { color: #1598bc; width: 12px; }</style>')
  const numbers = tokens.filter((token) => token.className === 'cm-syn-number')
  assert.equal(numbers.length, 1)
})
