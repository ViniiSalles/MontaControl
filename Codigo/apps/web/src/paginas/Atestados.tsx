import { useEffect, useState } from 'react'
import { StatusAtestado } from '@montacontrol/shared'
import type { AtestadoDTO, AtestadoDetalhadoDTO } from '@montacontrol/shared'
import { useAuth } from '../auth/AuthContext'
import { ErroApi } from '../api/clienteHttp'
import {
  detalharAtestado,
  listarAtestadosPendentes,
  listarHistoricoAtestados,
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

function formatarDataHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const ROTULO_STATUS: Record<StatusAtestado, string> = {
  [StatusAtestado.PENDENTE]: 'Pendente',
  [StatusAtestado.VALIDADO]: 'Aprovado',
  [StatusAtestado.REJEITADO]: 'Rejeitado',
}

/** US13/UC18 — fila de validação de atestados do RH (Figura 30). */
export default function Atestados() {
  const { sessao } = useAuth()
  const token = sessao?.accessToken ?? ''
  const [pendentes, setPendentes] = useState<AtestadoDTO[]>([])
  const [historico, setHistorico] = useState<AtestadoDTO[]>([])
  const [busca, setBusca] = useState('')
  const [emAnalise, setEmAnalise] = useState<AtestadoDetalhadoDTO | null>(null)
  const [motivo, setMotivo] = useState('')
  const [rejeitando, setRejeitando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [recarregar, setRecarregar] = useState(0)

  useEffect(() => {
    let ativo = true
    Promise.all([listarAtestadosPendentes(token), listarHistoricoAtestados(token)])
      .then(([filaPendente, jaAnalisados]) => {
        if (!ativo) return
        setPendentes(filaPendente)
        setHistorico(jaAnalisados)
      })
      .catch((causa: unknown) => {
        if (ativo) setErro(causa instanceof ErroApi ? causa.message : 'Falha ao carregar a fila.')
      })
    return () => {
      ativo = false
    }
  }, [token, recarregar])

  const buscaNormalizada = busca.trim().toLowerCase()
  const pendentesFiltrados = pendentes.filter((atestado) =>
    atestado.usuarioNome.toLowerCase().includes(buscaNormalizada),
  )
  const historicoFiltrado = historico.filter((atestado) =>
    atestado.usuarioNome.toLowerCase().includes(buscaNormalizada),
  )

  function fecharModal() {
    setEmAnalise(null)
    setMotivo('')
    setRejeitando(false)
  }

  /** Sai da fila de pendentes e entra no histórico — daí o refetch das duas listas. */
  function removerDaFila(id: number, mensagem: string) {
    setPendentes((atuais) => atuais.filter((item) => item.id !== id))
    setAviso(mensagem)
    setRecarregar((valor) => valor + 1)
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
    <LayoutAutenticado itemAtivo="/atestados" titulo="Atestados">
      <div className="space-y-24">
        <Cartao
          elevacao="elev1"
          tom="padrao"
          conteudo={
            <div className="space-y-16">
              {erro && <Alerta variante="erro" mensagem={erro} />}
              {aviso && <Alerta variante="sucesso" mensagem={aviso} />}
              <CampoTexto
                rotulo="Buscar funcionário"
                iconeEsquerda="search"
                placeholder="Nome do montador"
                valor={busca}
                aoAlterar={setBusca}
              />
              <h2 className="text-title-md font-bold text-on-surface">Aguardando validação</h2>
              {pendentesFiltrados.length === 0 ? (
                <p className="text-body-md text-on-surface-variant">
                  {pendentes.length === 0
                    ? 'Nenhum atestado aguardando validação.'
                    : 'Nenhum montador encontrado para a busca.'}
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
                    {pendentesFiltrados.map((atestado) => (
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

        <Cartao
          elevacao="elev1"
          tom="padrao"
          conteudo={
            <div className="space-y-16">
              <h2 className="text-title-md font-bold text-on-surface">Histórico</h2>
              {historicoFiltrado.length === 0 ? (
                <p className="text-body-md text-on-surface-variant">
                  {historico.length === 0
                    ? 'Nenhum atestado analisado ainda.'
                    : 'Nenhum montador encontrado para a busca.'}
                </p>
              ) : (
                <table className="w-full text-body-md text-on-surface">
                  <thead className="text-label-md uppercase text-on-surface-variant">
                    <tr>
                      <th className="py-8 text-left">Montador</th>
                      <th className="py-8 text-left">Período</th>
                      <th className="py-8 text-left">Situação</th>
                      <th className="py-8 text-left">Motivo</th>
                      <th className="py-8 text-left">Analisado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoFiltrado.map((atestado) => (
                      <tr key={atestado.id} className="border-t border-outline-variant/30">
                        <td className="py-8">{atestado.usuarioNome}</td>
                        <td className="py-8">
                          {formatarDia(atestado.dataInicio)} a {formatarDia(atestado.dataFim)}
                        </td>
                        <td className="py-8">{ROTULO_STATUS[atestado.status]}</td>
                        <td className="py-8 text-on-surface-variant">{atestado.motivoRejeicao ?? '—'}</td>
                        <td className="py-8">{formatarDataHora(atestado.validadoEm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          }
        />
      </div>

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
