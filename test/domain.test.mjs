import test from 'node:test'
import assert from 'node:assert/strict'
import {
  appendVersion,
  artifactFilename,
  artifactIntent,
  createArtifactId,
  isValidProjectId,
  makeArtifactRecord,
  nextVersion,
  publishedShare,
  shareNeedsUpdate,
  slugifyTitle,
  stoppedShare,
  versionPath,
} from '../domain.js'

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
