import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PlayersPreview from './PlayersPreview.jsx'
import '../index.css'
import './players-preview.css'

createRoot(document.getElementById('root')).render(<StrictMode><PlayersPreview /></StrictMode>)
