// Registro, inicio y cierre de sesión con Firebase Auth (PCIT-21).
// Recibe { auth, db } desde fuera para poder probarlo contra los emuladores
// sin importar src/lib/firebase.js (que necesita el .env).
// El registro tiene que cumplir las reglas de users y orgs de firestore.rules (PCIT-23).

import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { COLLECTIONS } from './schema.js'

export const MIN_PASSWORD_LENGTH = 6
const MAX_TEXT_LENGTH = 120
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const normalizeEmail = email => String(email ?? '').trim().toLowerCase()
const clean = value => String(value ?? '').trim()

function textError(value, label) {
  if (value.length < 2) return `Escribe ${label} (al menos 2 caracteres).`
  if (value.length > MAX_TEXT_LENGTH) return `${label[0].toUpperCase()}${label.slice(1)} es demasiado largo.`
  return null
}

function emailError(email) {
  if (!email) return 'Escribe tu correo.'
  if (!EMAIL_PATTERN.test(email)) return 'El correo no es válido.'
  return null
}

/** Devuelve { campo: mensaje } con los errores; vacío si el formulario es válido. */
export function validateLogin({ email, password }) {
  const errors = {}
  const emailMessage = emailError(normalizeEmail(email))
  if (emailMessage) errors.email = emailMessage
  if (!password) errors.password = 'Escribe tu contraseña.'
  return errors
}

export function validateRegistration({ name, orgName, email, password, confirmPassword }) {
  const errors = {}
  const nameMessage = textError(clean(name), 'tu nombre')
  if (nameMessage) errors.name = nameMessage
  const orgMessage = textError(clean(orgName), 'el nombre de tu organización')
  if (orgMessage) errors.orgName = orgMessage
  const emailMessage = emailError(normalizeEmail(email))
  if (emailMessage) errors.email = emailMessage
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
  }
  if (password !== confirmPassword) errors.confirmPassword = 'Las contraseñas no coinciden.'
  return errors
}

const ERROR_MESSAGES = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/invalid-login-credentials': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'No existe una cuenta con ese correo.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión.',
  'auth/weak-password': `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  'auth/invalid-email': 'El correo no es válido.',
  'auth/user-disabled': 'Esta cuenta está desactivada.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  'auth/network-request-failed': 'No hay conexión con el servidor. Revisa tu internet.',
  'permission-denied': 'No pudimos crear tu organización. Inténtalo de nuevo.',
}

/** Mensaje para el usuario; nunca muestra el error técnico. */
export function authErrorMessage(error) {
  return ERROR_MESSAGES[error?.code] ?? 'Algo salió mal. Inténtalo de nuevo.'
}

export function createAuthService({ auth, db }) {
  /**
   * Crea la cuenta, su organización y su ficha en users.
   * La organización y la ficha van en el mismo lote, como exigen las reglas.
   * Si el lote falla, borra la cuenta de Auth para que pueda volver a intentarlo.
   */
  async function registerCoach({ name, email, password, orgName }) {
    const displayName = clean(name)
    const { user } = await createUserWithEmailAndPassword(auth, normalizeEmail(email), password)
    try {
      await updateProfile(user, { displayName })
      const orgRef = doc(collection(db, COLLECTIONS.orgs))
      const batch = writeBatch(db)
      batch.set(orgRef, {
        name: clean(orgName),
        ownerId: user.uid,
        program: null,
        plan: 'free',
        createdAt: serverTimestamp(),
      })
      batch.set(doc(db, COLLECTIONS.users, user.uid), {
        email: user.email,
        displayName,
        orgId: orgRef.id,
        role: 'coach',
        jobTitle: null,
        createdAt: serverTimestamp(),
      })
      await batch.commit()
      return { user, orgId: orgRef.id }
    } catch (error) {
      await deleteUser(user).catch(() => signOut(auth))
      throw error
    }
  }

  const login = ({ email, password }) =>
    signInWithEmailAndPassword(auth, normalizeEmail(email), password)

  const logout = () => signOut(auth)

  return { registerCoach, login, logout }
}
