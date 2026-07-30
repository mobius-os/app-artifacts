import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ARTIFACT_PREVIEW_HEIGHT,
  ARTIFACT_PREVIEW_WIDTH,
  artifactLinkPreviewAlt,
  artifactLinkPreviewMetadata,
  buildArtifactLinkPreviewSvg,
  injectLegacyArtifactLinkPreview,
  wrapArtifactPreviewText,
} from '../linkPreview.js'

const artifact = {
  title: 'A thoughtful launch brief',
  description: 'A concise plan for bringing the new experience to life.',
}

test('artifact previews are branded, bounded social cards', () => {
  const svg = buildArtifactLinkPreviewSvg(artifact, 3)

  assert.equal(ARTIFACT_PREVIEW_WIDTH, 1200)
  assert.equal(ARTIFACT_PREVIEW_HEIGHT, 630)
  assert.match(svg, /MÖBIUS ARTIFACTS/)
  assert.match(svg, /A thoughtful launch brief/)
  assert.match(svg, /Version 3/)
  assert.equal(
    artifactLinkPreviewAlt(artifact, 3),
    'A thoughtful launch brief — shared artifact, version 3',
  )
  assert.ok(wrapArtifactPreviewText('one two three four five', 7, 2).length <= 2)
})

test('preview text is escaped and publication metadata names one image', () => {
  const unsafe = { ...artifact, title: '<script>"No"</script>' }
  const svg = buildArtifactLinkPreviewSvg(unsafe, 1)

  assert.doesNotMatch(svg, /<script>/)
  assert.match(svg, /&lt;script&gt;/)
  assert.deepEqual(artifactLinkPreviewMetadata(artifact, 3), {
    title: 'A thoughtful launch brief',
    description: 'A concise plan for bringing the new experience to life.',
    image_path: 'preview.png',
    image_alt: 'A thoughtful launch brief — shared artifact, version 3',
    image_width: 1200,
    image_height: 630,
    site_name: 'Möbius Artifacts',
  })
})

test('legacy fallback injects absolute metadata without changing the artifact body', () => {
  const html = '<!doctype html><html><head><title>Original</title></head><body>Artifact</body></html>'
  const output = injectLegacyArtifactLinkPreview(
    html,
    'https://mobius.test/sites/abc/',
    artifactLinkPreviewMetadata(artifact, 2),
  )

  assert.match(output, /property="og:url" content="https:\/\/mobius\.test\/sites\/abc\/"/)
  assert.match(output, /property="og:image" content="https:\/\/mobius\.test\/sites\/abc\/preview\.png"/)
  assert.match(output, /name="twitter:card" content="summary_large_image"/)
  assert.match(output, /<body>Artifact<\/body>/)
})
