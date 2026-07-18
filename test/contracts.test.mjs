import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function readSource(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8')
}

test('preview iframe keeps the exact opaque-origin sandbox boundary', async () => {
  const source = await readSource('preview/ArtifactFrame.jsx')
  const sandbox = source.match(/\bsandbox="([^"]+)"/)
  assert.ok(sandbox, 'preview iframe must declare a literal sandbox')
  assert.equal(sandbox[1], 'allow-scripts allow-popups allow-popups-to-escape-sandbox')
  assert.doesNotMatch(sandbox[1], /allow-same-origin|allow-downloads/)
})

test('app source contains no removed new-chat handoff', async () => {
  const manifest = JSON.parse(await readSource('mobius.json'))
  const sourceFiles = [...new Set([manifest.entry, ...manifest.source_files])]
  const forbiddenHandoff = ['moebius', 'new-chat'].join(':')
  for (const file of sourceFiles) {
    assert.doesNotMatch(await readSource(file), new RegExp(forbiddenHandoff), file)
  }
})

test('source view renders HTML as text inside pre and code elements', async () => {
  const source = await readSource('ui/Detail.jsx')
  assert.match(source, /<pre><code>\{sourceState\.html\}<\/code><\/pre>/)
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/)
})

test('manifest keeps the Artifacts system prompt wiring', async () => {
  const manifest = JSON.parse(await readSource('mobius.json'))
  assert.equal(manifest.system_app, true)
  assert.equal(manifest.system_prompt, 'artifacts-core.md')
  assert.ok(manifest.source_files.includes('artifacts-core.md'))
})
