import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { loadSettings, applySettings } from './settings'

applySettings(loadSettings())

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const settings = loadSettings()
  if (settings.theme === 'system') {
    applySettings(settings)
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
