import { createReadStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { VideoImportError } from './errors.js'

const conflict = () => new VideoImportError('conflict', 'El partido ya corresponde a otra importación.')

function checkIdentity(receipt, { orgId, actorId, matchId }) {
  if (receipt.orgId !== orgId || receipt.actorId !== actorId || receipt.matchId !== matchId) throw conflict()
}

/** Admin-only receipts reserve one source and object path per Firestore match ID. */
export function createDemoImportStore({ db, bucket }) {
  const receipts = db.collection('_demoVideoImports')

  async function find(identity) {
    const receipt = (await receipts.doc(identity.matchId).get()).data()
    if (!receipt) return null
    checkIdentity(receipt, identity)
    let metadata
    try {
      [metadata] = await bucket.file(receipt.videoPath).getMetadata()
    } catch (error) {
      if (Number(error.code) === 404) return null
      throw error
    }
    if (Number(metadata.size) !== receipt.bytes ||
        metadata.metadata?.sha256 !== receipt.sha256 ||
        metadata.metadata?.uploadedBy !== receipt.actorId) throw conflict()
    return receipt
  }

  async function putIfAbsent({ orgId, actorId, matchId, sourceHash, localPath, bytes, sha256, metadata, signal }) {
    const identity = { orgId, actorId, matchId }
    const videoPath = `orgs/${orgId}/matches/${matchId}/video.${metadata.extension}`
    const receiptRef = receipts.doc(matchId)
    signal?.throwIfAborted()
    await db.runTransaction(async transaction => {
      const previous = (await transaction.get(receiptRef)).data()
      if (previous) {
        checkIdentity(previous, identity)
        if (previous.sourceHash !== sourceHash || previous.videoPath !== videoPath ||
            previous.bytes !== bytes || previous.sha256 !== sha256) throw conflict()
        return
      }
      if ((await transaction.get(db.collection('matches').doc(matchId))).exists) throw conflict()
      transaction.create(receiptRef, { ...identity, sourceHash, videoPath, bytes, sha256 })
    })
    signal?.throwIfAborted()
    const existing = await find(identity)
    if (existing) return existing
    try {
      await pipeline(createReadStream(localPath), bucket.file(videoPath).createWriteStream({
        resumable: false,
        validation: 'crc32c',
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { contentType: metadata.contentType, metadata: { uploadedBy: actorId, sha256 } },
      }), { signal })
    } catch (error) {
      if (Number(error.code) !== 412) throw error
    }
    signal?.throwIfAborted()
    const persisted = await find(identity)
    if (!persisted) throw new VideoImportError('failed', 'No pudimos confirmar la subida del video.')
    return persisted
  }

  return { find, putIfAbsent }
}
