import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../context/AuthContext.js'
import { ErrorState } from './ui/index.js'

// Rutas privadas (PCIT-21): sin sesión, al login; al volver, a la página que pedía.
export default function RequireAuth() {
  const { user, profile, loading, logout } = useAuth()
  const location = useLocation()

  if (loading) return <div aria-busy="true" className="min-h-dvh bg-bg" />

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  // Cuenta sin ficha en users: el registro no terminó.
  if (!profile) {
    return (
      <div className="grid min-h-dvh place-content-center bg-bg">
        <ErrorState
          title="Tu cuenta no tiene una organización"
          description="El registro no terminó. Cierra sesión y vuelve a registrarte."
          onRetry={logout}
          retryLabel="Cerrar sesión"
        />
      </div>
    )
  }

  return <Outlet />
}
