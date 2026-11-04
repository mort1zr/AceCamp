import { describe, expect, it } from 'vitest'
import { EMULATOR_PROJECT_ID, readFirebaseConfig } from './firebaseConfig.js'

const full = {
  VITE_FIREBASE_API_KEY: 'AIza-test',
  VITE_FIREBASE_AUTH_DOMAIN: 'proyecto.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'proyecto',
  VITE_FIREBASE_STORAGE_BUCKET: 'proyecto.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
  VITE_FIREBASE_APP_ID: '1:123:web:abc',
}

describe('readFirebaseConfig', () => {
  it('arma la configuración con las variables completas', () => {
    const { config, useEmulators } = readFirebaseConfig(full)
    expect(useEmulators).toBe(false)
    expect(config).toEqual({
      apiKey: 'AIza-test',
      authDomain: 'proyecto.firebaseapp.com',
      projectId: 'proyecto',
      storageBucket: 'proyecto.firebasestorage.app',
      messagingSenderId: '123',
      appId: '1:123:web:abc',
    })
  })

  it('falla con un mensaje claro si falta una variable, sin mostrar valores', () => {
    const env = { ...full, VITE_FIREBASE_APP_ID: '  ' }
    expect(() => readFirebaseConfig(env)).toThrow(/VITE_FIREBASE_APP_ID/)
    expect(() => readFirebaseConfig(env)).not.toThrow(/AIza-test/)
  })

  it('con emuladores usa un proyecto demo y no exige credenciales', () => {
    const { config, useEmulators, emulatorHost } = readFirebaseConfig({ VITE_USE_FIREBASE_EMULATORS: 'true' })
    expect(useEmulators).toBe(true)
    expect(emulatorHost).toBe('127.0.0.1')
    expect(config.projectId).toBe(EMULATOR_PROJECT_ID)
    expect(config.projectId.startsWith('demo-')).toBe(true)
  })

  it('solo activa los emuladores con el valor exacto "true"', () => {
    expect(readFirebaseConfig({ ...full, VITE_USE_FIREBASE_EMULATORS: 'false' }).useEmulators).toBe(false)
    expect(readFirebaseConfig({ ...full, VITE_USE_FIREBASE_EMULATORS: '1' }).useEmulators).toBe(false)
  })

  it('la demo fija el proyecto y el host locales aunque exista una configuración real', () => {
    const env = { ...full, MODE: 'demo', VITE_USE_FIREBASE_EMULATORS: 'false', VITE_FIREBASE_EMULATOR_HOST: 'otro-host' }
    expect(readFirebaseConfig(env)).toMatchObject({
      useEmulators: true,
      emulatorHost: '127.0.0.1',
      config: { projectId: EMULATOR_PROJECT_ID, storageBucket: 'demo-acecam.appspot.com' },
    })
  })
})
