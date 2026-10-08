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

async function readRecord(storage, cache, path, stamp) {
  try {
    cache.records.set(path, { stamp, value: await storage.getFresh(path) })
  } catch {
    // Offline or unreadable now: keep showing the runtime's cached body (or
    // the last one read), without its stamp so the next poll retries the read.
    const cached = storage.get ? await storage.get(path).catch(() => null) : null
    const value = cached ?? cache.records.get(path)?.value
    if (value == null) cache.records.delete(path)
    else cache.records.set(path, { stamp: '', value })
  }
}

function listedEntries(prefix, entries) {
  return entries
    .map((entry) => ({ path: entryPath(prefix, entry), stamp: entryStamp(entry), content: entry?.content }))
    .filter(({ path }) => typeof path === 'string' && path.endsWith('.json'))
}

// Lists the folder without content and reads only records whose stamp moved,
// so a poll that finds nothing new costs one small listing.
//
// The first read of a folder takes bodies from a content-bearing listing:
// offline, only the runtime's listing can supply its cached and queued bodies.
// `withContent` keeps every listing content-bearing, for folders this app
// writes itself: a queued local write changes the runtime's effective value
// without moving the server stamp.
export async function readFolder(storage, prefix, { withContent = false } = {}) {
  const cache = folderCache(storage, prefix)
  const contentListing = withContent || cache.signature === null
  let listed = listedEntries(prefix, await storage.list(prefix, contentListing ? { includeContent: true } : {}))
  const isStale = ({ path, stamp, content }) => content === undefined
    && (!stamp || cache.records.get(path)?.stamp !== stamp)
  if (!contentListing && listed.filter(isStale).length > CONTENT_LIST_THRESHOLD) {
    listed = listedEntries(prefix, await storage.list(prefix, { includeContent: true }))
  }
  const stale = listed.filter(isStale)
  for (const { path, stamp, content } of listed) {
    if (content !== undefined) cache.records.set(path, { stamp, value: parseEntryContent(content) })
  }
  await Promise.all(stale.map(({ path, stamp }) => readRecord(storage, cache, path, stamp)))
  const present = new Set(listed.map(({ path }) => path))
  for (const path of cache.records.keys()) {
    if (!present.has(path)) cache.records.delete(path)
  }
  cache.signature = listed
    .map(({ path, stamp }) => `${path}@${stamp}:${JSON.stringify(cache.records.get(path)?.value ?? null)}`)
    .join('|')
  return listed
    .map(({ path }) => cache.records.get(path)?.value)
    .filter((value) => value && typeof value === 'object')
}
