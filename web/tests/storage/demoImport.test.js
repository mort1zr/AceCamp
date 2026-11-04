import { createHash } from 'node:crypto'
import { mkdtemp, rm, rmdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createDemoImportStore } from '../../server/video-import/demoStore.js'

let app
let directory
let db
let bucket
let input
const body = Buffer.from('bytes reservados para la prueba de persistencia')
const hash = value => createHash('sha256').update(value).digest('hex')

beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' ||
      process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:9199') {
    throw new Error('Ejecuta npm run test:rules con los emuladores locales.')
  }
  app = initializeApp({ projectId: 'demo-acecam', storageBucket: 'demo-acecam.appspot.com' }, 'demo-import-test')
  db = getFirestore(app)
  bucket = getStorage(app).bucket()
  directory = await mkdtemp(join(tmpdir(), 'acecam-store-test-'))
  const localPath = join(directory, 'fixture')
  await writeFile(localPath, body)
  input = {
    orgId: 'org-import-test', actorId: 'coach-import-test', matchId: 'demo-import-test',
    sourceHash: hash('source'), sha256: hash(body), bytes: body.length, localPath,
    metadata: { extension: 'mp4', contentType: 'video/mp4' },
  }
})

afterAll(async () => {
  if (app) await deleteApp(app)
  if (directory) {
    await rm(join(directory, 'fixture'), { force: true })
    await rmdir(directory)
  }
})

it('conserva un único recibo y objeto al reintentar desde una instancia nueva', async () => {
  const first = createDemoImportStore({ db, bucket })
  const result = await first.putIfAbsent(input)
  const file = bucket.file(result.videoPath)
  const [before] = await file.getMetadata()
  const second = createDemoImportStore({ db, bucket })
  expect(await second.find(input)).toEqual(result)
  expect(await second.putIfAbsent(input)).toEqual(result)
  const [after] = await file.getMetadata()
  expect(after.generation).toBe(before.generation)
  expect((await file.download())[0]).toEqual(body)
  await expect(second.putIfAbsent({ ...input, sourceHash: hash('otra fuente') })).rejects.toMatchObject({ code: 'import/conflict' })
  await expect(second.find({ ...input, orgId: 'org-ajena' })).rejects.toMatchObject({ code: 'import/conflict' })
})
