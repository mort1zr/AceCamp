// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addDoc, getDocFromServer } from 'firebase/firestore'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateLocalVideo } from '../../panel/lib/validateLocalVideo.js'
import Postular from './Postular.jsx'

vi.mock('../../panel/lib/firebase.js', () => ({ db: {} }))
vi.mock('../../panel/lib/validateLocalVideo.js', () => ({ validateLocalVideo: vi.fn(async () => null) }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_, ...parts) => parts.join('/')),
  doc: vi.fn((parent, id) => `${parent}/${id}`),
  getDocFromServer: vi.fn(),
  addDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-time'),
}))

function renderForm() {
  render(
    <MemoryRouter initialEntries={['/postular/org-demo/AcecamFormDemoABC123']}>
      <Routes><Route path="/postular/:orgId/:formId" element={<Postular />} /></Routes>
    </MemoryRouter>,
  )
}

async function fill(user, birthDate) {
  await user.type(await screen.findByLabelText('Nombre completo'), 'Valentina Demo')
  fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: birthDate } })
  await user.type(screen.getByLabelText('Ciudad'), 'Lima')
  await user.type(screen.getByLabelText('Correo de contacto'), 'valentina@example.test')
  await user.type(screen.getByLabelText('Año de graduación'), '2027')
}

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Formulario público de postulación', () => {
  it('envía sin sesión una postulación con consentimiento y muestra confirmación', async () => {
    const user = userEvent.setup()
    getDocFromServer.mockResolvedValueOnce({ exists: () => true })
    addDoc.mockResolvedValueOnce({ id: 'application-demo' })
    renderForm()
    await fill(user, '2000-02-15')
    const consent = screen.getByRole('checkbox')
    expect(consent.required).toBe(true)
    await user.click(consent)
    await user.click(screen.getByRole('button', { name: 'Enviar postulación' }))
    expect(await screen.findByText(/Recibimos tu postulación/)).toBeTruthy()
    // PCIT-186: el número de referencia sale del ID de la postulación guardada.
    expect(screen.getByText('AC-APPLIC')).toBeTruthy()
    expect(addDoc).toHaveBeenCalledExactlyOnceWith('applications', expect.objectContaining({
      orgId: 'org-demo', formId: 'AcecamFormDemoABC123', status: 'nueva', guardian: null,
      consent: expect.objectContaining({ accepted: true, method: 'self', recordedBy: 'public-form' }),
    }))
  })

  it('envía el perfil deportivo y los enlaces de video opcionales', async () => {
    const user = userEvent.setup()
    getDocFromServer.mockResolvedValueOnce({ exists: () => true })
    addDoc.mockResolvedValueOnce({ id: 'application-demo' })
    renderForm()
    await fill(user, '2000-02-15')
    await user.type(screen.getByLabelText('UTR (opcional)'), '9.5')
    await user.type(screen.getByLabelText('Ranking nacional (opcional)'), '12')
    await user.click(screen.getByRole('button', { name: 'zurdo' }))
    await user.click(screen.getByRole('button', { name: 'dos manos' }))
    await user.type(screen.getByLabelText('Enlaces de video (opcional)'), 'https://youtu.be/abc123{enter}www.youtube.com/watch?v=xyz')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Enviar postulación' }))
    expect(await screen.findByText(/Recibimos tu postulación/)).toBeTruthy()
    expect(addDoc).toHaveBeenCalledExactlyOnceWith('applications', expect.objectContaining({
      utr: 9.5, nationalRanking: 12, dominantHand: 'zurdo', backhand: 'dos manos',
      videoLinks: ['https://youtu.be/abc123', 'https://www.youtube.com/watch?v=xyz'],
    }))
  })

  it('rechaza enlaces que no son de YouTube antes de guardar', async () => {
    const user = userEvent.setup()
    getDocFromServer.mockResolvedValueOnce({ exists: () => true })
    renderForm()
    await fill(user, '2000-02-15')
    await user.type(screen.getByLabelText('Enlaces de video (opcional)'), 'https://ejemplo.com/video')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Enviar postulación' }))
    expect(await screen.findByText('Usa enlaces de YouTube válidos, uno por línea.')).toBeTruthy()
    expect(addDoc).not.toHaveBeenCalled()
  })

  it('pide los datos del apoderado y bloquea un envío sin consentimiento', async () => {
    const user = userEvent.setup()
    getDocFromServer.mockResolvedValueOnce({ exists: () => true })
    renderForm()
    await fill(user, '2020-05-08')
    await user.type(screen.getByLabelText('Nombre del apoderado'), 'Apoderado Demo')
    await user.type(screen.getByLabelText('Teléfono del apoderado'), '999111222')
    await user.type(screen.getByLabelText('Correo del apoderado'), 'adulto@example.test')
    fireEvent.submit(screen.getByRole('form', { name: 'Formulario de postulación' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(addDoc).not.toHaveBeenCalled()
  })

  it('muestra el error debajo de cada campo de contacto inválido (PCIT-183)', async () => {
    const user = userEvent.setup()
    getDocFromServer.mockResolvedValueOnce({ exists: () => true })
    renderForm()
    await user.type(await screen.findByLabelText('Nombre completo'), 'Valentina Demo')
    fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: '2000-02-15' } })
    await user.type(screen.getByLabelText('Ciudad'), 'L')
    await user.type(screen.getByLabelText('Correo de contacto'), 'vale@example.test')
    await user.type(screen.getByLabelText('Año de graduación'), '2027')
    await user.click(screen.getByRole('checkbox'))
    fireEvent.submit(screen.getByRole('form', { name: 'Formulario de postulación' }))
    expect(await screen.findByText('Escribe tu ciudad (entre 2 y 100 caracteres).')).toBeTruthy()
    expect(screen.getByLabelText('Ciudad').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByLabelText('Correo de contacto').getAttribute('aria-invalid')).toBe('false')
    expect(screen.getByRole('alert').textContent).toContain('Revisa los campos marcados')
    expect(addDoc).not.toHaveBeenCalled()
  })

  it('ignora en silencio un envío con el campo trampa lleno (PCIT-185)', async () => {
    const user = userEvent.setup()
    getDocFromServer.mockResolvedValueOnce({ exists: () => true })
    renderForm()
    await fill(user, '2000-02-15')
    await user.click(screen.getByRole('checkbox'))
    const trampa = document.getElementById('website')
    // Oculto para personas: fuera del orden del teclado y de los lectores de pantalla.
    expect(trampa.tabIndex).toBe(-1)
    expect(trampa.closest('[aria-hidden="true"]')).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Sitio web' })).toBeNull()
    fireEvent.change(trampa, { target: { value: 'https://spam.example' } })
    await user.click(screen.getByRole('button', { name: 'Enviar postulación' }))
    expect(await screen.findByText(/Recibimos tu postulación/)).toBeTruthy()
    expect(addDoc).not.toHaveBeenCalled()
  })

  it('oculta los campos cuando el enlace fue desactivado', async () => {
    getDocFromServer.mockRejectedValueOnce({ code: 'permission-denied' })
    renderForm()
    expect((await screen.findByRole('alert')).textContent).toContain('no está disponible')
    expect(screen.queryByRole('form')).toBeNull()
  })

  it('rechaza baja resolución antes de guardar la postulación o transferir bytes', async () => {
    const user = userEvent.setup()
    vi.stubEnv('MODE', 'demo')
    getDocFromServer.mockResolvedValueOnce({ exists: () => true })
    const message = 'El video debe tener al menos 720p (1280×720). Grábalo o expórtalo en 720p o 1080p.'
    validateLocalVideo.mockResolvedValueOnce(message)
    const fetchVideo = vi.fn()
    vi.stubGlobal('fetch', fetchVideo)
    renderForm()
    await fill(user, '2000-02-15')
    const video = screen.getByLabelText('Video (opcional)')
    expect(document.getElementById(video.getAttribute('aria-describedby')).textContent).toContain('25 a 60 FPS')
    await user.upload(video, new File(['demo'], 'clip.mp4', { type: 'video/mp4' }))
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Enviar postulación' }))
    expect((await screen.findByRole('alert')).textContent).toBe(message)
    expect(addDoc).not.toHaveBeenCalled()
    expect(fetchVideo).not.toHaveBeenCalled()
  })

  it('reintenta el video sobre la misma postulación tras una carga fallida', async () => {
    const user = userEvent.setup()
    vi.stubEnv('MODE', 'demo')
    getDocFromServer.mockResolvedValueOnce({ exists: () => true })
    addDoc.mockResolvedValueOnce({ id: 'ApplicationDemo12345' })
    const fetchVideo = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Reintenta el video.' }), { status: 503 }))
      .mockResolvedValueOnce(new Response('{"attached":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetchVideo)
    renderForm()
    await fill(user, '2000-02-15')
    const clip = new File(['demo'], 'clip.mp4', { type: 'video/mp4' })
    await user.upload(screen.getByLabelText('Video (opcional)'), clip)
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Enviar postulación' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Reintenta el video.')
    await user.click(screen.getByRole('button', { name: 'Reintentar video' }))
    expect(await screen.findByText(/Recibimos tu postulación/)).toBeTruthy()
    expect(addDoc).toHaveBeenCalledTimes(1)
    expect(addDoc.mock.calls[0][1].consent.version).toBe('applications-video-v1')
    expect(fetchVideo.mock.calls.map(([url]) => url)).toEqual(Array(2).fill(
      '/api/application-video/org-demo/AcecamFormDemoABC123/ApplicationDemo12345',
    ))
  })
})
