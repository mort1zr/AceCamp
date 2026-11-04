import { Outlet } from 'react-router'
import BarraLateral from './panel/BarraLateral.jsx'
import BarraSuperior from './panel/BarraSuperior.jsx'

export default function AppLayout() {
  return (
    <div className="flex min-h-dvh bg-bg text-text">
      <BarraLateral />

      <div className="flex min-w-0 flex-1 flex-col">
        <BarraSuperior />
        <main className="min-w-0 flex-1 px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
