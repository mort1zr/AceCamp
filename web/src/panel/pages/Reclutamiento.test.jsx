// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { collection, onSnapshot, query, runTransaction, where } from 'firebase/firestore'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlanVistaContexto } from '../context/PlanVistaContext.js'
import { usePlayers } from '../hooks/usePlayers.js'
import { createFirestorePlayersService } from '../lib/services/firestorePlayersService.js'
import Reclutamiento from './Reclutamiento.jsx'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'applications'),
  where: vi.fn(() => 'org-filter'),
  query: vi.fn(() => 'org-applications'),
  onSnapshot: vi.fn(() => vi.fn()),
  doc: vi.fn((_, collection, id) => `${collection}/${id}`),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-time'),
}))

vi.mock('../components/recruitment/EnlacesPostulacion.jsx', () => ({ default: () => null }))
vi.mock('../hooks/usePlayers.js', () => ({ usePlayers: vi.fn(() => ({ rows: [], loading: false })) }))
vi.mock('../lib/services/firestorePlayersService.js', () => ({
  createFirestorePlayersService: vi.fn(() => ({ assignApplication: vi.fn() })),
}))
vi.mock('../components/players/PlayerProfile.jsx', () => ({
  default: ({ player }) => <h2>Ficha de {player.fullName}</h2>,
}))

const db = { app: { options: { projectId: 'prueba' } } }
const session = { uid: 'entrenador', orgId: 'equipo-a', role: 'coach' }

function page(currentSession = session, plan = 'pro') {
  return (
    <MemoryRouter>
      <PlanVistaContexto value={{ plan }}>
        <Reclutamiento db={db} session={currentSession} />
      </PlanVistaContexto>
    </MemoryRouter>
  )
}

function application(id, fullName, city, status, orgId = session.orgId, fields = {}) {
  return { id, data: () => ({ orgId, fullName, city, status, graduationYear: 2027, birthDate: '2000-02-15', ...fields }) }
}

function publish(...docs) {
  const [, receive] = onSnapshot.mock.lastCall
  act(() => receive({ docs }))
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  usePlayers.mockImplementation(() => ({ rows: [], loading: false }))
})

describe('Bandeja de reclutamiento', () => {
  it('lee solo postulaciones de la organización y combina búsqueda y estado', async () => {
    const user = userEvent.setup()
    render(page())
    expect(collection).toHaveBeenCalledWith(db, 'applications')
    expect(where).toHaveBeenCalledWith('orgId', '==', 'equipo-a')
    expect(query).toHaveBeenCalledWith('applications', 'org-filter')
    expect(onSnapshot).toHaveBeenCalledWith('org-applications', expect.any(Function), expect.any(Function))
    publish(
      application('1', 'Lucía Pérez', 'Lima', 'nueva'),
      application('2', 'Andrés Díaz', 'Lima', 'en revisión'),
      application('3', 'Paula Flores', 'Cusco', 'nueva'),
      application('4', 'Otra organización', 'Lima', 'nueva', 'equipo-b'),
    )

    const table = within(screen.getByRole('table', { name: 'Bandeja de postulaciones' }))
    expect(table.getAllByRole('row')).toHaveLength(4)
    const search = screen.getByRole('searchbox', { name: 'Buscar por nombre o ciudad' })
    await user.type(search, '  lucia ')
    expect(table.getByRole('cell', { name: 'Lucía Pérez' })).toBeTruthy()
    expect(table.queryByRole('cell', { name: 'Andrés Díaz' })).toBeNull()
    await user.clear(search)
    await user.type(search, 'lima')
    await user.selectOptions(screen.getByLabelText('Estado de postulación'), 'en revisión')
    expect(table.getByRole('cell', { name: 'Andrés Díaz' })).toBeTruthy()
    expect(table.queryByRole('cell', { name: 'Lucía Pérez' })).toBeNull()
    await user.selectOptions(screen.getByLabelText('Estado de postulación'), 'contactada')
    expect(screen.getByText('No hay coincidencias')).toBeTruthy()
  })

  it('reintenta tras un error y descarta los datos de la sesión anterior', async () => {
    const user = userEvent.setup()
    const { rerender } = render(page())
    const [, , fail] = onSnapshot.mock.lastCall
    act(() => fail(new Error('sin conexión')))
    expect(screen.getByRole('alert')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(onSnapshot).toHaveBeenCalledTimes(2)
    publish(application('1', 'Lucía Pérez', 'Lima', 'nueva'))
    expect(screen.getByText('Lucía Pérez')).toBeTruthy()
    const [, receiveOld] = onSnapshot.mock.lastCall
    const stopOld = onSnapshot.mock.results.at(-1).value
    rerender(page({ ...session, orgId: 'equipo-b' }))
    expect(stopOld).toHaveBeenCalled()
    expect(where).toHaveBeenLastCalledWith('orgId', '==', 'equipo-b')
    act(() => receiveOld({ docs: [application('1', 'Lucía Pérez', 'Lima', 'nueva')] }))
    expect(screen.queryByText('Lucía Pérez')).toBeNull()
    publish()
    expect(screen.getByText('Aún no llegan postulaciones')).toBeTruthy()
  })

  it('identifica en la bandeja un video confirmado sin mostrar su ruta', () => {
    render(page())
    const path = 'orgs/equipo-a/applications/1/video.mp4'
    publish(application('1', 'Lucía Pérez', 'Lima', 'nueva', session.orgId, { videoPaths: [path] }))
    const row = screen.getByRole('row', { name: /Lucía Pérez/ })
    expect(within(row).getByText('Video adjunto')).toBeTruthy()
    expect(row.textContent).not.toContain(path)
  })

  it('espera el plan y no consulta postulaciones con Básico', () => {
    const { rerender } = render(page(session, null))
    expect(onSnapshot).not.toHaveBeenCalled()
    rerender(page(session, 'basico'))
    expect(screen.getByRole('link', { name: 'Ver mi plan' })).toBeTruthy()
    expect(onSnapshot).not.toHaveBeenCalled()
  })

  it('guarda una transición permitida y actualiza el estado desde Firestore', async () => {
    const user = userEvent.setup()
    const transaction = {
      get: vi.fn(async () => application('1', 'Lucía Pérez', 'Lima', 'nueva')),
      update: vi.fn(),
    }
    runTransaction.mockImplementationOnce((_, update) => update(transaction))
    render(page())
    publish(application('1', 'Lucía Pérez', 'Lima', 'nueva'))

    const select = screen.getByLabelText('Nuevo estado de Lucía Pérez')
    expect(within(select).getAllByRole('option').map((option) => option.value)).toEqual(['', 'en revisión'])
    await user.selectOptions(select, 'en revisión')
    await user.click(screen.getByRole('button', { name: 'Guardar estado de Lucía Pérez' }))
    expect(await screen.findByText('Se guardó el estado de Lucía Pérez: en revisión.')).toBeTruthy()
    expect(transaction.update).toHaveBeenCalledExactlyOnceWith('applications/1', {
      status: 'en revisión', reviewedBy: session.uid, updatedAt: 'server-time',
    })
    publish(application('1', 'Lucía Pérez', 'Lima', 'en revisión'))
    expect(screen.getByRole('cell', { name: 'En revisión' })).toBeTruthy()
  })

  it('avisa si alguien cambió el estado mientras se editaba y evita sobrescribirlo', async () => {
    const user = userEvent.setup()
    const transaction = {
      get: vi.fn(async () => application('1', 'Lucía Pérez', 'Lima', 'analizada')),
      update: vi.fn(),
    }
    runTransaction.mockImplementationOnce((_, update) => update(transaction))
    render(page())
    publish(application('1', 'Lucía Pérez', 'Lima', 'nueva'))
    await user.selectOptions(screen.getByLabelText('Nuevo estado de Lucía Pérez'), 'en revisión')
    await user.click(screen.getByRole('button', { name: 'Guardar estado de Lucía Pérez' }))
    expect((await screen.findByRole('alert')).textContent).toContain('cambió en otra sesión')
    expect(transaction.update).not.toHaveBeenCalled()
  })

  it('reutiliza la ficha de alta con los datos de la postulación y exige autorización', async () => {
    const user = userEvent.setup()
    const assignApplication = vi.fn(async () => ({ id: 'jugadora-1', alreadyLinked: false }))
    createFirestorePlayersService.mockReturnValueOnce({ assignApplication })
    render(page())
    publish(application('1', 'Lucía Pérez', 'Lima', 'nueva'))
    await user.click(screen.getByRole('button', { name: 'Crear o vincular jugador para Lucía Pérez' }))
    await user.click(screen.getByRole('button', { name: 'Crear jugador nuevo' }))
    expect(screen.getByLabelText('Nombre completo *').value).toBe('Lucía Pérez')
    expect(screen.getByLabelText('Fecha de nacimiento *').value).toBe('2000-02-15')
    await user.click(screen.getByRole('button', { name: 'Guardar jugador' }))
    expect(assignApplication).not.toHaveBeenCalled()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Guardar jugador' }))
    expect(await screen.findByText('Jugador vinculado a la postulación.')).toBeTruthy()
    expect(assignApplication).toHaveBeenCalledExactlyOnceWith('1', {
      input: expect.objectContaining({ fullName: 'Lucía Pérez', consentAccepted: true }),
    })
  })

  it('ofrece vincular la ficha existente cuando coinciden el nombre y la fecha', async () => {
    const user = userEvent.setup()
    const player = { id: 'jugadora-1', fullName: 'Lucia Perez', birthDate: '2000-02-15' }
    usePlayers.mockReturnValue({ rows: [player], loading: false })
    const assignApplication = vi.fn(async () => ({ id: player.id, alreadyLinked: false }))
    createFirestorePlayersService.mockReturnValueOnce({ assignApplication })
    render(page())
    publish(application('1', 'Lucía Pérez', 'Lima', 'en revisión'))
    await user.click(screen.getByRole('button', { name: 'Crear o vincular jugador para Lucía Pérez' }))
    expect(screen.queryByRole('button', { name: 'Crear jugador nuevo' })).toBeNull()
    await user.selectOptions(screen.getByLabelText('Jugador existente'), player.id)
    await user.click(screen.getByRole('button', { name: 'Vincular jugador' }))
    expect(assignApplication).toHaveBeenCalledExactlyOnceWith('1', { playerId: player.id })
    publish(application('1', 'Lucía Pérez', 'Lima', 'en revisión', session.orgId, { playerId: player.id }))
    await user.click(screen.getByRole('button', { name: 'Ver ficha de Lucía Pérez' }))
    expect(screen.getByRole('heading', { name: 'Ficha de Lucia Perez' })).toBeTruthy()
  })
})
