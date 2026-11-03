import { Outlet } from 'react-router'
import PublicFooter from './PublicFooter.jsx'
import PublicHeader from './PublicHeader.jsx'

export default function PublicLayout() {
  return (
    <div className="min-h-dvh bg-bg text-text">
      <PublicHeader />
      <main>
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  )
}
