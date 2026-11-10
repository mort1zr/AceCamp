// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addDoc, getDocFromServer } from 'firebase/firestore'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Postular from './Postular.jsx'

vi.mock('../../panel/lib/firebase.js', () => ({ db: {} }))
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
    expect(addDoc).toHaveBeenCalledExactlyOnceWith('applications', expect.objectContaining({
      orgId: 'org-demo', formId: 'AcecamFormDemoABC123', status: 'nueva', guardian: null,
      consent: expect.objectContaining({ accepted: true, method: 'self', recordedBy: 'public-form' }),
    }))
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

  it('oculta los campos cuando el enlace fue desactivado', async () => {
    getDocFromServer.mockRejectedValueOnce({ code: 'permission-denied' })
    renderForm()
    expect((await screen.findByRole('alert')).textContent).toContain('no está disponible')
    expect(screen.queryByRole('form')).toBeNull()
  })
})
