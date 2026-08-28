import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Botao } from '../ui/Botao'
import { SimboloMaterial } from '../ui/SimboloMaterial'
import { useAuth } from '../auth/AuthContext'

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
          <span className="ml-16 rounded-full bg-primary-container px-16 py-4 text-label-md font-bold uppercase text-on-primary-container">
            {aba}
          </span>
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
