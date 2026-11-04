import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.jsx'
import AuthProvider from './panel/context/AuthProvider.jsx'
import EntradaProvider from './panel/context/EntradaProvider.jsx'
import './index.css'
import { IdiomaProvider } from './compartido/lib/idioma.jsx'
import { startSmoothScroll } from './compartido/lib/smoothScroll.js'
import { applyTheme, resolveInitialTheme } from './compartido/lib/theme.js'

if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
window.scrollTo(0, 0)
applyTheme(resolveInitialTheme())
startSmoothScroll()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <IdiomaProvider>
      <BrowserRouter>
        <AuthProvider>
          <EntradaProvider>
            <App />
          </EntradaProvider>
        </AuthProvider>
      </BrowserRouter>
    </IdiomaProvider>
  </StrictMode>,
)
