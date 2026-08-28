import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Perfil } from '@montacontrol/shared'
import { ProvedorAuth } from './auth/AuthContext'
import { RotaInicial } from './auth/RotaInicial'
import { RotaProtegida } from './auth/RotaProtegida'

// Rotas carregadas sob demanda (code-splitting por rota) — cada página é seu
// próprio módulo, sem barril, para não puxar telas não visitadas para o
// chunk inicial.
const Login = lazy(() => import('./paginas/Login.tsx'))
const Dashboard = lazy(() => import('./paginas/Dashboard.tsx'))
const Atestados = lazy(() => import('./paginas/Atestados.tsx'))
const Triagem = lazy(() => import('./paginas/Triagem.tsx'))

function App() {
  return (
    <ProvedorAuth>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<RotaInicial />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <RotaProtegida perfilExigido={Perfil.GESTOR}>
                <Dashboard />
              </RotaProtegida>
            }
          />
          <Route
            path="/atestados"
            element={
              <RotaProtegida perfilExigido={Perfil.RH}>
                <Atestados />
              </RotaProtegida>
            }
          />
          <Route
            path="/triagem"
            element={
              <RotaProtegida perfilExigido={Perfil.DEPOSITO}>
                <Triagem />
              </RotaProtegida>
            }
          />
        </Routes>
      </Suspense>
    </ProvedorAuth>
  )
}

export default App
