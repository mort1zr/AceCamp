import { useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import ControlsPill from '../../compartido/components/ControlsPill.jsx'
import FloatingNav from './FloatingNav.jsx'
import PublicFooter from './PublicFooter.jsx'
import PublicHeader from './PublicHeader.jsx'

export default function PublicLayout() {
  const { pathname } = useLocation()
  const esLanding = pathname === '/'
  const esPrecios = pathname === '/precios'
  const [navAbierto, setNavAbierto] = useState(false)

  return (
    <div className={`min-h-dvh text-text ${esPrecios ? '' : 'bg-bg'}`}>
      {esLanding ? (
        <>
          <FloatingNav onExpandir={setNavAbierto} />
          <ControlsPill
            ocultarIngreso={navAbierto}
            className={navAbierto ? 'max-sm:pointer-events-none max-sm:opacity-0' : ''}
          />
        </>
      ) : esPrecios ? (
        <ControlsPill className="max-sm:absolute" />
      ) : (
        <PublicHeader />
      )}
      <main>
        <Outlet />
      </main>
      {esPrecios ? null : <PublicFooter />}
    </div>
  )
}
