// API de videos en Azure (PCIT-224, historia PCIT-222). Corre en Azure Container Apps.
// Variables de entorno:
//   AZURE_STORAGE_ACCOUNT     cuenta de almacenamiento (acecamvideosfba600)
//   AZURE_STORAGE_CONTAINER   contenedor de videos (por defecto, videos)
//   AZURE_CLIENT_ID           identidad administrada de la app (firma los enlaces, sin claves)
//   FIREBASE_PROJECT_ID       proyecto de Firebase (acecam-e93a2)
//   FIREBASE_SERVICE_ACCOUNT  JSON de la cuenta de servicio de solo lectura de Firestore (secreto)
//   ALLOWED_ORIGIN            origen exacto de la web (https://acecam-e93a2.web.app)
//   PORT                      por defecto, 8080

import { createServer } from 'node:http'
import { DefaultAzureCredential } from '@azure/identity'
import { BlobServiceClient } from '@azure/storage-blob'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { sendResponse, toRequest } from './bridge.js'
import { createAzureVideoHandler } from './http.js'
import { createSasSigner } from './sas.js'

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Falta la variable de entorno ${name}.`)
  return value
}

const account = required('AZURE_STORAGE_ACCOUNT')
if (!/^[a-z0-9]{3,24}$/.test(account)) throw new Error('AZURE_STORAGE_ACCOUNT no es un nombre de cuenta válido.')
const firebase = initializeApp({
  credential: cert(JSON.parse(required('FIREBASE_SERVICE_ACCOUNT'))),
  projectId: required('FIREBASE_PROJECT_ID'),
})
const serviceClient = new BlobServiceClient(
  `https://${account}.blob.core.windows.net`,
  new DefaultAzureCredential({ managedIdentityClientId: process.env.AZURE_CLIENT_ID }),
)
const handler = createAzureVideoHandler({
  verifyIdToken: token => getAuth(firebase).verifyIdToken(token),
  db: getFirestore(firebase),
  signer: createSasSigner({ serviceClient, container: process.env.AZURE_STORAGE_CONTAINER || 'videos' }),
  origin: required('ALLOWED_ORIGIN'),
})

createServer(async (incoming, outgoing) => {
  const started = Date.now()
  let status = 500
  try {
    if (incoming.url === '/healthz') {
      status = 200
      outgoing.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok')
      return
    }
    const request = await toRequest(incoming)
    if (!request) {
      status = 413
      outgoing.writeHead(413).end()
      return
    }
    const response = await handler(request)
    status = response.status
    await sendResponse(outgoing, response)
  } catch (error) {
    console.error(`Error en la API de videos: ${error?.message}`)
    if (!outgoing.headersSent) outgoing.writeHead(500, { 'Content-Type': 'application/json' }).end('{"error":"interno"}')
  } finally {
    // Registro de accesos sin datos personales: método, ruta, estado y duración.
    console.log(JSON.stringify({ method: incoming.method, path: incoming.url?.split('?')[0], status, ms: Date.now() - started }))
  }
}).listen(Number(process.env.PORT || 8080), () => console.log('API de videos lista'))
