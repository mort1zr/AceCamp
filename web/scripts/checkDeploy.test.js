import { createServer } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { checkDeploy } from './checkDeploy.mjs'

let server
afterEach(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())))

// Servidor local que responde lo que diga `respuesta(n)` en la petición n.
function servir(respuesta) {
  let n = 0
  server = createServer((_req, res) => {
    n += 1
    const { status = 200, version } = respuesta(n)
    res.writeHead(status, { 'content-type': 'text/html' })
    res.end(`<html><head>${version ? `<meta name="acecam-version" content="${version}">` : ''}</head></html>`)
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}/`)))
}

describe('comprobación tras publicar (PCIT-199)', () => {
  it('pasa cuando la web responde con la versión esperada', async () => {
    const url = await servir(() => ({ version: 'abc123' }))
    expect(await checkDeploy({ url, expected: 'abc123', delayMs: 1 })).toMatchObject({ ok: true, attempts: 1 })
  })

  it('espera a que el CDN deje de servir la versión vieja', async () => {
    const url = await servir((n) => ({ version: n < 3 ? 'vieja' : 'abc123' }))
    expect(await checkDeploy({ url, expected: 'abc123', delayMs: 1 })).toMatchObject({ ok: true, attempts: 3 })
  })

  it('falla si sigue sirviendo otra versión o responde con error', async () => {
    const url = await servir(() => ({ version: 'vieja' }))
    expect(await checkDeploy({ url, expected: 'abc123', attempts: 2, delayMs: 1 })).toMatchObject({ ok: false, version: 'vieja', attempts: 2 })
    await new Promise((resolve) => server.close(resolve))
    const caida = await servir(() => ({ status: 503 }))
    expect(await checkDeploy({ url: caida, expected: 'abc123', attempts: 2, delayMs: 1 })).toMatchObject({ ok: false, status: 503 })
  })

  it('falla si la web no responde', async () => {
    const result = await checkDeploy({ url: 'http://127.0.0.1:9/', expected: 'abc123', attempts: 2, delayMs: 1 })
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })
})
