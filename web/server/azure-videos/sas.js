// Enlaces temporales (SAS) para un blob de video (PCIT-223).
// - En Azure: firma con una clave de delegación de usuario obtenida con la identidad
//   administrada de la app. No hay ninguna clave del almacenamiento en el código.
// - En Azurite (pruebas): firma con la credencial de desarrollo del emulador.

import { BlobSASPermissions, SASProtocol, StorageSharedKeyCredential, generateBlobSASQueryParameters } from '@azure/storage-blob'

/**
 * @param {object} options
 * @param {import('@azure/storage-blob').BlobServiceClient} options.serviceClient
 * @param {string} options.container
 * @param {boolean} [options.allowHttp]  Solo para Azurite, que no usa HTTPS.
 * @param {() => Date} [options.now]
 */
export function createSasSigner({ serviceClient, container, allowHttp = false, now = () => new Date() }) {
  const sharedKey = serviceClient.credential instanceof StorageSharedKeyCredential ? serviceClient.credential : null
  const blob = name => serviceClient.getContainerClient(container).getBlobClient(name)

  return {
    /** permissions: 'cw' para subir, 'r' para leer. */
    async sign(blobName, { permissions, minutes }) {
      const current = now().getTime()
      const startsOn = new Date(current - 60_000)
      const expiresOn = new Date(current + minutes * 60_000)
      const options = {
        containerName: container, blobName, startsOn, expiresOn,
        permissions: BlobSASPermissions.parse(permissions),
        protocol: allowHttp ? SASProtocol.HttpsAndHttp : SASProtocol.Https,
      }
      const query = sharedKey
        ? generateBlobSASQueryParameters(options, sharedKey)
        : generateBlobSASQueryParameters(options, await serviceClient.getUserDelegationKey(startsOn, expiresOn), serviceClient.accountName)
      return { url: `${blob(blobName).url}?${query}`, expiresOn: expiresOn.toISOString() }
    },

    /** Autor guardado al subir (metadato uploadedby), o null si el blob no existe. */
    async uploadedBy(blobName) {
      try {
        return (await blob(blobName).getProperties()).metadata?.uploadedby ?? null
      } catch (failure) {
        if (failure?.statusCode === 404) return null
        throw failure
      }
    },
  }
}
