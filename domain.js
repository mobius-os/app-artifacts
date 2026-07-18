const ID_BASE_MAX = 40
const ID_SUFFIX_RE = /^[0-9a-f]{4}$/
const PROJECT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/

function failureStatus(error) {
  const directStatus = Number(error?.status ?? error?.response?.status)
  if (
    directStatus === 0
    || (Number.isInteger(directStatus) && directStatus >= 100 && directStatus <= 599)
  ) {
    return directStatus
  }
  const statusMatch = String(error?.message || '').match(/\b([1-5]\d{2})\b/)
  return statusMatch ? Number(statusMatch[1]) : null
}

export function friendlyLoadError(error) {
  const status = failureStatus(error)
  const message = String(error?.message || '')
  if (
    status === 0
    || /failed to fetch|network\s*error|network request failed|offline|connection/i.test(message)
  ) {
    return 'We couldn\u2019t reach your artifacts. Check your connection and try again.'
  }
  if (status === 401 || status === 403) {
    return 'You don\u2019t have permission to view these artifacts. Sign in again or contact your administrator.'
  }
  if (status === 404) {
    return 'Artifact storage isn\u2019t available. Refresh the app and try again.'
  }
  if (status === 413) {
    return 'This artifact catalog is too large to load. Remove unused artifacts and try again.'
  }
  if (status !== null && status >= 500) {
    return 'Artifacts are temporarily unavailable. Try again in a moment.'
  }
  return 'Artifacts couldn\u2019t be loaded. Try again.'
}

export function slugifyTitle(value) {
  const normalized = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, ID_BASE_MAX)
    .replace(/-+$/g, '')
  return normalized || 'artifact'
}

export function artifactFilename(title, version) {
  const numericVersion = Number(version)
  const safeVersion = Number.isInteger(numericVersion) && numericVersion > 0 ? numericVersion : 1
  return `${slugifyTitle(title)}-v${safeVersion}.html`
}

function randomHex4(random = Math.random) {
  return Math.floor(random() * 0x10000).toString(16).padStart(4, '0').slice(-4)
}

export function createArtifactId(title, suffixOrRandom = Math.random) {
  const suffix = typeof suffixOrRandom === 'function'
    ? randomHex4(suffixOrRandom)
    : String(suffixOrRandom ?? '').toLowerCase()
  if (!ID_SUFFIX_RE.test(suffix)) throw new Error('Artifact id suffix must be four hexadecimal characters.')
  return `${slugifyTitle(title)}-${suffix}`
}

export function isValidProjectId(value) {
  return typeof value === 'string' && PROJECT_ID_RE.test(value)
}

export function makeArtifactRecord({
  id,
  title,
  description = '',
  chatId,
  createdAt,
  note = 'first version',
  bytes = 0,
}) {
  if (!isValidProjectId(id)) throw new Error('Artifact id must be a valid publish project_id.')
  const when = new Date(createdAt ?? Date.now()).toISOString()
  return {
    id,
    title: String(title || 'Untitled artifact'),
    description: String(description || ''),
    chat_id: String(chatId || ''),
    created_at: when,
    updated_at: when,
    current_version: 1,
    versions: [{
      v: 1,
      created_at: when,
      chat_id: String(chatId || ''),
      note: String(note || 'first version'),
      bytes: Math.max(0, Number(bytes) || 0),
    }],
  }
}

export function nextVersion(record) {
  const current = Number(record?.current_version) || 0
  const recorded = Array.isArray(record?.versions)
    ? record.versions.reduce((max, item) => Math.max(max, Number(item?.v) || 0), 0)
    : 0
  return Math.max(current, recorded) + 1
}

export function appendVersion(record, {
  createdAt,
  chatId,
  note = '',
  bytes = 0,
} = {}) {
  if (!record || !isValidProjectId(record.id)) throw new Error('A valid artifact record is required.')
  const v = nextVersion(record)
  const when = new Date(createdAt ?? Date.now()).toISOString()
  const version = {
    v,
    created_at: when,
    chat_id: String(chatId ?? record.chat_id ?? ''),
    note: String(note || ''),
    bytes: Math.max(0, Number(bytes) || 0),
  }
  return {
    ...record,
    updated_at: when,
    current_version: v,
    versions: [...(Array.isArray(record.versions) ? record.versions : []), version],
  }
}

export function publishedShare({ id, version, token, url, publishedAt } = {}) {
  if (!isValidProjectId(id)) throw new Error('A valid artifact id is required to share.')
  const sharedVersion = Number(version)
  if (!Number.isInteger(sharedVersion) || sharedVersion < 1) throw new Error('A positive shared version is required.')
  return {
    published: true,
    project_id: id,
    token: String(token || ''),
    url: String(url || ''),
    shared_version: sharedVersion,
    published_at: new Date(publishedAt ?? Date.now()).toISOString(),
  }
}

export function stoppedShare(share, stoppedAt) {
  return {
    ...(share || {}),
    published: false,
    unpublished_at: new Date(stoppedAt ?? Date.now()).toISOString(),
  }
}

export function shareNeedsUpdate(record, share) {
  return Boolean(
    share?.published
    && Number(record?.current_version) > Number(share?.shared_version || 0),
  )
}

export function versionPath(id, version) {
  if (!isValidProjectId(id)) throw new Error('Invalid artifact id.')
  const v = Number(version)
  if (!Number.isInteger(v) || v < 1) throw new Error('Invalid artifact version.')
  return `versions/${id}/v${v}.html`
}

export function artifactIntent(value) {
  const match = /^artifact:([A-Za-z0-9_-]{1,64})$/.exec(String(value || ''))
  return match ? match[1] : null
}
