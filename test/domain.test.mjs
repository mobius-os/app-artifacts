import test from 'node:test'
import assert from 'node:assert/strict'
import {
  appendVersion,
  artifactFilename,
  artifactIntent,
  artifactStorageContext,
  createArtifactId,
  friendlyLoadError,
  injectArtifactStorageShim,
  isValidArtifactStorageKey,
  isValidProjectId,
  jsonValueBytes,
  makeArtifactRecord,
  nextVersion,
  planArtifactStorageRequest,
  isTrustedArtifactStorageMessage,
  artifactStorageShimSource,
  publishedArtifactToken,
  publishedShare,
  shareNeedsUpdate,
  slugifyTitle,
  stoppedShare,
  versionPath,
} from '../domain.js'

test('friendlyLoadError maps technical failures to actionable gallery copy', () => {
  assert.equal(
    friendlyLoadError({ status: 0 }),
    'We couldn\u2019t reach your artifacts. Check your connection and try again.',
  )
  assert.equal(
    friendlyLoadError(new Error('Could not list artifacts/ (403).')),
    'You don\u2019t have permission to view these artifacts. Sign in again or contact your administrator.',
  )
  assert.equal(
    friendlyLoadError({ status: 401 }),
    'You don\u2019t have permission to view these artifacts. Sign in again or contact your administrator.',
  )
  assert.equal(
    friendlyLoadError({ status: 404 }),
    'Artifact storage isn\u2019t available. Refresh the app and try again.',
  )
  assert.equal(
    friendlyLoadError({ response: { status: 413 } }),
    'This artifact catalog is too large to load. Remove unused artifacts and try again.',
  )
  assert.equal(
    friendlyLoadError(new Error('Could not list artifacts/ (503).')),
    'Artifacts are temporarily unavailable. Try again in a moment.',
  )
  assert.equal(
    friendlyLoadError(new Error('Unexpected response shape')),
    'Artifacts couldn\u2019t be loaded. Try again.',
  )
})

test('slugifyTitle produces a stable lowercase storage segment', () => {
  assert.equal(slugifyTitle('  Café Revenue — Q3!  '), 'cafe-revenue-q3')
  assert.equal(slugifyTitle('***'), 'artifact')
  assert.ok(slugifyTitle('a'.repeat(80)).length <= 40)
})

test('artifactFilename is safe for downloads', () => {
  assert.equal(artifactFilename('../../Quarterly Report', 3), 'quarterly-report-v3.html')
  assert.equal(artifactFilename('Résumé — 日本語', 2), 'resume-v2.html')
  assert.equal(artifactFilename('', 0), 'artifact-v1.html')
})

test('createArtifactId produces an id valid for storage and publish project_id', () => {
  const id = createArtifactId('Tip Calculator', '7f3a')
  assert.equal(id, 'tip-calculator-7f3a')
  assert.equal(isValidProjectId(id), true)
  assert.match(id, /^[a-z0-9-]+-[0-9a-f]{4}$/)
})

test('makeArtifactRecord starts at version one with origin provenance', () => {
  const record = makeArtifactRecord({
    id: 'weather-map-12ab',
    title: 'Weather Map',
    chatId: 'chat-1',
    createdAt: '2026-07-17T10:00:00.000Z',
    bytes: 8123,
  })
  assert.equal(record.current_version, 1)
  assert.equal(record.versions[0].chat_id, 'chat-1')
  assert.equal(record.versions[0].bytes, 8123)
})

test('nextVersion and appendVersion bump from the highest recorded version without mutation', () => {
  const original = {
    id: 'tip-calculator-7f3a',
    title: 'Tip Calculator',
    chat_id: 'chat-1',
    current_version: 1,
    versions: [{ v: 1, created_at: '2026-07-17T10:00:00.000Z', chat_id: 'chat-1', note: 'first', bytes: 10 }],
  }
  assert.equal(nextVersion({ ...original, current_version: 1, versions: [{ v: 3 }] }), 4)
  const updated = appendVersion(original, {
    createdAt: '2026-07-17T11:00:00.000Z',
    chatId: 'chat-2',
    note: 'larger targets',
    bytes: 14,
  })
  assert.equal(updated.current_version, 2)
  assert.deepEqual(updated.versions.map((item) => item.v), [1, 2])
  assert.equal(updated.versions[1].chat_id, 'chat-2')
  assert.equal(original.current_version, 1)
  assert.equal(original.versions.length, 1)
  assert.equal(versionPath(original.id, 2), 'versions/tip-calculator-7f3a/v2.html')
})

test('share state transitions from published to stale to stopped', () => {
  const share = publishedShare({
    id: 'tip-calculator-7f3a',
    version: 1,
    token: 'abc123',
    url: '/sites/abc123/',
    publishedAt: '2026-07-17T10:00:00.000Z',
  })
  assert.equal(share.published, true)
  assert.equal(shareNeedsUpdate({ current_version: 1 }, share), false)
  assert.equal(shareNeedsUpdate({ current_version: 2 }, share), true)
  const stopped = stoppedShare(share, '2026-07-17T12:00:00.000Z')
  assert.equal(stopped.published, false)
  assert.equal(stopped.shared_version, 1)
  assert.equal(shareNeedsUpdate({ current_version: 2 }, stopped), false)
})

test('artifactIntent accepts only the declared artifact deep-link grammar', () => {
  assert.equal(artifactIntent('artifact:tip-calculator-7f3a'), 'tip-calculator-7f3a')
  assert.equal(artifactIntent('artifact:under_score'), 'under_score')
  assert.equal(artifactIntent('artifact:has spaces'), null)
  assert.equal(artifactIntent(`artifact:${'a'.repeat(65)}`), null)
  assert.equal(artifactIntent('chat:tip-calculator'), null)
})

test('artifact storage context distinguishes embedded previews from published paths', () => {
  const token = '0123456789abcdef0123456789abcdef'
  assert.deepEqual(
    artifactStorageContext({ variant: 'preview', embedded: true }),
    { kind: 'preview', mode: 'editor', token: null, writable: true },
  )
  assert.deepEqual(
    artifactStorageContext({ variant: 'published', pathname: `/sites/${token}/nested/page` }),
    { kind: 'published', mode: 'public-readonly', token, writable: false },
  )
  assert.equal(artifactStorageContext({ variant: 'preview', embedded: false }), null)
  assert.equal(publishedArtifactToken('/sites/not-hex/'), null)
  assert.equal(publishedArtifactToken(`/other/${token}/`), null)
})

test('artifact storage keys and values are validated before bridge execution', () => {
  assert.equal(isValidArtifactStorageKey('score.current'), true)
  assert.equal(isValidArtifactStorageKey('../other'), false)
  assert.equal(isValidArtifactStorageKey('UPPER'), false)
  assert.equal(isValidArtifactStorageKey('__mobius_keys'), false)
  assert.equal(jsonValueBytes({ score: 2 }), 11)
  assert.equal(jsonValueBytes({ score: Number.NaN }), null)
  assert.equal(jsonValueBytes(undefined), null)
})

test('artifact storage request planning pins artifact id and allowlists operations', () => {
  const base = {
    type: 'moebius:artifact-storage',
    requestId: 'request-1',
    nonce: 'nonce-1',
  }
  const plan = planArtifactStorageRequest(
    { ...base, op: 'set', key: 'score', value: 7, artifactId: 'attacker-artifact' },
    { artifactId: 'mounted-artifact', writable: true },
  )
  assert.equal(plan.artifactId, 'mounted-artifact')
  assert.equal(plan.key, 'score')
  assert.throws(
    () => planArtifactStorageRequest({ ...base, op: 'copy', key: 'score' }, {
      artifactId: 'mounted-artifact', writable: true,
    }),
    (error) => error.bridgeError === 'invalid-op',
  )
  assert.throws(
    () => planArtifactStorageRequest({ ...base, op: 'get', key: '../other' }, {
      artifactId: 'mounted-artifact', writable: true,
    }),
    (error) => error.bridgeError === 'invalid-key',
  )
  assert.throws(
    () => planArtifactStorageRequest({ ...base, op: 'remove', key: 'score' }, {
      artifactId: 'mounted-artifact', writable: false,
    }),
    (error) => error.bridgeError === 'read-only',
  )
})

test('artifact storage injection preserves a leading doctype', () => {
  const original = '<!-- built artifact --><!doctype html><html><body>Hi</body></html>'
  const injected = injectArtifactStorageShim(original, { variant: 'published' })
  assert.match(injected, /^<!-- built artifact --><!doctype html><script>/i)
  assert.match(injected, /<html><body>Hi<\/body><\/html>$/)
})

test('a frame that navigated away loses storage authority', () => {
  // The artifact we staged holds the parent-issued session key. A page the
  // frame navigated ITSELF to keeps the same contentWindow (so event.source
  // still matches) but never received that key.
  const mounted = { artifactId: 'deck-01', writable: true, sessionKey: 's3cr3t-key' }
  const staged = {
    type: 'moebius:artifact-storage',
    op: 'set',
    key: 'score',
    requestId: 'r1',
    nonce: 'n1',
    sessionKey: 's3cr3t-key',
  }
  assert.equal(isTrustedArtifactStorageMessage(staged, mounted), true)

  // Attacker page: right shape, guessed/absent key.
  assert.equal(
    isTrustedArtifactStorageMessage({ ...staged, sessionKey: 'guessed' }, mounted),
    false,
  )
  const { sessionKey: _dropped, ...noKey } = staged
  assert.equal(isTrustedArtifactStorageMessage(noKey, mounted), false)

  // A mount with no key of its own must never be satisfiable.
  for (const bad of [undefined, '', null, 0]) {
    assert.equal(
      isTrustedArtifactStorageMessage({ ...staged, sessionKey: bad },
        { ...mounted, sessionKey: bad }),
      false,
    )
  }
})

test('the preview shim sends the parent-issued session key on every request', () => {
  const source = artifactStorageShimSource({
    variant: 'preview', writable: true, sessionKey: 'mint-abc',
  })
  assert.match(source, /sessionKey:c\.sessionKey/)
  assert.match(source, /"sessionKey":"mint-abc"/)
  // A published page has no parent bridge, so it carries no key at all.
  const published = artifactStorageShimSource({
    variant: 'published', sessionKey: 'mint-abc',
  })
  assert.match(published, /"sessionKey":""/)
})
