export const ARTIFACT_PREVIEW_WIDTH = 1200
export const ARTIFACT_PREVIEW_HEIGHT = 630
export const ARTIFACT_PREVIEW_FILENAME = 'preview.png'

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function escapeAttribute(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function trimTo(value, length) {
  const text = String(value ?? '').trim()
  if (text.length <= length) return text
  return `${text.slice(0, Math.max(0, length - 1)).trimEnd()}…`
}

export function wrapArtifactPreviewText(value, maxChars, maxLines) {
  const words = String(value ?? '').trim().split(/\s+/).filter(Boolean)
  const lines = []
  for (const word of words) {
    const current = lines.at(-1)
    if (!current || `${current} ${word}`.length > maxChars) {
      if (lines.length === maxLines) {
        lines[maxLines - 1] = trimTo(`${lines[maxLines - 1]} ${word}`, maxChars)
      } else {
        lines.push(trimTo(word, maxChars))
      }
    } else {
      lines[lines.length - 1] = `${current} ${word}`
    }
  }
  if (!lines.length) return ['Untitled artifact']
  const visible = lines.join(' ').replaceAll('…', '')
  if (words.join(' ').length > visible.length && !lines.at(-1).endsWith('…')) {
    lines[lines.length - 1] = trimTo(`${lines.at(-1)}…`, maxChars)
  }
  return lines
}

function textLines(lines, { x, y, step, size, weight, fill }) {
  return lines.map((line, index) => (
    `<text x="${x}" y="${y + index * step}" fill="${fill}" font-size="${size}" font-weight="${weight}">${escapeXml(line)}</text>`
  )).join('')
}

export function artifactLinkPreviewAlt(record, version) {
  const title = String(record?.title || 'Untitled artifact').trim()
  return `${title} — shared artifact, version ${Number(version) || 1}`
}

export function artifactLinkPreviewMetadata(record, version) {
  return {
    title: String(record?.title || 'Untitled artifact').trim(),
    description: String(
      record?.description
      || `An interactive artifact shared from Möbius · Version ${Number(version) || 1}`,
    ).trim(),
    image_path: ARTIFACT_PREVIEW_FILENAME,
    image_alt: artifactLinkPreviewAlt(record, version),
    image_width: ARTIFACT_PREVIEW_WIDTH,
    image_height: ARTIFACT_PREVIEW_HEIGHT,
    site_name: 'Möbius Artifacts',
  }
}

export function buildArtifactLinkPreviewSvg(record, version) {
  const safeVersion = Number(version) || 1
  const titleLines = wrapArtifactPreviewText(record?.title, 24, 3)
  const descriptionLines = wrapArtifactPreviewText(
    record?.description || 'An interactive page created in Möbius',
    45,
    2,
  )
  const titleStart = titleLines.length === 3 ? 212 : 236
  const descriptionStart = titleStart + titleLines.length * 62 + 28

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ARTIFACT_PREVIEW_WIDTH}" height="${ARTIFACT_PREVIEW_HEIGHT}" viewBox="0 0 ${ARTIFACT_PREVIEW_WIDTH} ${ARTIFACT_PREVIEW_HEIGHT}" role="img" aria-label="${escapeXml(artifactLinkPreviewAlt(record, safeVersion))}">
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#17142b"/>
      <stop offset=".55" stop-color="#26204a"/>
      <stop offset="1" stop-color="#3a2959"/>
    </linearGradient>
    <linearGradient id="page" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fffdf7"/>
      <stop offset="1" stop-color="#f4efe4"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#a88bff"/>
      <stop offset="1" stop-color="#ff9d8e"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="170%" height="180%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#0d0920" flood-opacity=".38"/>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#background)"/>
  <circle cx="1087" cy="56" r="210" fill="#8c6be8" opacity=".1"/>
  <circle cx="142" cy="622" r="245" fill="#ff9d8e" opacity=".09"/>

  <g transform="translate(80 73)" filter="url(#shadow)">
    <rect width="500" height="484" rx="28" fill="url(#page)"/>
    <rect width="500" height="58" rx="28" fill="#e9e2d6"/>
    <rect y="30" width="500" height="28" fill="#e9e2d6"/>
    <circle cx="31" cy="29" r="7" fill="#ff8f7d"/>
    <circle cx="55" cy="29" r="7" fill="#e7b558"/>
    <circle cx="79" cy="29" r="7" fill="#79b895"/>
    <rect x="110" y="20" width="250" height="18" rx="9" fill="#d4ccc0"/>

    <rect x="34" y="92" width="216" height="18" rx="9" fill="#302851"/>
    <rect x="34" y="126" width="338" height="11" rx="5.5" fill="#b7acbf"/>
    <rect x="34" y="147" width="288" height="11" rx="5.5" fill="#d2c8d1"/>
    <rect x="34" y="184" width="432" height="128" rx="18" fill="#ded4ff"/>
    <circle cx="111" cy="248" r="41" fill="url(#accent)"/>
    <path d="M99 250l17 17 34-43" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="179" y="218" width="205" height="14" rx="7" fill="#5b4a87"/>
    <rect x="179" y="246" width="154" height="11" rx="5.5" fill="#9589ad"/>
    <rect x="179" y="270" width="184" height="11" rx="5.5" fill="#b4a9bc"/>
    <rect x="34" y="343" width="202" height="105" rx="17" fill="#f5c9bd"/>
    <rect x="257" y="343" width="209" height="105" rx="17" fill="#cfe3dc"/>
    <rect x="58" y="370" width="106" height="12" rx="6" fill="#9a554c"/>
    <rect x="58" y="395" width="143" height="9" rx="4.5" fill="#bf8177"/>
    <rect x="281" y="370" width="111" height="12" rx="6" fill="#35685b"/>
    <rect x="281" y="395" width="146" height="9" rx="4.5" fill="#75a398"/>
  </g>

  <g font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
    <text x="662" y="111" fill="#cbbcff" font-size="20" font-weight="800" letter-spacing="2.4">MÖBIUS ARTIFACTS</text>
    ${textLines(titleLines, {
      x: 662, y: titleStart, step: 62, size: 51, weight: 760, fill: '#fffdf9',
    })}
    ${textLines(descriptionLines, {
      x: 664, y: descriptionStart, step: 34, size: 24, weight: 500, fill: '#c9c3d7',
    })}
    <g transform="translate(662 520)">
      <rect width="150" height="48" rx="24" fill="#ffffff" fill-opacity=".1" stroke="#ffffff" stroke-opacity=".16"/>
      <circle cx="27" cy="24" r="8" fill="#a88bff"/>
      <text x="47" y="31" fill="#f4efff" font-size="20" font-weight="700">Version ${safeVersion}</text>
    </g>
  </g>
</svg>`
}

export function artifactLinkPreviewDataUrl(record, version) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    buildArtifactLinkPreviewSvg(record, version),
  )}`
}

export async function renderArtifactLinkPreviewPng(record, version) {
  const image = new Image()
  image.decoding = 'async'
  const loaded = new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = () => reject(new Error('Could not render the artifact link preview.'))
  })
  image.src = artifactLinkPreviewDataUrl(record, version)
  await loaded

  const canvas = document.createElement('canvas')
  canvas.width = ARTIFACT_PREVIEW_WIDTH
  canvas.height = ARTIFACT_PREVIEW_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Image previews are unavailable in this browser.')
  context.drawImage(image, 0, 0, ARTIFACT_PREVIEW_WIDTH, ARTIFACT_PREVIEW_HEIGHT)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not prepare the artifact link preview.')
  return blob
}

export function injectLegacyArtifactLinkPreview(html, publicUrl, metadata) {
  const canonical = new URL(publicUrl).href
  const imageUrl = new URL(metadata.image_path, canonical).href
  const tags = [
    '<!-- mobius:link-preview:start -->',
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${escapeAttribute(metadata.title)}">`,
    `<meta property="og:description" content="${escapeAttribute(metadata.description)}">`,
    `<meta property="og:url" content="${escapeAttribute(canonical)}">`,
    `<meta property="og:site_name" content="${escapeAttribute(metadata.site_name)}">`,
    `<meta property="og:image" content="${escapeAttribute(imageUrl)}">`,
    '<meta property="og:image:type" content="image/png">',
    `<meta property="og:image:width" content="${metadata.image_width}">`,
    `<meta property="og:image:height" content="${metadata.image_height}">`,
    `<meta property="og:image:alt" content="${escapeAttribute(metadata.image_alt)}">`,
    `<link rel="canonical" href="${escapeAttribute(canonical)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeAttribute(metadata.title)}">`,
    `<meta name="twitter:description" content="${escapeAttribute(metadata.description)}">`,
    `<meta name="twitter:image" content="${escapeAttribute(imageUrl)}">`,
    `<meta name="twitter:image:alt" content="${escapeAttribute(metadata.image_alt)}">`,
    '<!-- mobius:link-preview:end -->',
  ].join('\n')
  const clean = String(html).replace(
    /<!-- mobius:link-preview:start -->[\s\S]*?<!-- mobius:link-preview:end -->/i,
    '',
  )
  if (!/<head(?:\s[^>]*)?>/i.test(clean)) {
    throw new Error('This artifact needs an HTML head before it can be shared.')
  }
  return clean.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}\n${tags}`)
}
