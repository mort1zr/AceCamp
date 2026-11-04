// Configuración de Vitest solo para las pruebas de reglas (PCIT-23).
// Se ejecutan con `npm run test:rules`, que enciende el emulador de Firestore.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.js'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
})
