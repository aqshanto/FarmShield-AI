import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { savedLang } from '@/lib/i18n'
import '@/styles/index.css'

// Screen readers and fonts follow the farmer's language from the first paint.
document.documentElement.lang = savedLang()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
