import { useState } from 'react'
import type { AluguelEpiDTO } from '@montacontrol/shared'
import { formatarDataHoraCurta } from '../../formatacao/datas'
import { deDataHoraLocal, paraDataHoraLocal } from '../../formatacao/epis'
import { Alerta } from '../../ui/Alerta'
import { Modal } from '../../ui/Modal'
import { CampoNativo, classeCampoNativo } from './CampoNativo'

interface PropsModalDevolucaoEpi {
  aluguel: AluguelEpiDTO
  erro: string | null
  aoFechar: () => void
  /** Rejeita quando falha, para o modal continuar aberto. */
  aoConfirmar: (devolvidoEm: string) => Promise<void>
}

/** Registro da devolução real — por padrão agora; dá para ajustar se o gestor lança depois. */
export function ModalDevolucaoEpi({ aluguel, erro, aoFechar, aoConfirmar }: PropsModalDevolucaoEpi) {
  const [devolvidoEm, setDevolvidoEm] = useState(() => paraDataHoraLocal(new Date()))
  const [erroCampo, setErroCampo] = useState<string | undefined>(undefined)
  const [salvando, setSalvando] = useState(false)

  async function confirmar() {
    if (salvando) return
    const instante = deDataHoraLocal(devolvidoEm)
    if (!instante) {
      setErroCampo('Informe a data e a hora da devolução.')
      return
    }
    if (Date.parse(instante) < Date.parse(aluguel.inicio)) {
      setErroCampo('A devolução não pode ser antes do início do aluguel.')
      return
    }
    setSalvando(true)
    try {
      await aoConfirmar(instante)
    } catch {
      // A página guardou a mensagem em `erro`.
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      visivel
      apresentacao="centro"
      titulo="Registrar devolução"
      aoFechar={aoFechar}
      acoes={[
        { texto: 'Cancelar', variante: 'fantasma', aoPressionar: aoFechar },
        { texto: salvando ? 'Salvando…' : 'Registrar devolução', aoPressionar: () => void confirmar() },
      ]}
      conteudo={
        <div className="space-y-16">
          {erro && <Alerta variante="erro" mensagem={erro} />}
          <p className="text-body-md text-on-surface">
            <strong>
              {aluguel.quantidade}× {aluguel.tipoEpi.nome}
            </strong>{' '}
            com {aluguel.colaborador.nome}, retirado em {formatarDataHoraCurta(aluguel.inicio)} — devolução prevista
            para {formatarDataHoraCurta(aluguel.fimPrevisto)}.
          </p>
          <CampoNativo id="devolucao-epi-instante" rotulo="Devolvido em" erro={erroCampo}>
            <input
              id="devolucao-epi-instante"
              type="datetime-local"
              value={devolvidoEm}
              onChange={(evento) => {
                setDevolvidoEm(evento.target.value)
                setErroCampo(undefined)
              }}
              className={classeCampoNativo}
              aria-invalid={erroCampo ? true : undefined}
            />
          </CampoNativo>
        </div>
      }
    />
  )
}
