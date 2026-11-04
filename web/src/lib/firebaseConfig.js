// Lectura y validación de la configuración de Firebase (PCIT-20).
// Función pura: recibe las variables de entorno y devuelve la configuración,
// para poder probarla sin inicializar Firebase.

export const EMULATOR_PROJECT_ID = 'demo-acecam'

const REQUIRED = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
}

export const EMULATOR_PORTS = { auth: 9099, firestore: 8080, storage: 9199 }

/**
 * @param {Record<string, string | undefined>} env normalmente import.meta.env
 * @returns {{ useEmulators: boolean, emulatorHost: string, config: Record<string, string> }}
 */
export function readFirebaseConfig(env) {
  const useEmulators = String(env.VITE_USE_FIREBASE_EMULATORS ?? '').trim() === 'true'
  const emulatorHost = String(env.VITE_FIREBASE_EMULATOR_HOST ?? '').trim() || '127.0.0.1'

  if (useEmulators) {
    // Proyecto "demo-*": los emuladores no tocan ningún recurso real
    // y no hacen falta credenciales para desarrollar ni para las pruebas.
    return {
      useEmulators,
      emulatorHost,
      config: {
        apiKey: 'demo-api-key',
        authDomain: `${EMULATOR_PROJECT_ID}.firebaseapp.com`,
        projectId: EMULATOR_PROJECT_ID,
        storageBucket: `${EMULATOR_PROJECT_ID}.appspot.com`,
        messagingSenderId: '0',
        appId: '1:0:web:demo',
      },
    }
  }

  const config = {}
  const missing = []
  for (const [key, name] of Object.entries(REQUIRED)) {
    const value = String(env[name] ?? '').trim()
    if (value) config[key] = value
    else missing.push(name)
  }
  if (missing.length) {
    throw new Error(
      `Falta configurar Firebase: ${missing.join(', ')}. ` +
        'Copia web/.env.example a web/.env y completa los valores, ' +
        'o usa VITE_USE_FIREBASE_EMULATORS=true para trabajar con los emuladores.',
    )
  }
  return { useEmulators, emulatorHost, config }
}
