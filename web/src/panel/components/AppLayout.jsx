import { useEffect, useState } from 'react'
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

  const [menu, setMenu] = useState(false)

  useEffect(() => {
    entrada?.panelListo()
  }, [entrada])

  useEffect(() => {
    if (!menu) return undefined
    const cerrar = (evento) => evento.key === 'Escape' && setMenu(false)
    window.addEventListener('keydown', cerrar)
    return () => window.removeEventListener('keydown', cerrar)
  }, [menu])

  return (
    <PlanVistaProvider planReal={planReal} usados={usados}>
      <div className="relative flex min-h-dvh overflow-clip bg-bg text-text">
        <BarraLateral />

        <div
          inert={!menu}
          className={`absolute inset-x-0 top-0 z-50 h-[calc(100%+100lvh)] transition-[visibility] duration-300 md:hidden ${menu ? 'visible' : 'pointer-events-none invisible'}`}
        >
          <div className="sticky top-0 h-lvh">
            <div
              onClick={() => setMenu(false)}
              className={`absolute inset-0 backdrop-blur-[2px] backdrop-brightness-[0.45] transition-opacity duration-300 ${
                menu ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Menú"
              className={`absolute inset-y-0 left-0 w-[min(84vw,320px)] border-r border-chip shadow-tile transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                menu ? 'translate-x-0' : '-translate-x-full'
              }`}
            >
              <BarraLateral movil onCerrar={() => setMenu(false)} />
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <BarraSuperior usuario={usuario} onSalir={logout} onMenu={() => setMenu(true)} />
          <main className="min-w-0 flex-1 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-6 md:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </PlanVistaProvider>
  )
}
