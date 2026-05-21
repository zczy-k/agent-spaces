import React from 'react'
import { createRoot } from 'react-dom/client'
import { bindCaptureListener } from 'dom-inspector-hook'
import App from './App'

bindCaptureListener({ url: 'http://localhost:3999', copy: true })

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
