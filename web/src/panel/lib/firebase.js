// Inicialización única de Firebase para la web (PCIT-20).
// El resto de la app importa { auth, db, storage } desde aquí;
// ningún otro módulo debe llamar a initializeApp.

import { getApp, getApps, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectStorageEmulator, getStorage } from 'firebase/storage'
import { EMULATOR_PORTS, readFirebaseConfig } from './firebaseConfig.js'

const { config, useEmulators, emulatorHost } = readFirebaseConfig(import.meta.env)

const alreadyInitialized = getApps().length > 0
export const app = alreadyInitialized ? getApp() : initializeApp(config)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const usingEmulators = useEmulators

// La recarga en caliente de Vite vuelve a ejecutar este módulo:
// solo se conecta a los emuladores la primera vez.
if (useEmulators && !alreadyInitialized) {
  connectAuthEmulator(auth, `http://${emulatorHost}:${EMULATOR_PORTS.auth}`, { disableWarnings: true })
  connectFirestoreEmulator(db, emulatorHost, EMULATOR_PORTS.firestore)
  connectStorageEmulator(storage, emulatorHost, EMULATOR_PORTS.storage)
}
