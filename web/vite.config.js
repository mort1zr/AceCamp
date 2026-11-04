import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Las pruebas de reglas necesitan el emulador: van aparte con `npm run test:rules`.
    exclude: [...configDefaults.exclude, 'tests/rules/**'],
  },
})
