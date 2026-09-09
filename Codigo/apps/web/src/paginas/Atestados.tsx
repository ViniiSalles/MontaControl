import { useEffect, useState } from 'react'
import type { AtestadoDTO, AtestadoDetalhadoDTO } from '@montacontrol/shared'
import { useAuth } from '../auth/AuthContext'
import { ErroApi } from '../api/clienteHttp'
import {
  detalharAtestado,
  listarAtestadosPendentes,
  rejeitarAtestado,
  validarAtestado,
} from '../api/atestados'
import { Alerta } from '../ui/Alerta'
import { Botao } from '../ui/Botao'
import { CampoTexto } from '../ui/CampoTexto'
import { Cartao } from '../ui/Cartao'
import { Modal } from '../ui/Modal'
import { LayoutAutenticado } from './LayoutAutenticado'

/** Dia civil `YYYY-MM-DD` para exibição, sem `new Date` (que aplicaria fuso e voltaria um dia). */
function formatarDia(dia: string): string {
  const [ano, mes, diaDoMes] = dia.split('-')
  return `${diaDoMes}/${mes}/${ano}`
}

/** US13/UC18 — fila de validação de atestados do RH (Figura 30). */
export default function Atestados() {
  const { sessao } = useAuth()
  const token = sessao?.accessToken ?? ''
  const [pendentes, setPendentes] = useState<AtestadoDTO[]>([])
  const [emAnalise, setEmAnalise] = useState<AtestadoDetalhadoDTO | null>(null)
  const [motivo, setMotivo] = useState('')
  const [rejeitando, setRejeitando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    listarAtestadosPendentes(token)
      .then((lista) => {
        if (ativo) setPendentes(lista)
      })
      .catch((causa: unknown) => {
        if (ativo) setErro(causa instanceof ErroApi ? causa.message : 'Falha ao carregar a fila.')
      })
    return () => {
      ativo = false
    }
  }, [token])

  function fecharModal() {
    setEmAnalise(null)
    setMotivo('')
    setRejeitando(false)
  }

  function removerDaFila(id: number, mensagem: string) {
    setPendentes((atuais) => atuais.filter((item) => item.id !== id))
    setAviso(mensagem)
    fecharModal()
  }

  async function aoAnalisar(atestado: AtestadoDTO) {
    setErro(null)
    try {
      setEmAnalise(await detalharAtestado(token, atestado.id))
    } catch (causa: unknown) {
      setErro(causa instanceof ErroApi ? causa.message : 'Falha ao abrir o atestado.')
    }
  }

  async function aoAprovar() {
    if (!emAnalise) return
    try {
      await validarAtestado(token, emAnalise.id)
      removerDaFila(emAnalise.id, `Atestado de ${emAnalise.usuarioNome} aprovado.`)
    } catch (causa: unknown) {
      setErro(causa instanceof ErroApi ? causa.message : 'Falha ao aprovar o atestado.')
    }
  }

  async function aoConfirmarRejeicao() {
    if (!emAnalise) return
    try {
      await rejeitarAtestado(token, emAnalise.id, motivo)
      removerDaFila(emAnalise.id, `Atestado de ${emAnalise.usuarioNome} rejeitado.`)
    } catch (causa: unknown) {
      setErro(causa instanceof ErroApi ? causa.message : 'Falha ao rejeitar o atestado.')
    }
  }

  const acoesDoModal = rejeitando
    ? [
        { texto: 'Confirmar rejeição', aoPressionar: () => void aoConfirmarRejeicao() },
        { texto: 'Voltar', variante: 'fantasma' as const, aoPressionar: () => setRejeitando(false) },
      ]
    : [
        { texto: 'Aprovar', aoPressionar: () => void aoAprovar() },
        { texto: 'Rejeitar', variante: 'fantasma' as const, aoPressionar: () => setRejeitando(true) },
      ]

  return (
    <LayoutAutenticado aba="Atestados">
      <Cartao
        elevacao="elev1"
        tom="padrao"
        conteudo={
          <div className="space-y-16">
            <h1 className="text-title-lg font-bold text-on-surface">Gestão de Atestados</h1>
            {erro && <Alerta variante="erro" mensagem={erro} />}
            {aviso && <Alerta variante="sucesso" mensagem={aviso} />}
            {pendentes.length === 0 ? (
              <p className="text-body-md text-on-surface-variant">
                Nenhum atestado aguardando validação.
              </p>
            ) : (
              <table className="w-full text-body-md text-on-surface">
                <thead className="text-label-md uppercase text-on-surface-variant">
                  <tr>
                    <th className="py-8 text-left">Montador</th>
                    <th className="py-8 text-left">Período</th>
                    <th className="py-8 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pendentes.map((atestado) => (
                    <tr key={atestado.id} className="border-t border-outline-variant/30">
                      <td className="py-8">{atestado.usuarioNome}</td>
                      <td className="py-8">
                        {formatarDia(atestado.dataInicio)} a {formatarDia(atestado.dataFim)}
                      </td>
                      <td className="py-8 text-right">
                        <Botao
                          variante="primario"
                          tamanho={40}
                          forma="retangular"
                          texto="Analisar"
                          aoPressionar={() => void aoAnalisar(atestado)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        }
      />

      <Modal
        visivel={emAnalise !== null}
        apresentacao="centro"
        titulo={emAnalise ? `Atestado de ${emAnalise.usuarioNome}` : ''}
        aoFechar={fecharModal}
        acoes={acoesDoModal}
        conteudo={
          emAnalise && (
            <div className="space-y-16">
              <p className="text-body-md text-on-surface-variant">
                Período: {formatarDia(emAnalise.dataInicio)} a {formatarDia(emAnalise.dataFim)}
              </p>
              {emAnalise.fotos.map((foto) => (
                <img
                  key={foto.id}
                  src={foto.url}
                  alt="Foto do atestado"
                  className="w-full rounded-md"
                />
              ))}
              {rejeitando && (
                <CampoTexto
                  rotulo="Motivo da rejeição"
                  valor={motivo}
                  aoAlterar={setMotivo}
                />
              )}
            </div>
          )
        }
      />
    </LayoutAutenticado>
  )
}
