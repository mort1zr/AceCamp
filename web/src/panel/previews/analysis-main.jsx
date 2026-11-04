import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AnalysisPreview from './AnalysisPreview.jsx'
import '../../index.css'
import './players-preview.css'

createRoot(document.getElementById('root')).render(<StrictMode><AnalysisPreview /></StrictMode>)
