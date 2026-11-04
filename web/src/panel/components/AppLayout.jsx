import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { useAuth } from '../context/AuthContext.js'
import { useEntrada } from '../context/EntradaContext.js'
import BarraLateral from './layout/BarraLateral.jsx'
import BarraSuperior from './layout/BarraSuperior.jsx'

export default function AppLayout() {
  const { user, profile, logout } = useAuth()
  const usuario = { nombre: profile?.displayName ?? user?.email }
  const entrada = useEntrada()

  useEffect(() => {
    entrada?.panelListo()
  }, [entrada])

  return (
    <div className="flex min-h-dvh bg-bg text-text">
      <BarraLateral />

      <div className="flex min-w-0 flex-1 flex-col">
        <BarraSuperior usuario={usuario} onSalir={logout} />
        <main className="min-w-0 flex-1 px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
