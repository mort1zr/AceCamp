import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ConfiguracionPreview from './ConfiguracionPreview.jsx'
import '../../index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfiguracionPreview />
  </StrictMode>,
)
