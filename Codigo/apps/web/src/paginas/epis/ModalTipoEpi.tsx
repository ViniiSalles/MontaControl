import { useState } from 'react'
import type { SalvarTipoEpiRequest, TipoEpiDTO } from '@montacontrol/shared'
import {
  RASCUNHO_TIPO_EPI_VAZIO,
  rascunhoTipoEpiDe,
  validarRascunhoTipoEpi,
  type ErrosTipoEpi,
  type RascunhoTipoEpi,
} from '../../formatacao/epis'
import { Alerta } from '../../ui/Alerta'
import { CampoAreaTexto } from '../../ui/CampoAreaTexto'
import { CampoTexto } from '../../ui/CampoTexto'
import { Modal } from '../../ui/Modal'

interface PropsModalTipoEpi {
  /** `null` = EPI novo. */
  tipo: TipoEpiDTO | null
  erro: string | null
  aoFechar: () => void
  /** Rejeita quando falha, para o modal continuar aberto com os dados. */
  aoSalvar: (dados: SalvarTipoEpiRequest) => Promise<void>
}

/** Cadastro/edição de um EPI do almoxarifado e de quantas unidades existem para alugar. */
export function ModalTipoEpi({ tipo, erro, aoFechar, aoSalvar }: PropsModalTipoEpi) {
  const [rascunho, setRascunho] = useState<RascunhoTipoEpi>(() => (tipo ? rascunhoTipoEpiDe(tipo) : RASCUNHO_TIPO_EPI_VAZIO))
  const [erros, setErros] = useState<ErrosTipoEpi>({})
  const [salvando, setSalvando] = useState(false)

  function alterar(campo: keyof RascunhoTipoEpi, valor: string) {
    setRascunho((atual) => ({ ...atual, [campo]: valor }))
    setErros((atuais) => ({ ...atuais, [campo]: undefined }))
  }

  async function aoConfirmar() {
    if (salvando) return
    const { erros: encontrados, dados } = validarRascunhoTipoEpi(rascunho, tipo?.emUso ?? 0)
    setErros(encontrados)
    if (!dados) return
    setSalvando(true)
    try {
      await aoSalvar(dados)
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
      titulo={tipo ? 'Editar EPI' : 'Novo EPI'}
      aoFechar={aoFechar}
      acoes={[
        { texto: 'Cancelar', variante: 'fantasma', aoPressionar: aoFechar },
        { texto: salvando ? 'Salvando…' : 'Salvar', aoPressionar: () => void aoConfirmar() },
      ]}
      conteudo={
        <div className="space-y-16">
          {erro && <Alerta variante="erro" mensagem={erro} />}
          <CampoTexto rotulo="Nome" placeholder="Ex.: Capacete de segurança" valor={rascunho.nome} aoAlterar={(valor) => alterar('nome', valor)} erro={erros.nome} obrigatorio />
          <CampoAreaTexto rotulo="Descrição" valor={rascunho.descricao} aoAlterar={(valor) => alterar('descricao', valor)} />
          <div className="grid gap-16 md:grid-cols-2">
            <CampoTexto
              rotulo="Unidades em estoque"
              tipo="numero"
              valor={rascunho.estoque}
              aoAlterar={(valor) => alterar('estoque', valor)}
              ajuda="Quantas podem estar alugadas ao mesmo tempo"
              erro={erros.estoque}
              obrigatorio
            />
            <CampoTexto
              rotulo="Validade (meses)"
              tipo="numero"
              valor={rascunho.validadeMeses}
              aoAlterar={(valor) => alterar('validadeMeses', valor)}
              erro={erros.validadeMeses}
              obrigatorio
            />
          </div>
        </div>
      }
    />
  )
}
