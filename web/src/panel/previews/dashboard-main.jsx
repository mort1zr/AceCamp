import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import DashboardPreview from './DashboardPreview.jsx'
import '../../index.css'
import './players-preview.css'
import './dashboard-preview.css'

createRoot(document.getElementById('root')).render(<StrictMode><DashboardPreview /></StrictMode>)
