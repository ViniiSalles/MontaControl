import { useState } from 'react'
import type { EquipeDTO, MontadorResumoDTO } from '@montacontrol/shared'
import { aplicarEquipe, textoQuantidadeMontadores } from '../../formatacao/equipes'
import { Alerta } from '../../ui/Alerta'
import { Botao } from '../../ui/Botao'
import { Modal } from '../../ui/Modal'
import { SelecaoMontadores } from '../equipes/SelecaoMontadores'

const classeCampo =
  'h-alturaCampo w-full rounded-lg border-none bg-surface-container-low px-16 text-body-lg text-on-surface focus:bg-surface-container-lowest focus:shadow-elev2 focus:outline-none'

interface PropsModalMontadoresPedido {
  numeroPedido: string
  /** Quem já está na obra hoje. */
  atribuidos: MontadorResumoDTO[]
  montadores: MontadorResumoDTO[]
  equipes: EquipeDTO[]
  erro: string | null
  aoFechar: () => void
  /** Rejeita quando falha, para o modal continuar aberto com a seleção. */
  aoSalvar: (usuarioIds: number[]) => Promise<void>
}

/**
 * Atribuição da obra, sempre por pessoa. Escolher uma equipe marca todos os
 * membros dela de uma vez; depois o gestor desmarca ou acrescenta avulsos.
 */
export function ModalMontadoresPedido({
  numeroPedido,
  atribuidos,
  montadores,
  equipes,
  erro,
  aoFechar,
  aoSalvar,
}: PropsModalMontadoresPedido) {
  const disponiveis = new Set(montadores.map((montador) => montador.id))
  // Atribuído que ficou inativo não pode continuar: sai ao salvar, com aviso.
  const inativos = atribuidos.filter((montador) => !disponiveis.has(montador.id))
  const [selecionados, setSelecionados] = useState<number[]>(
    atribuidos.filter((montador) => disponiveis.has(montador.id)).map((montador) => montador.id),
  )
  const [equipeId, setEquipeId] = useState('')
  const [salvando, setSalvando] = useState(false)

  function adicionarEquipe() {
    const equipe = equipes.find((candidata) => String(candidata.id) === equipeId)
    if (!equipe) return
    setSelecionados((atuais) => aplicarEquipe(atuais, equipe))
    setEquipeId('')
  }

  async function aoConfirmar() {
    if (salvando) return
    setSalvando(true)
    try {
      await aoSalvar(selecionados)
    } catch {
      // A página guardou a mensagem em `erro`; a seleção fica como está.
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      visivel
      apresentacao="centro"
      titulo={`Montadores da obra · ${numeroPedido}`}
      aoFechar={aoFechar}
      acoes={[
        { texto: 'Cancelar', variante: 'fantasma', aoPressionar: aoFechar },
        {
          texto: salvando ? 'Salvando…' : `Salvar (${textoQuantidadeMontadores(selecionados.length)})`,
          aoPressionar: () => void aoConfirmar(),
        },
      ]}
      conteudo={
        <div className="space-y-16">
          {erro && <Alerta variante="erro" mensagem={erro} />}
          {inativos.length > 0 && (
            <Alerta
              variante="aviso"
              mensagem={`Inativos saem da obra ao salvar: ${inativos.map((montador) => montador.nome).join(', ')}.`}
            />
          )}

          <div className="space-y-6">
            <label htmlFor="equipe-obra" className="block px-4 text-label-lg uppercase text-on-surface-variant">
              Adicionar equipe
            </label>
            <div className="flex gap-8">
              <select
                id="equipe-obra"
                value={equipeId}
                onChange={(evento) => setEquipeId(evento.target.value)}
                className={classeCampo}
              >
                <option value="">{equipes.length === 0 ? 'Nenhuma equipe cadastrada' : 'Escolha uma equipe…'}</option>
                {equipes.map((equipe) => (
                  <option key={equipe.id} value={equipe.id}>
                    {equipe.nome} ({textoQuantidadeMontadores(equipe.membros.length)})
                  </option>
                ))}
              </select>
              <Botao
                variante="tonal"
                tamanho={56}
                forma="retangular"
                icone="add"
                texto="Adicionar"
                desabilitado={!equipeId}
                aoPressionar={adicionarEquipe}
              />
            </div>
          </div>

          <SelecaoMontadores montadores={montadores} selecionados={selecionados} aoAlterar={setSelecionados} />
        </div>
      }
    />
  )
}
