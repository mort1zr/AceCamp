// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlanVistaContexto } from '../context/PlanVistaContext.js'
import Reclutamiento from './Reclutamiento.jsx'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'applications'),
  where: vi.fn(() => 'org-filter'),
  query: vi.fn(() => 'org-applications'),
  onSnapshot: vi.fn(() => vi.fn()),
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

function application(id, fullName, city, status, orgId = session.orgId) {
  return { id, data: () => ({ orgId, fullName, city, status, graduationYear: 2027 }) }
}

function publish(...docs) {
  const [, receive] = onSnapshot.mock.lastCall
  act(() => receive({ docs }))
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
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

  it('espera el plan y no consulta postulaciones con Básico', () => {
    const { rerender } = render(page(session, null))
    expect(onSnapshot).not.toHaveBeenCalled()
    rerender(page(session, 'basico'))
    expect(screen.getByRole('link', { name: 'Ver mi plan' })).toBeTruthy()
    expect(onSnapshot).not.toHaveBeenCalled()
  })
})
