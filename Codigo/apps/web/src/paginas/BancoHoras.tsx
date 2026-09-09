import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SaldoMontadorDTO, SolicitacaoPontoDTO } from '@montacontrol/shared'
import { useAuth } from '../auth/AuthContext'
import { ErroApi } from '../api/clienteHttp'
import { listarBancoHoras } from '../api/bancoHoras'
import {
  aprovarCompensacao,
  listarCompensacoesPendentes,
  rejeitarCompensacao,
} from '../api/pontosEmAtraso'
import { Alerta } from '../ui/Alerta'
import { Botao } from '../ui/Botao'
import { CampoTexto } from '../ui/CampoTexto'
import { Cartao } from '../ui/Cartao'
import { Modal } from '../ui/Modal'
import { LayoutAutenticado } from './LayoutAutenticado'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function formatarHoras(horas: number): string {
  const sinal = horas < 0 ? '-' : '+'
  const total = Math.abs(horas)
  const inteiras = Math.floor(total)
  const minutos = Math.round((total - inteiras) * 60)
  return `${sinal}${inteiras}h${String(minutos).padStart(2, '0')}`
}

/** US14/UC19 — painel de banco de horas e aprovação de compensações (Figura 32). */
export default function BancoHoras() {
  const { sessao } = useAuth()
  const token = sessao?.accessToken ?? ''
  const agora = new Date()
  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [saldos, setSaldos] = useState<SaldoMontadorDTO[]>([])
  const [compensacoes, setCompensacoes] = useState<SolicitacaoPontoDTO[]>([])
  const [emRejeicao, setEmRejeicao] = useState<SolicitacaoPontoDTO | null>(null)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [recarregar, setRecarregar] = useState(0)

  useEffect(() => {
    let ativo = true
    Promise.all([listarBancoHoras(token, ano, mes), listarCompensacoesPendentes(token)])
      .then(([linhas, pendentes]) => {
        if (!ativo) return
        setSaldos(linhas)
        setCompensacoes(pendentes)
      })
      .catch((causa: unknown) => {
        if (ativo) setErro(causa instanceof ErroApi ? causa.message : 'Falha ao carregar o painel.')
      })
    return () => {
      ativo = false
    }
  }, [token, ano, mes, recarregar])

  async function aoAprovar(compensacao: SolicitacaoPontoDTO) {
    setErro(null)
    try {
      await aprovarCompensacao(token, compensacao.id)
      setAviso(`Compensação de ${compensacao.usuarioNome} aprovada.`)
      setRecarregar((valor) => valor + 1)
    } catch (causa: unknown) {
      setErro(causa instanceof ErroApi ? causa.message : 'Falha ao aprovar a compensação.')
    }
  }

  async function aoConfirmarRejeicao() {
    if (!emRejeicao) return
    try {
      await rejeitarCompensacao(token, emRejeicao.id, motivo)
      setAviso(`Compensação de ${emRejeicao.usuarioNome} rejeitada.`)
      setEmRejeicao(null)
      setMotivo('')
      setRecarregar((valor) => valor + 1)
    } catch (causa: unknown) {
      setErro(causa instanceof ErroApi ? causa.message : 'Falha ao rejeitar a compensação.')
    }
  }

  return (
    <LayoutAutenticado aba="Banco de Horas">
      <div className="space-y-24">
        <Cartao
          elevacao="elev1"
          tom="padrao"
          conteudo={
            <div className="space-y-16">
              <h1 className="text-title-lg font-bold text-on-surface">Banco de Horas</h1>
              {erro && <Alerta variante="erro" mensagem={erro} />}
              {aviso && <Alerta variante="sucesso" mensagem={aviso} />}
              <div className="flex items-center gap-16">
                <label className="text-body-md text-on-surface-variant">
                  Mês
                  <select
                    className="ml-8 rounded-md border border-outline-variant bg-surface px-12 py-8 text-body-md text-on-surface"
                    value={mes}
                    onChange={(evento) => setMes(Number(evento.target.value))}
                  >
                    {MESES.map((nome, indice) => (
                      <option key={nome} value={indice + 1}>{nome}</option>
                    ))}
                  </select>
                </label>
                <label className="text-body-md text-on-surface-variant">
                  Ano
                  <select
                    className="ml-8 rounded-md border border-outline-variant bg-surface px-12 py-8 text-body-md text-on-surface"
                    value={ano}
                    onChange={(evento) => setAno(Number(evento.target.value))}
                  >
                    {[agora.getFullYear() - 1, agora.getFullYear()].map((valor) => (
                      <option key={valor} value={valor}>{valor}</option>
                    ))}
                  </select>
                </label>
              </div>
              <table className="w-full text-body-md text-on-surface">
                <thead className="text-label-md uppercase text-on-surface-variant">
                  <tr>
                    <th className="py-8 text-left">Montador</th>
                    <th className="py-8 text-right">Trabalhadas</th>
                    <th className="py-8 text-right">Previstas</th>
                    <th className="py-8 text-right">Abonadas</th>
                    <th className="py-8 text-right">Saldo</th>
                    <th className="py-8 text-right">Espelho</th>
                  </tr>
                </thead>
                <tbody>
                  {saldos.map((linha) => (
                    <tr key={linha.usuarioId} className="border-t border-outline-variant/30">
                      <td className="py-8">{linha.usuarioNome}</td>
                      <td className="py-8 text-right">{linha.horasTrabalhadas}h</td>
                      <td className="py-8 text-right">{linha.horasPrevistas}h</td>
                      <td className="py-8 text-right">{linha.horasAbonadas}h</td>
                      <td className="py-8 text-right">{formatarHoras(linha.saldo)}</td>
                      <td className="py-8 text-right">
                        <Link
                          className="text-body-md font-bold text-primary underline"
                          to={`/espelho-ponto/${linha.usuarioId}?ano=${ano}&mes=${mes}`}
                        >
                          Espelho de ponto
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        />

        <Cartao
          elevacao="elev1"
          tom="padrao"
          conteudo={
            <div className="space-y-16">
              <h2 className="text-title-md font-bold text-on-surface">
                Compensações aguardando aprovação
              </h2>
              {compensacoes.length === 0 ? (
                <p className="text-body-md text-on-surface-variant">Nenhuma compensação pendente.</p>
              ) : (
                <table className="w-full text-body-md text-on-surface">
                  <tbody>
                    {compensacoes.map((compensacao) => (
                      <tr key={compensacao.id} className="border-t border-outline-variant/30">
                        <td className="py-8">{compensacao.usuarioNome}</td>
                        <td className="py-8">{compensacao.data}</td>
                        <td className="py-8">{compensacao.minutosSolicitados} min</td>
                        <td className="py-8">{compensacao.justificativa}</td>
                        <td className="py-8 text-right">
                          <div className="flex justify-end gap-8">
                            <Botao
                              variante="primario"
                              tamanho={40}
                              forma="retangular"
                              texto="Aprovar"
                              aoPressionar={() => void aoAprovar(compensacao)}
                            />
                            <Botao
                              variante="fantasma"
                              tamanho={40}
                              forma="retangular"
                              texto="Rejeitar"
                              aoPressionar={() => setEmRejeicao(compensacao)}
                            />
                          </div>
                        </td>
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
        visivel={emRejeicao !== null}
        apresentacao="centro"
        titulo="Rejeitar compensação"
        aoFechar={() => setEmRejeicao(null)}
        acoes={[{ texto: 'Confirmar rejeição', aoPressionar: () => void aoConfirmarRejeicao() }]}
        conteudo={
          <CampoTexto rotulo="Motivo da rejeição" valor={motivo} aoAlterar={setMotivo} />
        }
      />
    </LayoutAutenticado>
  )
}
