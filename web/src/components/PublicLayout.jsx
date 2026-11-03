import { useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import ControlsPill from './ControlsPill.jsx'
import FloatingNav from './FloatingNav.jsx'
import PublicFooter from './PublicFooter.jsx'
import PublicHeader from './PublicHeader.jsx'

export default function PublicLayout() {
  const { pathname } = useLocation()
  const esLanding = pathname === '/'
  const esPrecios = pathname === '/precios'
  const [navAbierto, setNavAbierto] = useState(false)

  return (
    <div className="min-h-dvh bg-bg text-text">
      {esLanding ? (
        <>
          <FloatingNav onExpandir={setNavAbierto} />
          <ControlsPill ocultarIngreso={navAbierto} />
        </>
      ) : esPrecios ? (
        <ControlsPill />
      ) : (
        <PublicHeader />
      )}
      <main>
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  )
}
