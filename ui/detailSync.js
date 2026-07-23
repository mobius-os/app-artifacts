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
  let recordFirstSubscriptionSeen = false
  let recordInitialFreshSettled = false
  let recordInitialFreshSucceeded = false
  let recordInitialFreshGeneration = 0
  let recordProvisionalApplied = false

  let shareGeneration = 0
  let shareRead = null
  let trailingForcedShareRead = false
  let shareFirstSubscriptionSeen = false
  let shareInitialFreshSettled = false
  let shareInitialFreshSucceeded = false
  let shareInitialFreshGeneration = 0

  let hintRead = null
  let nextHintCheckAt = 0
  let trailingForcedHintRead = false
  let lastRecoveredToken = null

  function acceptRecord(value) {
    if (!active) return
    recordGeneration += 1
    onRecord(value)
  }

  function acceptRecordSubscription(value) {
    if (!active) return
    if (recordFirstSubscriptionSeen) {
      acceptRecord(value)
      return
    }
    recordFirstSubscriptionSeen = true
    if (!recordInitialFreshSettled) {
      // runtime.subscribe emits its cache immediately. It is useful for fast
      // paint/offline fallback, but remains provisional until getFresh settles.
      recordProvisionalApplied = value != null
      onRecord(value)
    } else if (
      !recordInitialFreshSucceeded
      && recordGeneration === recordInitialFreshGeneration
    ) {
      acceptRecord(value)
    }
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

  function acceptShareSubscription(value) {
    if (!active) return
    if (shareFirstSubscriptionSeen) {
      acceptObservedShare(value)
      return
    }
    shareFirstSubscriptionSeen = true
    if (!shareInitialFreshSettled) {
      // Like the record subscription, this first cache-backed value is only a
      // provisional paint. It must not own the generation over getFresh.
      const wasMissing = sharePolling.isMissing()
      sharePolling.observe(value, now())
      if (!(value == null && wasMissing)) {
        if (value != null) lastRecoveredToken = null
        onShare(value)
      }
      if (value == null) void refreshHint({ force: true })
    } else if (
      !shareInitialFreshSucceeded
      && shareGeneration === shareInitialFreshGeneration
    ) {
      acceptObservedShare(value)
    }
  }

  async function refreshRecord({ reportError = false, initial = false } = {}) {
    if (!active) return
    if (recordRead) return recordRead

    const generation = recordGeneration
    if (initial) recordInitialFreshGeneration = generation
    let request
    request = (async () => {
      try {
        const value = await storage.getFresh(recordPath)
        if (initial) {
          recordInitialFreshSettled = true
          recordInitialFreshSucceeded = true
        }
        if (active && generation === recordGeneration) acceptRecord(value)
      } catch (error) {
        if (initial) recordInitialFreshSettled = true
        if (
          active
          && reportError
          && !recordProvisionalApplied
          && generation === recordGeneration
        ) {
          onRecordError(error)
        }
      } finally {
        if (recordRead === request) recordRead = null
      }
    })()
    recordRead = request
    return request
  }

  async function refreshShare({ force = false, initial = false } = {}) {
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
    if (initial) shareInitialFreshGeneration = generation
    let request
    request = (async () => {
      try {
        const value = await storage.getFresh(sharePath)
        if (initial) {
          shareInitialFreshSettled = true
          shareInitialFreshSucceeded = true
        }
        if (active && generation === shareGeneration) acceptObservedShare(value)
      } catch {
        if (initial) shareInitialFreshSettled = true
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
    unsubscribeRecord = storage.subscribe(recordPath, acceptRecordSubscription)
    unsubscribeShare = storage.subscribe(sharePath, acceptShareSubscription)
    void refreshRecord({ reportError: true, initial: true })
    void refreshShare({ force: true, initial: true })
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
