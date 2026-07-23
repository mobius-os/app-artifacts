export const MISSING_SHARE_RECHECK_MS = 60_000

export function createSharePollGate({ missingRecheckMs = MISSING_SHARE_RECHECK_MS } = {}) {
  // Existing records stay on the detail view's fast poll so remote updates
  // remain responsive. A confirmed absence gets a bounded recheck instead of
  // producing a 404 every 3.5 seconds; subscriptions and forced focus/
  // visibility reads can still discover a new record immediately.
  let missing = false
  let nextCheckAt = 0

  return {
    observe(value, now = Date.now()) {
      missing = value == null
      nextCheckAt = missing ? now + missingRecheckMs : 0
    },

    shouldRead(now = Date.now(), { force = false } = {}) {
      return force || !missing || now >= nextCheckAt
    },

    isMissing() {
      return missing
    },
  }
}
