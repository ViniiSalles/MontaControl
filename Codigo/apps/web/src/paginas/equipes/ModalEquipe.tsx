import { useState } from 'react'
import type { EquipeDTO, MontadorResumoDTO, SalvarEquipeRequest } from '@montacontrol/shared'
import { Alerta } from '../../ui/Alerta'
import { CampoTexto } from '../../ui/CampoTexto'
import { Modal } from '../../ui/Modal'
import { SelecaoMontadores } from './SelecaoMontadores'

interface PropsModalEquipe {
  /** `null` cria uma equipe nova. */
  equipe: EquipeDTO | null
  montadores: MontadorResumoDTO[]
  erro: string | null
  aoFechar: () => void
  /** Rejeita quando falha, para o modal continuar aberto com os dados. */
  aoSalvar: (dados: SalvarEquipeRequest) => Promise<void>
}

export function ModalEquipe({ equipe, montadores, erro, aoFechar, aoSalvar }: PropsModalEquipe) {
  const [nome, setNome] = useState(equipe?.nome ?? '')
  // Membro que ficou inativo não aparece na lista e sai da equipe ao salvar.
  const [selecionados, setSelecionados] = useState<number[]>(
    equipe?.membros.filter((membro) => membro.ativo).map((membro) => membro.id) ?? [],
  )
  const [erroNome, setErroNome] = useState<string | undefined>()
  const [salvando, setSalvando] = useState(false)

  async function aoConfirmar() {
    if (salvando) return
    if (nome.trim().length < 2) {
      setErroNome('Informe o nome da equipe.')
      return
    }
    setSalvando(true)
    try {
      await aoSalvar({ nome: nome.trim(), membrosIds: selecionados })
    } catch {
      // A página guardou a mensagem em `erro`; aqui só mantemos o que foi preenchido.
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      visivel
      apresentacao="centro"
      titulo={equipe ? 'Editar equipe' : 'Nova equipe'}
      aoFechar={aoFechar}
      acoes={[
        { texto: 'Cancelar', variante: 'fantasma', aoPressionar: aoFechar },
        { texto: salvando ? 'Salvando…' : 'Salvar', aoPressionar: () => void aoConfirmar() },
      ]}
      conteudo={
        <div className="space-y-16">
          {erro && <Alerta variante="erro" mensagem={erro} />}
          <CampoTexto
            rotulo="Nome da equipe"
            placeholder="Ex.: Equipe Zona Norte"
            valor={nome}
            aoAlterar={(valor) => {
              setNome(valor)
              setErroNome(undefined)
            }}
            erro={erroNome}
            obrigatorio
          />
          <SelecaoMontadores montadores={montadores} selecionados={selecionados} aoAlterar={setSelecionados} />
        </div>
      }
    />
  )
}
