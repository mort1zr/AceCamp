// Firestore y Storage para el panel (PCIT-20). La app y Auth se inicializan en firebaseAuth.js;
// el panel importa { auth, db, storage } desde aquí y la landing solo carga firebaseAuth.js.

import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectStorageEmulator, getStorage } from 'firebase/storage'
import { app, auth, emulatorHost, useEmulators } from './firebaseAuth.js'
import { EMULATOR_PORTS } from './firebaseConfig.js'

export { auth }
export const db = getFirestore(app)
export const storage = getStorage(app)

// La recarga en caliente de Vite vuelve a ejecutar este módulo:
// solo se conecta a los emuladores la primera vez.
if (useEmulators && !import.meta.hot?.data.conectado) {
  connectFirestoreEmulator(db, emulatorHost, EMULATOR_PORTS.firestore)
  connectStorageEmulator(storage, emulatorHost, EMULATOR_PORTS.storage)
  if (import.meta.hot) import.meta.hot.data.conectado = true
}
