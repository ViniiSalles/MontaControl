import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Proxy de /api para a API NestJS (porta 3000 em dev, ver apps/api/.env.example)
// — evita configurar CORS na API só para o dev server local; o cliente web
// (`src/auth/clienteAuth.ts`) sempre fala com o mesmo-origin `/api/...`.
const proxyApi = {
  '/api': { target: 'http://localhost:3000', changeOrigin: true },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `node-linker=hoisted` dá a vaga da raiz ao react 19.2.3 que o mobile fixa,
  // e sobram cópias físicas do 19.2.8 em `apps/web/node_modules/react` e em
  // `react-router/node_modules/react`. Duas cópias = dois React em memória, e
  // o primeiro hook de `<BrowserRouter>` estoura com "Invalid hook call".
  // `dedupe` obriga o Vite a resolver todo import para uma cópia só.
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { proxy: proxyApi },
  preview: { proxy: proxyApi },
  // `@montacontrol/shared` compila para CommonJS (consumido também pela API
  // NestJS). Como é um pacote linkado do workspace, o Vite não o pré-agrupa
  // por padrão e serve o CJS cru como ESM nativo ao browser, quebrando os
  // named exports (ex.: `Perfil`). Força o pré-bundling via esbuild, que
  // faz a interop CJS→ESM.
  optimizeDeps: { include: ['@montacontrol/shared'] },
})
