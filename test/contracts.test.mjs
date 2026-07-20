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

test('storage bridge identifies only the mounted opaque preview frame', async () => {
  const source = await readSource('index.jsx')
  assert.match(source, /event\.source !== mounted\.frame\.contentWindow/)
  assert.doesNotMatch(source, /event\.origin\s*===/)
  assert.match(source, /planArtifactStorageRequest\(message, mounted\)/)
})

test('published staging injects storage without changing immutable version HTML', async () => {
  const source = await readSource('ui/Detail.jsx')
  assert.match(source, /injectArtifactStorageShim\(html, \{ variant: 'published' \}\)/)
  assert.match(source, /setText\(`projects\/\$\{record\.id\}\/build\/site\/index\.html`, publishedHtml\)/)
})

test('the in-flight storage cap is never reset on frame remount', async () => {
  // Entries drain when each request settles, so clearing the set on remount
  // would reset the cap while the old document's fetches are still queued —
  // letting a reload admit another full batch of up-to-64KB values on top.
  const source = await readSource('index.jsx')
  assert.doesNotMatch(
    source,
    /storageRequestsRef\.current\.clear\(\)/,
    'the pending-request set must drain naturally, never be cleared',
  )
  assert.match(source, /storageRequestsRef\.current\.delete\(pendingKey\)/)
})

test('gallery records are id-validated before they reach storage paths', async () => {
  // A record id read from artifacts/ is interpolated into storage paths and
  // request URLs; only deep-linked ids used to be validated.
  const source = await readSource('ui/Gallery.jsx')
  assert.match(source, /isValidProjectId/, 'Gallery must validate record ids')
  assert.match(
    source,
    /filter\(\(value\) => isValidProjectId\(value\?\.id\)\)/,
    'records must be filtered by a valid artifact id before use',
  )
})

test('a recovered share is presented without inventing a version', async () => {
  const source = await readSource('ui/ShareSheet.jsx')
  assert.match(source, /share\.recovered/, 'the sheet must branch on a recovered share')
  // The lost record held the only copy of the shared version.
  assert.doesNotMatch(
    source,
    /version \$\{share\.shared_version\}[^}]*recovered/,
    'a recovered share must not claim a version',
  )
})

test('the app maintains no client-side key index', async () => {
  // Two tabs each read the old index, wrote their own key, and the second index
  // write dropped the first — a value that existed but could not be listed.
  // Enumeration is server-derived now, so nothing may write the index key.
  const source = await readSource('index.jsx')
  assert.doesNotMatch(
    source,
    /artifactDataSet\(\s*\n?\s*plan\.artifactId,\s*\n?\s*ARTIFACT_STORAGE_INDEX_KEY/,
    'set() must not write a key index',
  )
  assert.doesNotMatch(
    source,
    /artifactDataRemove\(plan\.artifactId,\s*ARTIFACT_STORAGE_INDEX_KEY\)/,
    'remove() must not rewrite a key index',
  )
  // list() goes to the server-derived collection.
  assert.match(source, /storage\.artifactDataKeys\(artifactId\)/)

  const storage = await readSource('storage.js')
  assert.match(
    storage,
    /\/api\/apps\/\$\{appId\}\/artifact-data\/\$\{encodeURIComponent\(artifactId\)\}/,
    'the collection read must target the artifact-data collection route',
  )
})
