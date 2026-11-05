import { getBlob, ref } from 'firebase/storage'

export function createProcessedVideoService({ storage, orgId }) {
  if (!storage || typeof orgId !== 'string' || !orgId || /[/\\]/.test(orgId)) throw new TypeError('Video requires an authenticated organization.')
  return {
    async load({ matchId, path }) {
      if (typeof matchId !== 'string' || !matchId || /[/\\]/.test(matchId)
        || path !== `orgs/${orgId}/matches/${matchId}/processed.mp4`) throw new TypeError('Invalid processed video path.')
      // Authenticated SDK request: no public download URL or permanent bearer token.
      return getBlob(ref(storage, path), 500 * 1024 * 1024)
    },
  }
}
