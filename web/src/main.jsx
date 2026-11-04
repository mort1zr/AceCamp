import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.jsx'
import './index.css'
import { IdiomaProvider } from './lib/idioma.jsx'
import { startSmoothScroll } from './lib/smoothScroll.js'
import { applyTheme, resolveInitialTheme } from './lib/theme.js'

if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
window.scrollTo(0, 0)
applyTheme(resolveInitialTheme())
startSmoothScroll()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <IdiomaProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </IdiomaProvider>
  </StrictMode>,
)
