import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import InicioPreview from './InicioPreview.jsx'
import '../index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <InicioPreview />
  </StrictMode>,
)
