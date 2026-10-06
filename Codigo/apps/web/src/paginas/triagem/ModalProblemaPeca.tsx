import { useState } from 'react'
import type { FotoBase64, TipoAvariaDTO } from '@montacontrol/shared'
import { TIPOS_FOTO_ACEITOS, lerFotoComoBase64 } from '../../formatacao/fotos'
import { CampoAreaTexto } from '../../ui/CampoAreaTexto'
import { Modal } from '../../ui/Modal'

const MAXIMO_FOTOS = 3

export interface DadosProblemaPeca {
  tipoAvariaId: number
  descricao: string
  fotos: FotoBase64[]
}

interface PropsModalProblemaPeca {
  visivel: boolean
  descricaoPeca: string
  numeroPedido: string
  tipos: TipoAvariaDTO[]
  /** Rejeita com a mensagem a exibir quando o envio falha — o modal continua aberto. */
  aoEnviar: (dados: DadosProblemaPeca) => Promise<void>
  aoFechar: () => void
}

/** Reporte de problema na peça (avaria, falta, defeito) — vai para a fila de análise do gestor. */
export function ModalProblemaPeca({
  visivel,
  descricaoPeca,
  numeroPedido,
  tipos,
  aoEnviar,
  aoFechar,
}: PropsModalProblemaPeca) {
  const [tipoAvariaId, setTipoAvariaId] = useState<number | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  function fechar() {
    if (enviando) return
    setTipoAvariaId(null)
    setMensagem('')
    setArquivos([])
    setErro(null)
    aoFechar()
  }

  async function enviar() {
    if (enviando) return
    if (tipoAvariaId === null) {
      setErro('Selecione o tipo de problema.')
      return
    }
    if (mensagem.trim().length < 3) {
      setErro('Descreva o problema.')
      return
    }
    setEnviando(true)
    setErro(null)
    try {
      const fotos = await Promise.all(arquivos.map(lerFotoComoBase64))
      await aoEnviar({ tipoAvariaId, descricao: mensagem.trim(), fotos })
      setEnviando(false)
      fechar()
    } catch (causa: unknown) {
      setErro(causa instanceof Error ? causa.message : 'Falha ao enviar o problema.')
      setEnviando(false)
    }
  }

  return (
    <Modal
      visivel={visivel}
      apresentacao="centro"
      titulo="Reportar problema na peça"
      aoFechar={fechar}
      acoes={[
        { texto: 'Cancelar', variante: 'fantasma', aoPressionar: fechar },
        { texto: enviando ? 'Enviando…' : 'Enviar', aoPressionar: () => void enviar() },
      ]}
      conteudo={
        <div className="space-y-16">
          <p className="text-body-md text-on-surface-variant">
            O problema será enviado para análise do gestor do pedido {numeroPedido}.
          </p>
          <p className="text-title-sm text-on-surface">{descricaoPeca}</p>
          <fieldset className="space-y-8">
            <legend className="px-4 text-label-lg uppercase text-on-surface-variant">Problema</legend>
            {tipos.map((tipo) => (
              <label key={tipo.id} className="flex cursor-pointer items-center gap-8 text-body-md text-on-surface">
                <input
                  type="radio"
                  name="tipo-problema"
                  checked={tipoAvariaId === tipo.id}
                  onChange={() => setTipoAvariaId(tipo.id)}
                  className="accent-primary"
                />
                {tipo.nome}
                <span className="text-body-sm text-on-surface-variant">— {tipo.descricao}</span>
              </label>
            ))}
          </fieldset>
          <CampoAreaTexto
            rotulo="Detalhes"
            placeholder="Descreva o que está faltando ou qual é o defeito"
            valor={mensagem}
            aoAlterar={setMensagem}
          />
          <div className="space-y-6">
            <label htmlFor="fotos-problema" className="block px-4 text-label-lg uppercase text-on-surface-variant">
              Fotos (opcional, até {MAXIMO_FOTOS})
            </label>
            <input
              id="fotos-problema"
              type="file"
              accept={TIPOS_FOTO_ACEITOS}
              multiple
              onChange={(evento) => setArquivos(Array.from(evento.target.files ?? []).slice(0, MAXIMO_FOTOS))}
              className="block w-full text-body-md text-on-surface-variant"
            />
          </div>
          {erro && (
            <p role="alert" className="px-4 text-body-sm text-error">
              {erro}
            </p>
          )}
        </div>
      }
    />
  )
}
