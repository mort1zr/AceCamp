import { getApp, getApps, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { EMULATOR_PORTS, readFirebaseConfig } from './firebaseConfig.js'

const { config, useEmulators, emulatorHost } = readFirebaseConfig(import.meta.env)
export { emulatorHost, useEmulators }

const alreadyInitialized = getApps().length > 0
export const app = alreadyInitialized ? getApp() : initializeApp(config)
export const auth = getAuth(app)

if (useEmulators && !alreadyInitialized) {
  connectAuthEmulator(auth, `http://${emulatorHost}:${EMULATOR_PORTS.auth}`, {
    disableWarnings: true,
  })
}
