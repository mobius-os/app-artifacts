/**
 * Keep a page's content until its record is confirmed absent on the server.
 * Runtime removes can resolve while queued, or even after a dead-lettered
 * refusal, and cached reads can show an optimistic tombstone in either case.
 * Once absence is confirmed, attempt every cleanup independently: leftovers
 * are preferable to a listed page whose content is already gone.
 */
export async function removePageStorage(storage, artifactId) {
  const recordPath = `artifacts/${artifactId}.json`
  const result = await storage.remove(recordPath)
  if (result?.queued) {
    throw new Error('Page deletion is still pending. Its content has been kept.')
  }
  if (await storage.getFresh(recordPath) !== null) {
    throw new Error('Page deletion could not be confirmed. Its content has been kept.')
  }
  await Promise.allSettled([
    storage.removeFolder(`versions/${artifactId}`),
    storage.removeFolder(`projects/${artifactId}`),
    storage.removeFolder(`artifact-data/${artifactId}`),
    storage.remove(`shares/${artifactId}.json`),
  ])
}
