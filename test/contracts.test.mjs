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

test('source view delegates immutable HTML to a read-only CodeMirror surface', async () => {
  const source = await readSource('ui/Detail.jsx')
  const viewer = await readSource('ui/SourceViewer.jsx')
  assert.match(source, /<SourceViewer[\s\S]*?value=\{sourceState\.html\}[\s\S]*?docKey=\{sourceKey\}/)
  assert.match(viewer, /EditorState\.readOnly\.of\(true\)/)
  assert.match(viewer, /EditorView\.editable\.of\(false\)/)
  assert.match(viewer, /EditorView\.lineWrapping/)
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/)
})

test('artifact detail is the single full-height preview surface', async () => {
  const detail = await readSource('ui/Detail.jsx')
  const theme = await readSource('theme.js')
  assert.match(detail, /<main className="af-artifact-stage">/)
  assert.match(detail, /onShare=\{\(\) => \{[\s\S]*?setOptionsOpen\(false\)[\s\S]*?setShareOpen\(true\)/)
  assert.doesNotMatch(detail, /toggleFullscreen|artifact-preview|ExpandIcon/)
  assert.doesNotMatch(detail, /Reload preview|Version v\{previewVersion\}|af-preview-toolbar/)
  assert.match(detail, /aria-label="Preview"[\s\S]*?<EyeIcon/)
  assert.match(detail, /aria-label="Source"[\s\S]*?<CodeIcon/)
  assert.match(theme, /\.af-artifact-stage\s*\{[\s\S]*?flex:\s*1;[\s\S]*?min-height:\s*0;/)
  assert.doesNotMatch(theme, /\.af-preview-shell\.is-fullscreen/)
})

test('artifact detail chrome uses the same wide, left-led composition as map detail', async () => {
  const theme = await readSource('theme.js')
  assert.match(theme, /\.af-detail-heading\s*\{[\s\S]*?text-align:\s*left;/)
  assert.match(theme, /\.af-detail-header\s*\{ width:\s*min\(100%,\s*74rem\); \}/)
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
  assert.match(source, /setText\(`\$\{root\}\/index\.html`, publishedHtml\)/)
  assert.match(source, /setBlob\(`\$\{root\}\/\$\{ARTIFACT_PREVIEW_FILENAME\}`/)
})

test('every sharing-sheet icon used by a rendered branch remains imported', async () => {
  const source = await readSource('ui/ShareSheet.jsx')
  const imported = source.match(/import\s+\{([^}]+)\}\s+from '\.\/Icons\.jsx'/)
  assert.ok(imported, 'the shared sheet icon import must remain explicit')
  const importedNames = new Set(
    imported[1].split(',').map((name) => name.trim()).filter(Boolean),
  )
  const used = [...source.matchAll(/<([A-Z][A-Za-z]+Icon)\b/g)]
    .map((match) => match[1])
  for (const icon of used) {
    assert.ok(importedNames.has(icon), `${icon} is rendered but not imported`)
  }
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

test('gallery preview enrichment cannot make the artifact catalogue unavailable', async () => {
  const gallery = await readSource('ui/Gallery.jsx')
  assert.match(
    gallery,
    /readFolder\(storage, 'shares\/'\)\.catch\(\(\) => \[\]\)/,
    'sharing badges must fail open so records remain accessible',
  )

  const thumbnail = await readSource('ui/ArtifactThumbnail.jsx')
  assert.match(thumbnail, /sandbox=""/, 'gallery thumbnails must not run artifact scripts')
  assert.match(thumbnail, /default-src 'none'/, 'thumbnail documents must block network loading')
  assert.match(thumbnail, /\.catch\(\(\) => \{[\s\S]*status: 'fallback'/)
})

test('artifact previews keep their placeholder until the staged frame has painted', async () => {
  const detailFrame = await readSource('preview/ArtifactFrame.jsx')
  const thumbnail = await readSource('ui/ArtifactThumbnail.jsx')
  const theme = await readSource('theme.js')

  assert.match(detailFrame, /status: 'staged'/)
  assert.match(detailFrame, /state\.status === 'loading' \|\| state\.status === 'staged'/)
  assert.match(detailFrame, /onLoad=\{showPreview\}/)
  assert.match(detailFrame, /state\.status === 'ready' \? ' is-ready' : ''/)

  assert.match(thumbnail, /status: 'staged'/)
  assert.match(thumbnail, /af-card-preview-backing/)
  assert.match(thumbnail, /onLoad=\{\(\) => setState/)
  assert.match(thumbnail, /state\.status === 'ready' \? 'is-ready' : ''/)

  assert.match(theme, /\.af-card-preview iframe \{[\s\S]*opacity: 0;/)
  assert.match(theme, /\.af-card-preview iframe\.is-ready \{ opacity: 1; \}/)
  assert.match(theme, /\.af-preview-frame \{[\s\S]*opacity: 0;/)
  assert.match(theme, /\.af-preview-frame\.is-ready \{ opacity: 1; \}/)
})

test('scrolling never blanks or pauses artifact preview frames', async () => {
  const gallery = await readSource('ui/Gallery.jsx')
  const card = await readSource('ui/ArtifactCard.jsx')
  const thumbnail = await readSource('ui/ArtifactThumbnail.jsx')
  const theme = await readSource('theme.js')

  assert.doesNotMatch(gallery, /previewPaused|pausePreviewsWhileScrolling|onScroll=/)
  assert.doesNotMatch(card, /previewPaused|paused=/)
  assert.doesNotMatch(thumbnail, /\bpaused\b/)
  assert.match(thumbnail, /rootMargin: '800px 0px'/)
  assert.match(thumbnail, /af-card-preview-backing/)
  assert.match(theme, /\.af-card-preview iframe \{[\s\S]*background: transparent;/)
  assert.match(theme, /\.af-card-preview iframe \{[\s\S]*z-index: 1;/)
  assert.match(theme, /\.af-card-preview-backing \{[\s\S]*z-index: 0;/)
  assert.doesNotMatch(
    theme.match(/\.af-card \{[\s\S]*?\n\}/)?.[0] || '',
    /content-visibility|contain-intrinsic-size/,
    'nested preview frames must remain painted when their card leaves the viewport',
  )
})

test('chat deep links reuse the shell Back entry instead of adding a gallery stop', async () => {
  const source = await readSource('index.jsx')
  assert.match(source, /openDetail\(id, \{ ownBackEntry: false \}\)/)
  assert.match(
    source,
    /if \(!ownBackEntry\) \{[\s\S]*setSelectedId\(id\)[\s\S]*return[\s\S]*\}\n    if \(id === selectedId\) return/,
  )
})

test('detail navigation preserves the painted gallery instead of rebuilding it', async () => {
  const source = await readSource('index.jsx')
  const gallery = await readSource('ui/Gallery.jsx')
  const theme = await readSource('theme.js')

  assert.match(source, /<Gallery[\s\S]*inactive=\{Boolean\(selectedId\)\}[\s\S]*\/>[\s\S]*\{selectedId && \(/)
  assert.match(gallery, /aria-hidden=\{inactive \|\| undefined\}/)
  assert.match(gallery, /inert=\{inactive \|\| undefined\}/)
  assert.match(gallery, /if \(inactive\) return undefined[\s\S]*load\(\)/)
  assert.doesNotMatch(gallery, /aria-label="Loading artifacts"/)
  assert.match(theme, /\.af-detail \{[\s\S]*position: absolute;[\s\S]*z-index: 2;/)
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
  // list() goes to the ordinary app-storage directory listing.
  assert.match(source, /storage\.artifactDataKeys\(artifactId\)/)

  const storage = await readSource('storage.js')
  assert.match(
    storage,
    /list\(`artifact-data\/\$\{artifactId\}`\)/,
    'artifact keys must use the ordinary app-storage directory listing',
  )
  assert.doesNotMatch(storage, /\/artifact-data\//, 'no Pages-only storage API remains')
})

test('the share flow reflects live state before persisting the record', async () => {
  // The published snapshot / dead link is the source of truth; the shares/
  // record is best-effort because the platform token hint recovers it. So the
  // UI must be updated BEFORE the record write, and a failed write must not
  // throw a compensation dance (which also mis-staged a recovered null version).
  const source = await readSource('ui/Detail.jsx')
  assert.doesNotMatch(source, /compensatedError/, 'the compensation machinery must be gone')

  for (const fn of ['publish', 'stopSharing']) {
    const body = source.slice(source.indexOf(`async function ${fn}(`))
    const setShare = body.indexOf('reflectLocalShare(next)')
    const persist = body.indexOf('setJSON(`shares/')
    assert.ok(setShare !== -1 && persist !== -1, `${fn} must set share + persist`)
    assert.ok(setShare < persist, `${fn} must reflect state before persisting`)
    // persistence is best-effort: the setJSON sits in its own try/catch.
    assert.match(
      body.slice(persist - 40, persist + 120),
      /try \{[\s\S]*setJSON\(`shares\/[\s\S]*?\} catch/,
      `${fn} must persist the record best-effort`,
    )
  }
})

test('detail delegates polling ownership and local share mutations to one synchronizer', async () => {
  const source = await readSource('ui/Detail.jsx')
  assert.match(source, /createDetailSync\(\{/)
  assert.match(source, /refresh\(\{ forceShare: true \}\)/)
  assert.match(source, /detailSyncRef\.current\.acceptLocalShare\(next\)/)
})
