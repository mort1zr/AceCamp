import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { createAuthService } from '../lib/auth.js'
import { auth, db } from '../lib/firebase.js'
import { COLLECTIONS } from '../lib/schema.js'
import { AuthContext } from './AuthContext.js'

const service = createAuthService({ auth, db })

export default function AuthProvider({ children }) {
  const [session, setSession] = useState({ user: null, profile: null, loading: true })

  useEffect(() => {
    let stopProfile = () => {}

    const stopAuth = onAuthStateChanged(auth, user => {
      stopProfile()
      if (!user) {
        setSession({ user: null, profile: null, loading: false })
        return
      }
      setSession({ user, profile: null, loading: true })
      // Se escucha la ficha porque en el registro la sesión empieza antes de que exista.
      stopProfile = onSnapshot(
        doc(db, COLLECTIONS.users, user.uid),
        snapshot => {
          const profile = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null
          setSession({ user, profile, loading: false })
        },
        () => setSession({ user, profile: null, loading: false }),
      )
    })

    return () => {
      stopProfile()
      stopAuth()
    }
  }, [])

  const value = useMemo(() => ({ ...session, ...service }), [session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
