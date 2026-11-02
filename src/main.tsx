import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts'
import './index.css'
import App from './App.tsx'
import { setUpInstall, keepStorage } from './services/pwa'
import { migrateLegacyData } from './services/legacy'

setUpInstall()
keepStorage()

// saved data from before the rename is moved first, so the app starts on what the writer already had
migrateLegacyData().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
