import { useState } from 'react'
import type { RegistrarAluguelEpiRequest, TipoEpiDTO, UsuarioDTO } from '@montacontrol/shared'
import {
  rascunhoAluguelInicial,
  validarRascunhoAluguel,
  type ErrosAluguel,
  type RascunhoAluguel,
} from '../../formatacao/epis'
import { Alerta } from '../../ui/Alerta'
import { CampoAreaTexto } from '../../ui/CampoAreaTexto'
import { CampoTexto } from '../../ui/CampoTexto'
import { Modal } from '../../ui/Modal'
import { CampoNativo, classeCampoNativo as classeCampo } from './CampoNativo'

interface PropsModalAluguelEpi {
  tipos: TipoEpiDTO[]
  colaboradores: UsuarioDTO[]
  erro: string | null
  aoFechar: () => void
  /** Rejeita quando falha, para o modal continuar aberto com os dados. */
  aoSalvar: (dados: RegistrarAluguelEpiRequest) => Promise<void>
}

/**
 * Registro do aluguel: qual EPI, para quem, quantas unidades e o período
 * reservado. A API recusa se faltar unidade em algum instante do período.
 */
export function ModalAluguelEpi({ tipos, colaboradores, erro, aoFechar, aoSalvar }: PropsModalAluguelEpi) {
  const [rascunho, setRascunho] = useState<RascunhoAluguel>(() => rascunhoAluguelInicial(new Date()))
  const [erros, setErros] = useState<ErrosAluguel>({})
  const [salvando, setSalvando] = useState(false)

  function alterar(campo: keyof RascunhoAluguel, valor: string) {
    setRascunho((atual) => ({ ...atual, [campo]: valor }))
    setErros((atuais) => ({ ...atuais, [campo]: undefined }))
  }

  async function aoConfirmar() {
    if (salvando) return
    const { erros: encontrados, dados } = validarRascunhoAluguel(rascunho, tipos)
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
      titulo="Novo aluguel de EPI"
      aoFechar={aoFechar}
      acoes={[
        { texto: 'Cancelar', variante: 'fantasma', aoPressionar: aoFechar },
        { texto: salvando ? 'Salvando…' : 'Registrar aluguel', aoPressionar: () => void aoConfirmar() },
      ]}
      conteudo={
        <div className="space-y-16">
          {erro && <Alerta variante="erro" mensagem={erro} />}
          <div className="grid gap-16 md:grid-cols-[1fr_120px]">
            <CampoNativo id="aluguel-epi-tipo" rotulo="EPI" erro={erros.tipoEpiId}>
              <select
                id="aluguel-epi-tipo"
                value={rascunho.tipoEpiId}
                onChange={(evento) => alterar('tipoEpiId', evento.target.value)}
                className={classeCampo}
                aria-invalid={erros.tipoEpiId ? true : undefined}
              >
                <option value="">Selecione…</option>
                {tipos.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nome} — {tipo.estoque - tipo.emUso} de {tipo.estoque} livres agora
                  </option>
                ))}
              </select>
            </CampoNativo>
            <CampoTexto
              rotulo="Quantidade"
              tipo="numero"
              valor={rascunho.quantidade}
              aoAlterar={(valor) => alterar('quantidade', valor)}
              erro={erros.quantidade}
              obrigatorio
            />
          </div>
          <CampoNativo id="aluguel-epi-colaborador" rotulo="Colaborador" erro={erros.usuarioId}>
            <select
              id="aluguel-epi-colaborador"
              value={rascunho.usuarioId}
              onChange={(evento) => alterar('usuarioId', evento.target.value)}
              className={classeCampo}
              aria-invalid={erros.usuarioId ? true : undefined}
            >
              <option value="">Selecione…</option>
              {colaboradores.map((colaborador) => (
                <option key={colaborador.id} value={colaborador.id}>
                  {colaborador.nome}
                </option>
              ))}
            </select>
          </CampoNativo>
          <div className="grid gap-16 md:grid-cols-2">
            <CampoNativo id="aluguel-epi-inicio" rotulo="Início da reserva" erro={erros.inicio}>
              <input
                id="aluguel-epi-inicio"
                type="datetime-local"
                value={rascunho.inicio}
                onChange={(evento) => alterar('inicio', evento.target.value)}
                className={classeCampo}
                aria-invalid={erros.inicio ? true : undefined}
              />
            </CampoNativo>
            <CampoNativo id="aluguel-epi-fim" rotulo="Devolução prevista" erro={erros.fimPrevisto}>
              <input
                id="aluguel-epi-fim"
                type="datetime-local"
                value={rascunho.fimPrevisto}
                onChange={(evento) => alterar('fimPrevisto', evento.target.value)}
                className={classeCampo}
                aria-invalid={erros.fimPrevisto ? true : undefined}
              />
            </CampoNativo>
          </div>
          <CampoAreaTexto
            rotulo="Observação"
            valor={rascunho.observacao}
            aoAlterar={(valor) => alterar('observacao', valor)}
          />
        </div>
      }
    />
  )
}
