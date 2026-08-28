import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { variaveisCssTexto } from '@montacontrol/design-tokens/web/variaveis'
import '@fontsource-variable/inter/wght.css'
import './index.css'
import App from './App.tsx'

// Injeta as cores do design system como custom properties (`--cor-*`) uma
// única vez, antes do primeiro render — consumido por CSS puro (ex.:
// `src/index.css`) que não passa pelo preset Tailwind (ver README de
// @montacontrol/design-tokens).
const folhaVariaveis = document.createElement('style')
folhaVariaveis.textContent = variaveisCssTexto
document.head.appendChild(folhaVariaveis)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
