// Sesión de la app (PCIT-21). El proveedor está en AuthProvider.jsx.
// Valor: { user, profile, loading, registerCoach, login, logout }
// - user: usuario de Firebase Auth, o null sin sesión.
// - profile: ficha users/{uid} con { id, orgId, role, displayName, email }, o null.
// Los servicios de datos se crean con profile.orgId y user.uid, por ejemplo:
//   createFirestorePlayersService({ db, orgId: profile.orgId, actorId: user.uid })

import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth se usa dentro de <AuthProvider>.')
  return value
}
