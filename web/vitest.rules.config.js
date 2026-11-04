// Configuración de Vitest para las pruebas con emuladores: reglas (PCIT-23) y registro (PCIT-21).
// Se ejecutan con `npm run test:rules`, que enciende los emuladores de Auth y Firestore.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
})
