const ID_BASE_MAX = 40
const ID_SUFFIX_RE = /^[0-9a-f]{4}$/
const PROJECT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const ARTIFACT_STORAGE_KEY_RE = /^[a-z0-9._-]{1,64}$/
const ARTIFACT_STORAGE_MESSAGE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/
const ARTIFACT_STORAGE_OPS = new Set(['get', 'set', 'remove', 'list'])

export const ARTIFACT_STORAGE_INDEX_KEY = '__mobius_keys'
export const ARTIFACT_STORAGE_MAX_VALUE_BYTES = 64 * 1024
export const ARTIFACT_STORAGE_MAX_PENDING = 32

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

export function isValidArtifactStorageKey(value) {
  return typeof value === 'string'
    && value !== ARTIFACT_STORAGE_INDEX_KEY
    && ARTIFACT_STORAGE_KEY_RE.test(value)
}

function storageRequestError(code) {
  const error = new Error(code)
  error.bridgeError = code
  return error
}

function isJsonValue(value, ancestors = new Set()) {
  if (value === null) return true
  if (typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object' || ancestors.has(value)) return false
  const prototype = Object.getPrototypeOf(value)
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false
  ancestors.add(value)
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonValue(item, ancestors))
    : Object.entries(value).every(([key, item]) => (
      typeof key === 'string' && isJsonValue(item, ancestors)
    ))
  ancestors.delete(value)
  return valid
}

export function jsonValueBytes(value) {
  if (!isJsonValue(value)) return null
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength
  } catch {
    return null
  }
}

export function planArtifactStorageRequest(message, context) {
  if (!message || message.type !== 'moebius:artifact-storage') {
    throw storageRequestError('invalid-request')
  }
  if (!ARTIFACT_STORAGE_MESSAGE_ID_RE.test(message.requestId || '')
    || !ARTIFACT_STORAGE_MESSAGE_ID_RE.test(message.nonce || '')) {
    throw storageRequestError('invalid-request')
  }
  if (!ARTIFACT_STORAGE_OPS.has(message.op)) throw storageRequestError('invalid-op')
  if (!isValidProjectId(context?.artifactId)) throw storageRequestError('invalid-artifact')
  if (message.op !== 'list' && !isValidArtifactStorageKey(message.key)) {
    throw storageRequestError('invalid-key')
  }
  if ((message.op === 'set' || message.op === 'remove') && !context?.writable) {
    throw storageRequestError('read-only')
  }
  if (message.op === 'set') {
    const bytes = jsonValueBytes(message.value)
    if (bytes === null) throw storageRequestError('invalid-value')
    if (bytes > ARTIFACT_STORAGE_MAX_VALUE_BYTES) throw storageRequestError('value-too-large')
  }
  return {
    artifactId: context.artifactId,
    key: message.op === 'list' ? null : message.key,
    nonce: message.nonce,
    op: message.op,
    requestId: message.requestId,
    value: message.op === 'set' ? message.value : undefined,
  }
}

export function publishedArtifactToken(pathname) {
  const match = /^\/sites\/([a-f0-9]{16,64})(?:\/|$)/.exec(String(pathname || ''))
  return match ? match[1] : null
}

export function artifactStorageContext({ variant, embedded = false, pathname = '' } = {}) {
  if (variant === 'preview' && embedded) {
    return { kind: 'preview', mode: 'editor', token: null, writable: true }
  }
  if (variant === 'published') {
    return {
      kind: 'published',
      mode: 'public-readonly',
      token: publishedArtifactToken(pathname),
      writable: false,
    }
  }
  return null
}

export function artifactStorageShimSource({ variant, writable = true } = {}) {
  if (variant !== 'preview' && variant !== 'published') {
    throw new Error('Artifact storage shim requires a known variant.')
  }
  const config = JSON.stringify({
    indexKey: ARTIFACT_STORAGE_INDEX_KEY,
    maxBytes: ARTIFACT_STORAGE_MAX_VALUE_BYTES,
    maxPending: ARTIFACT_STORAGE_MAX_PENDING,
    variant,
    writable: variant === 'preview' && Boolean(writable),
  })
  return `(()=>{'use strict';
var c=${config},w=window,p=w.parent,te=new TextEncoder(),pending=new Map(),seq=0;
function err(code,message){var e=new Error(message||code);e.code=code;return e}
function ro(){var e=err('read-only','Artifact storage is read-only.');e.name='ReadOnlyError';return e}
function key(k){if(typeof k!=='string'||k===c.indexKey||!/^[a-z0-9._-]{1,64}$/.test(k))throw err('invalid-key','Invalid artifact storage key.');return k}
function json(v,seen){if(v===null||typeof v==='string'||typeof v==='boolean')return true;if(typeof v==='number')return Number.isFinite(v);if(typeof v!=='object')return false;seen=seen||new Set();if(seen.has(v))return false;var proto=Object.getPrototypeOf(v);if(!Array.isArray(v)&&proto!==Object.prototype&&proto!==null)return false;seen.add(v);var ok=Array.isArray(v)?v.every(function(x){return json(x,seen)}):Object.keys(v).every(function(k){return json(v[k],seen)});seen.delete(v);return ok}
function value(v){if(!json(v))throw err('invalid-value','Artifact storage accepts JSON values only.');var raw=JSON.stringify(v);if(te.encode(raw).byteLength>c.maxBytes)throw err('value-too-large','Artifact storage value exceeds 64 KB.');return v}
function id(){var a=new Uint32Array(4);try{w.crypto.getRandomValues(a)}catch{for(var i=0;i<a.length;i++)a[i]=Math.floor(Math.random()*4294967296)}return Array.from(a,function(n){return n.toString(36)}).join('-')}
var nonce=id();
function bridge(op,k,v){return new Promise(function(resolve,reject){if(p===w){reject(err('unavailable','Artifact storage preview bridge is unavailable.'));return}if(pending.size>=c.maxPending){reject(err('too-many-requests','Too many artifact storage requests.'));return}var requestId=(++seq).toString(36)+'-'+id(),done=false,timer=w.setTimeout(function(){if(done)return;done=true;pending.delete(requestId);reject(err('timeout','Artifact storage request timed out.'))},10000);pending.set(requestId,{nonce:nonce,finish:function(ok,result,error){if(done)return;done=true;w.clearTimeout(timer);pending.delete(requestId);ok?resolve(result):reject(err(error||'request-failed'))}});var message={type:'moebius:artifact-storage',op:op,requestId:requestId,nonce:nonce};if(k!==undefined)message.key=k;if(op==='set')message.value=v;try{p.postMessage(message,'*')}catch(e){var item=pending.get(requestId);if(item)item.finish(false,undefined,'request-failed')}})}
function onResult(event){if(event.source!==p)return;var d=event.data;if(!d||d.type!=='moebius:artifact-storage-result'||typeof d.requestId!=='string')return;var item=pending.get(d.requestId);if(!item||d.nonce!==item.nonce)return;item.finish(d.ok===true,d.value,d.error)}
function token(){var m=/^\\/sites\\/([a-f0-9]{16,64})(?:\\/|$)/.exec(w.location&&w.location.pathname||'');return m?m[1]:null}
async function publicGet(k){var t=token();if(!t)throw err('unavailable','Artifact storage public context is unavailable.');try{var response=await w.fetch('/api/published-sites/'+encodeURIComponent(t)+'/data/'+encodeURIComponent(k),{cache:'no-store',credentials:'omit'});if(response.status===404)return null;if(!response.ok)throw err('request-failed','Artifact storage request failed ('+response.status+').');return await response.json()}catch(e){if(e&&e.code)throw e;throw err('network-error','Artifact storage request failed.') }}
function publicList(v){if(!Array.isArray(v))return [];return Array.from(new Set(v.filter(function(k){return typeof k==='string'&&k!==c.indexKey&&/^[a-z0-9._-]{1,64}$/.test(k)}))).sort()}
var preview=c.variant==='preview'&&p!==w,published=c.variant==='published',storage;
if(preview){w.addEventListener('message',onResult);storage={writable:c.writable,mode:'editor',get:function(k){try{return bridge('get',key(k))}catch(e){return Promise.reject(e)}},set:function(k,v){try{if(!c.writable)return Promise.reject(ro());return bridge('set',key(k),value(v))}catch(e){return Promise.reject(e)}},remove:function(k){try{if(!c.writable)return Promise.reject(ro());return bridge('remove',key(k))}catch(e){return Promise.reject(e)}},list:function(){return bridge('list')}}}
else if(published){storage={writable:false,mode:'public-readonly',get:function(k){try{return publicGet(key(k))}catch(e){return Promise.reject(e)}},set:function(){return Promise.reject(ro())},remove:function(){return Promise.reject(ro())},list:async function(){var v=await publicGet(c.indexKey);return publicList(v)}}}
else{storage={writable:false,mode:c.variant==='published'?'public-readonly':'editor',get:function(){return Promise.reject(err('unavailable'))},set:function(){return Promise.reject(c.variant==='published'?ro():err('unavailable'))},remove:function(){return Promise.reject(c.variant==='published'?ro():err('unavailable'))},list:function(){return Promise.reject(err('unavailable'))}}}
var root=w.mobiusArtifact&&typeof w.mobiusArtifact==='object'?w.mobiusArtifact:{};Object.defineProperty(root,'storage',{value:Object.freeze(storage),enumerable:true,configurable:false,writable:false});w.mobiusArtifact=root;
})();`
}

export function injectArtifactStorageShim(html, options) {
  const source = artifactStorageShimSource(options).replace(/<\/script/gi, '<\\/script')
  const script = `<script>${source}</script>`
  const document = String(html ?? '')
  const doctype = /^((?:\s|<!--[\s\S]*?-->)*<!doctype[^>]*>)/i.exec(document)
  return doctype
    ? `${doctype[1]}${script}${document.slice(doctype[1].length)}`
    : `${script}${document}`
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
