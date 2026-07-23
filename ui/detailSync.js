import { isValidShareToken, recoveredShare } from '../domain.js'
import { createSharePollGate } from './sharePolling.js'

export const MISSING_HINT_RECHECK_MS = 60_000

export function createDetailSync({
  artifactId,
  storage,
  onRecord,
  onRecordError,
  onShare,
  onRecoveredShare,
  now = Date.now,
  missingShareRecheckMs,
  missingHintRecheckMs = MISSING_HINT_RECHECK_MS,
}) {
  const recordPath = `artifacts/${artifactId}.json`
  const sharePath = `shares/${artifactId}.json`
  const hintPath = `projects/${artifactId}/build/publish-token.txt`
  const sharePolling = createSharePollGate({ missingRecheckMs: missingShareRecheckMs })

  let active = true
  let started = false
  let unsubscribeRecord = null
  let unsubscribeShare = null

  let recordGeneration = 0
  let recordRead = null

  let shareGeneration = 0
  let shareRead = null
  let trailingForcedShareRead = false

  let hintRead = null
  let nextHintCheckAt = 0
  let trailingForcedHintRead = false
  let lastRecoveredToken = null

  function acceptRecord(value) {
    if (!active) return
    recordGeneration += 1
    onRecord(value)
  }

  function acceptObservedShare(value) {
    if (!active) return
    const wasMissing = sharePolling.isMissing()
    // Reconfirming the same absence carries no newer share state. In
    // particular, do not let duplicate subscription/fresh nulls invalidate a
    // hint request or clear a newer local publish/stop state.
    if (value == null && wasMissing) {
      sharePolling.observe(value, now())
      void refreshHint()
      return
    }
    shareGeneration += 1
    sharePolling.observe(value, now())
    if (value != null) lastRecoveredToken = null
    onShare(value)
    if (value == null) void refreshHint({ force: true })
  }

  function acceptLocalShare(value) {
    if (!active) return
    // Local publish/stop state is authoritative over reads that were already
    // in flight, but it does not claim that the best-effort share-row write
    // has landed. The next eligible fresh read still verifies storage.
    shareGeneration += 1
    onShare(value)
  }

  async function refreshRecord({ reportError = false } = {}) {
    if (!active) return
    if (recordRead) return recordRead

    const generation = recordGeneration
    let request
    request = (async () => {
      try {
        const value = await storage.getFresh(recordPath)
        if (active && generation === recordGeneration) acceptRecord(value)
      } catch (error) {
        if (active && reportError && generation === recordGeneration) onRecordError(error)
      } finally {
        if (recordRead === request) recordRead = null
      }
    })()
    recordRead = request
    return request
  }

  async function refreshShare({ force = false } = {}) {
    if (!active) return
    if (shareRead) {
      if (force) trailingForcedShareRead = true
      return shareRead
    }
    if (!sharePolling.shouldRead(now(), { force })) {
      if (sharePolling.isMissing()) void refreshHint()
      return
    }

    const generation = shareGeneration
    let request
    request = (async () => {
      try {
        const value = await storage.getFresh(sharePath)
        if (active && generation === shareGeneration) acceptObservedShare(value)
      } catch {
        // A failed due read stays due. The next detail tick retries it.
      } finally {
        if (shareRead === request) shareRead = null
        if (active && trailingForcedShareRead) {
          trailingForcedShareRead = false
          void refreshShare({ force: true })
        }
      }
    })()
    shareRead = request
    return request
  }

  async function refreshHint({ force = false } = {}) {
    if (!active || !sharePolling.isMissing()) return
    if (hintRead) {
      if (force) trailingForcedHintRead = true
      return hintRead
    }
    if (!force && now() < nextHintCheckAt) return

    const generation = shareGeneration
    let request
    request = (async () => {
      let raw = null
      try {
        raw = await storage.getText(hintPath)
      } catch {
        // Missing, invalid, and transiently unreadable hints all retry on the
        // same independent bounded cadence.
      } finally {
        nextHintCheckAt = now() + missingHintRecheckMs
      }

      const token = String(raw || '').trim()
      if (
        active
        && sharePolling.isMissing()
        && generation === shareGeneration
        && isValidShareToken(token)
        && token !== lastRecoveredToken
      ) {
        lastRecoveredToken = token
        onRecoveredShare(recoveredShare({ id: artifactId, token }))
      }

      if (hintRead === request) hintRead = null
      if (active && trailingForcedHintRead) {
        trailingForcedHintRead = false
        void refreshHint({ force: true })
      }
    })()
    hintRead = request
    return request
  }

  function refresh({ forceShare = false } = {}) {
    if (!active) return Promise.resolve([])
    // Record and share reads own and apply their results independently: one
    // path failing or remaining in flight cannot suppress the other.
    const recordTask = refreshRecord()
    const shareTask = refreshShare({ force: forceShare })
    if (sharePolling.isMissing()) void refreshHint()
    return Promise.allSettled([recordTask, shareTask])
  }

  function start() {
    if (!active || started) return
    started = true
    unsubscribeRecord = storage.subscribe(recordPath, acceptRecord)
    unsubscribeShare = storage.subscribe(sharePath, acceptObservedShare)
    void refreshRecord({ reportError: true })
    void refreshShare({ force: true })
  }

  function dispose() {
    if (!active) return
    active = false
    recordGeneration += 1
    shareGeneration += 1
    unsubscribeRecord?.()
    unsubscribeShare?.()
  }

  return {
    start,
    refresh,
    acceptLocalShare,
    dispose,
  }
}
