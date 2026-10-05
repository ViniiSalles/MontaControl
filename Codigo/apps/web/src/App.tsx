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
const Pedidos = lazy(() => import('./paginas/Pedidos.tsx'))
const Avarias = lazy(() => import('./paginas/Avarias.tsx'))
const Equipes = lazy(() => import('./paginas/Equipes.tsx'))
const Atestados = lazy(() => import('./paginas/Atestados.tsx'))
const Triagem = lazy(() => import('./paginas/Triagem.tsx'))
const Montadores = lazy(() => import('./paginas/Montadores.tsx'))
const BancoHoras = lazy(() => import('./paginas/BancoHoras.tsx'))
const EspelhoPonto = lazy(() => import('./paginas/EspelhoPonto.tsx'))

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
            path="/pedidos"
            element={
              <RotaProtegida perfilExigido={Perfil.GESTOR}>
                <Pedidos />
              </RotaProtegida>
            }
          />
          <Route
            path="/equipes"
            element={
              <RotaProtegida perfilExigido={Perfil.GESTOR}>
                <Equipes />
              </RotaProtegida>
            }
          />
          <Route
            path="/avarias"
            element={
              <RotaProtegida perfilExigido={Perfil.GESTOR}>
                <Avarias />
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
          <Route
            path="/montadores"
            element={
              <RotaProtegida perfilExigido={Perfil.RH}>
                <Montadores />
              </RotaProtegida>
            }
          />
          <Route
            path="/banco-horas"
            element={
              <RotaProtegida perfilExigido={Perfil.RH}>
                <BancoHoras />
              </RotaProtegida>
            }
          />
          <Route
            path="/espelho-ponto"
            element={
              <RotaProtegida perfilExigido={Perfil.RH}>
                <EspelhoPonto />
              </RotaProtegida>
            }
          />
          <Route
            path="/espelho-ponto/:usuarioId"
            element={
              <RotaProtegida perfilExigido={Perfil.RH}>
                <EspelhoPonto />
              </RotaProtegida>
            }
          />
        </Routes>
      </Suspense>
    </ProvedorAuth>
  )
}

export default App
