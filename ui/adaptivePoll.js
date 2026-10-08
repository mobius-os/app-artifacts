// Polling cadence for views that must notice agent-written storage changes.
// Storage subscriptions only see this frame's own writes, so the gallery and
// detail views poll. They poll quickly right after something changed (an agent
// is usually mid-edit) and back off while nothing does. The ceiling stays
// short because the owner often watches an open view for a page they just
// asked the agent for; a hidden view makes no requests at all.
export const POLL_MIN_MS = 3500
export const POLL_MAX_MS = 10000

// `tick` resolves true when it observed a change. Errors count as no change,
// and so does a tick still pending after `minMs`: one hung read must not stop
// the poll, so the next tick runs anyway and callers dedupe overlapping work.
// `poke()` returns to the fast cadence, for focus and visibility returns.
export function startAdaptivePoll(tick, { minMs = POLL_MIN_MS, maxMs = POLL_MAX_MS } = {}) {
  let delay = minMs
  let timer = null
  let stopped = false

  function settledTick() {
    let bound = null
    const pending = new Promise((resolve) => { bound = setTimeout(resolve, minMs, false) })
    return Promise.race([tick(), pending]).finally(() => clearTimeout(bound))
  }

  const schedule = () => {
    if (!stopped) timer = setTimeout(run, delay)
  }

  async function run() {
    timer = null
    let changed = false
    try {
      changed = (await settledTick()) === true
    } catch {
      changed = false
    }
    if (stopped) return
    delay = changed ? minMs : Math.min(maxMs, delay * 2)
    schedule()
  }

  schedule()
  return {
    poke() {
      delay = minMs
      if (timer !== null) {
        clearTimeout(timer)
        schedule()
      }
    },
    stop() {
      stopped = true
      if (timer !== null) clearTimeout(timer)
      timer = null
    },
  }
}

// Whether the owner can see this frame, and a callback on each change.
// Möbius keeps hidden app frames loaded while `document.visibilityState` stays
// "visible", so the runtime's frame signal is preferred; older hosts without
// `runtimeFeatures.frameVisibility` fall back to the document signal.
export function watchFrameVisibility(
  onChange,
  { mobius = globalThis.window?.mobius, doc = globalThis.document } = {},
) {
  if (mobius?.runtimeFeatures?.frameVisibility && typeof mobius.onVisibilityChange === 'function') {
    let visible = mobius.visible !== false
    let subscribed = false
    const unsubscribe = mobius.onVisibilityChange((next) => {
      const was = visible
      visible = next !== false
      // The runtime reports the current state on subscribe; only changes count.
      if (subscribed && visible !== was) onChange(visible)
    })
    subscribed = true
    return {
      isVisible: () => visible,
      stop: () => { if (typeof unsubscribe === 'function') unsubscribe() },
    }
  }
  const isVisible = () => doc?.visibilityState !== 'hidden'
  let visible = isVisible()
  const listener = () => {
    const was = visible
    visible = isVisible()
    if (visible !== was) onChange(visible)
  }
  doc?.addEventListener?.('visibilitychange', listener)
  return {
    isVisible: () => visible,
    stop: () => doc?.removeEventListener?.('visibilitychange', listener),
  }
}
