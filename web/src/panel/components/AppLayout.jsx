import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { useAuth } from '../context/AuthContext.js'
import { useEntrada } from '../context/EntradaContext.js'
import PlanVistaProvider from '../context/PlanVistaProvider.jsx'
import { usePlanOrganizacion } from '../hooks/usePlanOrganizacion.js'
import { db } from '../lib/firebase.js'
import BarraLateral from './layout/BarraLateral.jsx'
import BarraSuperior from './layout/BarraSuperior.jsx'

export default function AppLayout() {
  const { user, profile, logout } = useAuth()
  const usuario = { nombre: profile?.displayName ?? user?.email, correo: user?.email }
  const entrada = useEntrada()
  const { plan: planReal, usados } = usePlanOrganizacion(db, profile?.orgId)

  useEffect(() => {
    entrada?.panelListo()
  }, [entrada])

  return (
    <PlanVistaProvider planReal={planReal} usados={usados}>
      <div className="flex min-h-dvh bg-bg text-text">
        <BarraLateral />

        <div className="flex min-w-0 flex-1 flex-col">
          <BarraSuperior usuario={usuario} onSalir={logout} />
          <main className="min-w-0 flex-1 px-6 py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </PlanVistaProvider>
  )
}
