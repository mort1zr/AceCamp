// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataTable, EmptyState, ErrorState, KpiCard, SegmentedControl, StatusBadge } from './index.js'

afterEach(cleanup)

describe('Indicadores y estados', () => {
  it('conserva cero y diferencia las métricas que no están disponibles', () => {
    render(<><KpiCard label="Dobles faltas" value={0} unit="faltas" /><KpiCard label="Velocidad" value={null} unit="km/h" /></>)
    const cards = screen.getAllByRole('article')
    expect(cards[0].textContent).toContain('0 faltas')
    expect(cards[1].textContent).toContain('—')
    expect(cards[1].textContent).not.toContain('km/h')
  })

  it('muestra estados conocidos, desconocidos y ausentes con texto legible', () => {
    render(<><StatusBadge status="  LISTO " /><StatusBadge status="Nuevo estado" /><StatusBadge /></>)
    expect(screen.getByText('Listo')).toBeTruthy()
    expect(screen.getByText('Nuevo estado')).toBeTruthy()
    expect(screen.getByText('Sin estado')).toBeTruthy()
  })

  it('ejecuta las acciones de vacío y error, sin enviar un formulario contenedor', async () => {
    const action = vi.fn()
    const retry = vi.fn()
    const submit = vi.fn(event => event.preventDefault())
    render(<form onSubmit={submit}><EmptyState actionLabel="Crear jugador" onAction={action} /><ErrorState description="No hay conexión" onRetry={retry} /></form>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Crear jugador' }))
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(action).toHaveBeenCalledTimes(1)
    expect(retry).toHaveBeenCalledTimes(1)
    expect(submit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('No hay conexión')
  })
})

describe('Tabla', () => {
  const columns = [{ key: 'name', label: 'Jugador' }, { key: 'count', label: 'Partidos', align: 'right' }, { key: 'status', label: 'Estado', render: status => <StatusBadge status={status} /> }]
  const rows = [{ id: 'one', name: 'Ana', count: 0, status: 'listo' }, { id: 'two', name: 'Luis', count: null, status: 'en cola' }]

  it('representa encabezados, ceros, datos ausentes y celdas personalizadas', () => {
    render(<DataTable caption="Jugadores" columns={columns} rows={rows} />)
    const table = screen.getByRole('table', { name: 'Jugadores' })
    expect(within(table).getAllByRole('columnheader')).toHaveLength(3)
    expect(within(table).getByRole('cell', { name: '0' })).toBeTruthy()
    expect(within(table).getByRole('cell', { name: '—' })).toBeTruthy()
    expect(within(table).getByRole('cell', { name: 'Listo' })).toBeTruthy()
  })

  it('no presenta datos obsoletos durante carga/error y permite reintentar', async () => {
    const retry = vi.fn()
    const { rerender } = render(<DataTable caption="Jugadores" columns={columns} rows={rows} loading error="Error anterior" />)
    expect(screen.getByRole('region', { name: 'Jugadores' }).getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('status').textContent).toContain('Cargando')
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    rerender(<DataTable caption="Jugadores" columns={columns} rows={rows} error="Sin conexión" onRetry={retry} />)
    expect(screen.getByRole('alert').textContent).toContain('Sin conexión')
    expect(screen.queryByRole('table')).toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(retry).toHaveBeenCalledTimes(1)
    rerender(<DataTable caption="Jugadores" columns={columns} rows={rows} />)
    expect(screen.getByRole('table', { name: 'Jugadores' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('explica el vacío sin confundirlo con un fallo', () => {
    render(<DataTable caption="Jugadores" columns={columns} emptyTitle="Sin jugadores" emptyDescription="Registra tu primer jugador." />)
    expect(screen.getByRole('status').textContent).toContain('Registra tu primer jugador.')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('Selector segmentado', () => {
  const options = [{ value: 'month', label: 'Mes' }, { value: 'quarter', label: '3 meses', disabled: true }, { value: 'all', label: 'Todo' }]

  function SelectorExample() {
    const [period, setPeriod] = useState('month')
    return <><SegmentedControl label="Periodo" options={options} value={period} onChange={setPeriod} /><SegmentedControl label="Otro selector" options={options} value="month" onChange={() => {}} /></>
  }

  it('permite cambiar con teclado, salta opciones deshabilitadas y aísla instancias', async () => {
    render(<SelectorExample />)
    const user = userEvent.setup()
    const group = screen.getByRole('group', { name: 'Periodo' })
    const month = within(group).getByRole('radio', { name: 'Mes' })
    await user.tab()
    expect(document.activeElement).toBe(month)
    await user.keyboard('{ArrowRight}')
    expect(within(group).getByRole('radio', { name: 'Todo' }).checked).toBe(true)
    expect(within(group).getByRole('radio', { name: '3 meses' }).checked).toBe(false)
    expect(within(screen.getByRole('group', { name: 'Otro selector' })).getByRole('radio', { name: 'Mes' }).checked).toBe(true)
  })

  it('no cambia un selector deshabilitado', async () => {
    const onChange = vi.fn()
    render(<SegmentedControl label="Periodo" options={options} value="month" onChange={onChange} disabled />)
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Todo' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
