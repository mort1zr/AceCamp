import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { configDefaults } from 'vitest/config'

const appRoutesWithPreviews = new Set(['/analizar', '/dashboard', '/jugadores'])

export default defineConfig(async ({ command, mode, isPreview }) => {
  const demo = mode === 'demo'
  if (demo && (command !== 'serve' || isPreview)) throw new Error('Usa npm run demo para la demo con emuladores.')
  const demoPlugins = demo
    ? [(await import('./server/video-import/demo.js')).demoVideoImport(loadEnv(mode, process.cwd(), 'ACECAM_'))]
    : []
  return {
    plugins: [
      ...demoPlugins,
      {
        name: 'acecam-app-routes',
        configureServer(server) {
          server.middlewares.use((request, _response, next) => {
            // Vite otherwise serves jugadores.html for /jugadores in development.
            const pathname = request.url?.split('?')[0]
            if (appRoutesWithPreviews.has(pathname)) request.url = '/index.html' + request.url.slice(pathname.length)
            next()
          })
        },
      },
      react(),
      tailwindcss(),
    ],
    test: {
      // Las pruebas de tests/ necesitan los emuladores: van aparte con `npm run test:rules`.
      exclude: [...configDefaults.exclude, 'tests/**'],
    },
  }
})
