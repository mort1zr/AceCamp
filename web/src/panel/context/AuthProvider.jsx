import { onAuthStateChanged } from 'firebase/auth'
import { useEffect, useMemo, useState } from 'react'
import { auth } from '../lib/firebaseAuth.js'
import { COLLECTIONS } from '../lib/schema.js'
import { AuthContext } from './AuthContext.js'

const cargarDb = () => import('../lib/firebase.js').then((m) => m.db)

let servicio
const cargarServicio = () =>
  (servicio ??= Promise.all([import('../lib/auth.js'), cargarDb()]).then(
    ([{ createAuthService }, db]) => createAuthService({ auth, db }),
  ))

const service = Object.fromEntries(
  ['registerCoach', 'login', 'logout'].map((metodo) => [
    metodo,
    (...datos) => cargarServicio().then((s) => s[metodo](...datos)),
  ]),
)

export default function AuthProvider({ children }) {
  const [session, setSession] = useState({ user: null, profile: null, loading: true })

  useEffect(() => {
    let stopProfile = () => {}

    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopProfile()
      if (!user) {
        setSession({ user: null, profile: null, loading: false })
        return
      }
      setSession({ user, profile: null, loading: true })
      let activo = true
      stopProfile = () => {
        activo = false
      }
      Promise.all([import('firebase/firestore'), cargarDb()]).then(([{ doc, onSnapshot }, db]) => {
        if (!activo) return
        // Se escucha la ficha porque en el registro la sesión empieza antes de que exista.
        stopProfile = onSnapshot(
          doc(db, COLLECTIONS.users, user.uid),
          (snapshot) => {
            const profile = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null
            setSession({ user, profile, loading: false })
          },
          () => setSession({ user, profile: null, loading: false }),
        )
      })
    })

    return () => {
      stopProfile()
      stopAuth()
    }
  }, [])

  const value = useMemo(() => ({ ...session, ...service }), [session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
