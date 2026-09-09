import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Perfil } from '@montacontrol/shared'
import type { PerfilWeb } from '../auth/perfilDestino'
import { Botao } from '../ui/Botao'
import { SimboloMaterial } from '../ui/SimboloMaterial'
import { useAuth } from '../auth/AuthContext'

interface AbaNavegacao {
  rotulo: string
  caminho: string
}

/**
 * Abas visíveis por perfil (T11.4). O RH deixou de ter uma tela só a partir
 * da Sprint 7 — GESTOR e DEPOSITO seguem com a sua única tela, e por isso
 * aparecem sem barra de navegação.
 */
const ABAS_POR_PERFIL: Record<PerfilWeb, AbaNavegacao[]> = {
  [Perfil.RH]: [
    { rotulo: 'Atestados', caminho: '/atestados' },
    { rotulo: 'Montadores', caminho: '/montadores' },
    { rotulo: 'Banco de Horas', caminho: '/banco-horas' },
  ],
  [Perfil.GESTOR]: [{ rotulo: 'Dashboard', caminho: '/dashboard' }],
  [Perfil.DEPOSITO]: [{ rotulo: 'Triagem', caminho: '/triagem' }],
}

interface PropsLayoutAutenticado {
  /** Nome da tela/aba visível para o perfil logado (uma só, por ora — cada perfil administrativo tem 1 tela nesta fase). */
  aba: string
  children: ReactNode
}

/**
 * Cabeçalho comum das telas autenticadas. "Abas visíveis por perfil" (T11.4)
 * hoje é literal: cada perfil administrativo só tem uma tela construída, então
 * a única aba mostrada já é a do próprio perfil — a lista cresce quando as
 * demais telas (Fases futuras) existirem para navegar entre elas.
 */
export function LayoutAutenticado({ aba, children }: PropsLayoutAutenticado) {
  const { sessao, sair } = useAuth()
  const navigate = useNavigate()

  function aoSair() {
    sair()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="flex h-alturaBarraSuperior items-center justify-between border-b border-outline-variant/30 bg-surface-container-lowest px-24">
        <div className="flex items-center gap-12">
          <SimboloMaterial nome="conveyor_belt" className="text-2xl text-primary" />
          <span className="text-title-md font-bold text-on-surface">MontaControl</span>
          <nav className="ml-16 flex items-center gap-8" aria-label="Seções">
            {(sessao ? ABAS_POR_PERFIL[sessao.usuario.perfil as PerfilWeb] : []).map((item) => (
              <Link
                key={item.caminho}
                to={item.caminho}
                aria-current={item.rotulo === aba ? 'page' : undefined}
                className={
                  item.rotulo === aba
                    ? 'rounded-full bg-primary-container px-16 py-4 text-label-md font-bold uppercase text-on-primary-container'
                    : 'rounded-full px-16 py-4 text-label-md font-bold uppercase text-on-surface-variant'
                }
              >
                {item.rotulo}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-16">
          {sessao && <span className="text-body-sm text-on-surface-variant">{sessao.usuario.nome}</span>}
          <Botao variante="fantasma" tamanho={40} forma="retangular" texto="Sair" aoPressionar={aoSair} />
        </div>
      </header>
      <main className="p-32">{children}</main>
    </div>
  )
}
