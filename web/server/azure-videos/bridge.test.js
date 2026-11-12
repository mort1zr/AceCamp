import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { sendResponse, toRequest } from './bridge.js'

const incoming = ({ method = 'POST', url = '/api/videos/sign', headers = {}, body = '' }) =>
  Object.assign(Readable.from(body ? [Buffer.from(body)] : []), { method, url, headers })

describe('adaptador node:http de la API de videos (PCIT-224)', () => {
  it('convierte la petición con sus encabezados y su cuerpo', async () => {
    const request = await toRequest(incoming({ headers: { authorization: 'Bearer t', 'x-multi': ['a', 'b'] }, body: '{"a":1}' }))
    expect(new URL(request.url).pathname).toBe('/api/videos/sign')
    expect(request.headers.get('authorization')).toBe('Bearer t')
    expect(request.headers.get('x-multi')).toBe('a, b')
    expect(await request.json()).toEqual({ a: 1 })
  })

  it('rechaza cuerpos demasiado grandes y no lee el cuerpo de OPTIONS', async () => {
    expect(await toRequest(incoming({ body: 'x'.repeat(5000) }))).toBeNull()
    expect((await toRequest(incoming({ method: 'OPTIONS' }))).method).toBe('OPTIONS')
  })

  it('escribe el estado, los encabezados y el cuerpo de la respuesta', async () => {
    const written = {}
    const outgoing = { writeHead: (status, headers) => Object.assign(written, { status, headers }), end: body => { written.body = body.toString() } }
    await sendResponse(outgoing, new Response('{"ok":true}', { status: 201, headers: { 'X-Test': '1' } }))
    expect(written).toMatchObject({ status: 201, body: '{"ok":true}' })
    expect(written.headers['x-test']).toBe('1')
  })
})
