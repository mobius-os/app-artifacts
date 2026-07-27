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
