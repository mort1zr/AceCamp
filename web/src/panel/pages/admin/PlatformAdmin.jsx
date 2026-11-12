import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import Logo from '../../../compartido/components/Logo.jsx'
import { useTextos } from '../../../compartido/lib/idioma.jsx'
import { useAuth } from '../../context/AuthContext.js'
import { db } from '../../lib/firebase.js'
import { COLLECTIONS } from '../../lib/schema.js'

const textos = {
  es: {
    title: 'Administración de AceCam',
    directory: 'Directorio',
    audit: 'Auditoría',
    home: 'Volver al inicio',
    logout: 'Cerrar sesión',
    leaving: 'Cerrando sesión…',
    logoutError: 'No pudimos cerrar la sesión. Inténtalo de nuevo.',
    checking: 'Verificando acceso…',
    denied: 'Acceso denegado',
    deniedDetail: 'Tu cuenta no tiene permiso de administrador de plataforma.',
    unavailable: 'No pudimos verificar tu permiso de administración. Inténtalo de nuevo.',
    retry: 'Reintentar',
  },
  en: {
    title: 'AceCam Administration',
    directory: 'Directory',
    audit: 'Audit log',
    home: 'Back to home',
    logout: 'Sign out',
    leaving: 'Signing out…',
    logoutError: 'We could not sign you out. Try again.',
    checking: 'Checking access…',
    denied: 'Access denied',
    deniedDetail: 'Your account does not have platform administrator access.',
    unavailable: 'We could not verify your administration access. Try again.',
    retry: 'Try again',
  },
}

function AdminSession({ uid, logout }) {
  const t = useTextos(textos)
  const navigate = useNavigate()
  const [access, setAccess] = useState('checking')
  const [attempt, setAttempt] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [logoutError, setLogoutError] = useState(false)

  useEffect(() => {
    return onSnapshot(doc(db, COLLECTIONS.platformAdmins, uid), { includeMetadataChanges: true }, snapshot => {
      if (snapshot.metadata.fromCache) {
        setAccess('checking')
        return
      }
      setAccess(snapshot.exists() ? 'allowed' : 'denied')
    }, () => setAccess('unavailable'))
  }, [uid, attempt])

  async function leave() {
    setLogoutError(false)
    setLeaving(true)
    try {
      await logout()
      navigate('/', { replace: true })
    } catch {
      setLogoutError(true)
      setLeaving(false)
    }
  }

  return (
    <div className="min-h-dvh bg-bg text-text">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link to="/" aria-label={t.home}><Logo /></Link>
          <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm hover:border-line2" disabled={leaving} onClick={leave}>
            {leaving ? t.leaving : t.logout}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-4 px-5 py-8 sm:px-8">
        {logoutError && <p role="alert">{t.logoutError}</p>}
        {access === 'checking' && <p role="status">{t.checking}</p>}
        {access === 'denied' && (
          <section role="alert">
            <h1 className="font-display text-2xl font-bold">{t.denied}</h1>
            <p className="mt-2 text-text2">{t.deniedDetail}</p>
          </section>
        )}
        {access === 'unavailable' && (
          <div>
            <p role="alert">{t.unavailable}</p>
            <button type="button" className="mt-2 rounded-lg border border-line px-3 py-2 text-sm" onClick={() => {
              setAccess('checking')
              setAttempt(current => current + 1)
            }}>{t.retry}</button>
          </div>
        )}
        {access === 'allowed' && (
          <>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{t.title}</h1>
            <nav aria-label={t.title} className="flex flex-wrap gap-4 text-sm">
              <Link to="/admin" className="underline">{t.directory}</Link>
              <Link to="/admin/auditoria" className="underline">{t.audit}</Link>
            </nav>
            <Outlet />
          </>
        )}
      </main>
    </div>
  )
}

export default function PlatformAdmin() {
  const { user, loading, logout } = useAuth()
  const location = useLocation()
  const t = useTextos(textos)
  if (loading) return <p role="status" className="p-5">{t.checking}</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <AdminSession key={user.uid} uid={user.uid} logout={logout} />
}
