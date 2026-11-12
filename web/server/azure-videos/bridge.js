// Adapta node:http a la API Request -> Response de http.js (PCIT-224).

const MAX_BODY_BYTES = 4096

export async function toRequest(incoming, { maxBytes = MAX_BODY_BYTES } = {}) {
  const headers = new Headers()
  for (const [name, value] of Object.entries(incoming.headers)) {
    for (const item of [value].flat()) if (item !== undefined) headers.append(name, item)
  }
  let body
  if (!['GET', 'HEAD', 'OPTIONS'].includes(incoming.method)) {
    const chunks = []
    let size = 0
    for await (const chunk of incoming) {
      size += chunk.length
      if (size > maxBytes) return null
      chunks.push(chunk)
    }
    body = Buffer.concat(chunks)
  }
  return new Request(`http://localhost${incoming.url}`, { method: incoming.method, headers, body })
}

export async function sendResponse(outgoing, response) {
  outgoing.writeHead(response.status, Object.fromEntries(response.headers))
  outgoing.end(Buffer.from(await response.arrayBuffer()))
}
