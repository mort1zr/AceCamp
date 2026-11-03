export class VideoImportError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'VideoImportError'
    this.code = `import/${code}`
  }
}

export const invalidSource = () => new VideoImportError('source', 'Usa un enlace HTTPS directo de un proveedor admitido, sin credenciales.')

export function validateLimit(maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new TypeError('A positive server-side byte limit is required.')
}
