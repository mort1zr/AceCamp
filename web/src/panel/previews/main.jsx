import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ComponentPreview from './ComponentPreview.jsx'
import '../../index.css'
import './preview.css'

createRoot(document.getElementById('root')).render(
  <StrictMode><ComponentPreview /></StrictMode>,
)
