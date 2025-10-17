import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Cargar versión desde version.json y exponer en window
fetch('/version.json').then(r=>r.json()).then(v=>{
  window.__OLLANTAY_VERSION__ = v.version
})

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
