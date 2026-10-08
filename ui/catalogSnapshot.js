function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function reuseRecordList(current, next) {
  if (current.length !== next.length) return next
  return current.every((record, index) => sameJson(record, next[index]))
    ? current
    : next
}

export function reuseRecordMap(current, next) {
  if (current.size !== next.size) return next
  for (const [key, value] of next) {
    if (!current.has(key) || !sameJson(current.get(key), value)) return next
  }
  return current
}

// Incremental reads of one storage folder of JSON records.

// Above this many new or modified records, one content-bearing listing is
// cheaper than a read per record.
export const CONTENT_LIST_THRESHOLD = 4

function parseEntryContent(content) {
  if (typeof content !== 'string') return content
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

function entryPath(prefix, entry) {
  return entry?.path || (entry?.name ? `${prefix}${entry.name}` : null)
}

// A listing stamp identifies a record revision without reading its content.
// Entries without a modification time are always treated as changed.
function entryStamp(entry) {
  return entry?.modified_at ? `${entry.modified_at}:${entry.size ?? ''}` : ''
}

// Parsed records per storage and folder, keyed by path with their stamp, plus
// the folder's last listing signature so callers can tell whether it changed.
const folderCaches = new WeakMap()

function folderCache(storage, prefix) {
  let byPrefix = folderCaches.get(storage)
  if (!byPrefix) {
    byPrefix = new Map()
    folderCaches.set(storage, byPrefix)
  }
  let cache = byPrefix.get(prefix)
  if (!cache) {
    cache = { records: new Map(), signature: null }
    byPrefix.set(prefix, cache)
  }
  return cache
}

export function folderSignature(storage, prefix) {
  return folderCache(storage, prefix).signature
}

// After a content-backed cold mount, unchanged agent-owned folders cost only
// a metadata listing. App-owned share listings also include effective values.
export async function readFolder(storage, prefix) {
  const cache = folderCache(storage, prefix)
  const listed = (await storage.list(prefix, cache.signature === null ? { includeContent: true } : {}))
    .map((entry) => ({ ...entry, path: entryPath(prefix, entry), stamp: entryStamp(entry) }))
    .filter(({ path }) => typeof path === 'string' && path.endsWith('.json'))
  // Cold mounts need cached runtime bodies too. Content listings also carry
  // queued local values, which can change without a server stamp changing.
  for (const { path, stamp, content } of listed) {
    if (content !== undefined) cache.records.set(path, { stamp, value: parseEntryContent(content) })
  }
  async function readRecord(path, stamp) {
    try {
      cache.records.set(path, { stamp, value: await storage.getFresh(path) })
    } catch {
      // Keep an offline body, but not its server stamp: retry authority later.
      const value = storage.get ? await storage.get(path).catch(() => null) : null
      if (value != null) cache.records.set(path, { stamp: '', value })
      else if (cache.records.has(path)) cache.records.get(path).stamp = ''
      else cache.records.delete(path)
    }
  }
  const stale = listed.filter(({ path, stamp, content }) => content === undefined
    && (!stamp || cache.records.get(path)?.stamp !== stamp))
  if (stale.length > CONTENT_LIST_THRESHOLD) {
    const entries = await storage.list(prefix, { includeContent: true })
    await Promise.all(entries.map(async (entry) => {
      const path = entryPath(prefix, entry)
      if (typeof path !== 'string' || !path.endsWith('.json')) return
      if (entry?.content !== undefined) {
        cache.records.set(path, { stamp: entryStamp(entry), value: parseEntryContent(entry.content) })
        return
      }
      await readRecord(path, entryStamp(entry))
    }))
  } else {
    await Promise.all(stale.map(async ({ path, stamp }) => {
      await readRecord(path, stamp)
    }))
  }
  const present = new Set(listed.map(({ path }) => path))
  for (const path of cache.records.keys()) {
    if (!present.has(path)) cache.records.delete(path)
  }
  cache.signature = listed
    .map(({ path, stamp }) => `${path}@${stamp}:${JSON.stringify(cache.records.get(path)?.value ?? null)}`)
    .join('|')
  if (listed.length && !listed.some(({ path }) => cache.records.get(path)?.value)) {
    throw new Error('Could not read the known catalog records. Go online and try again.')
  }
  return listed
    .map(({ path }) => cache.records.get(path)?.value)
    .filter((value) => value && typeof value === 'object')
}
