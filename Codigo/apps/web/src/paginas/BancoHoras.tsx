import { useEffect, useState } from 'react'
import type { EspelhoPontoDTO, SaldoMontadorDTO, SolicitacaoPontoDTO } from '@montacontrol/shared'
import { useAuth } from '../auth/AuthContext'
import { ErroApi } from '../api/clienteHttp'
import { listarBancoHorasDaEquipe } from '../api/bancoHoras'
import { buscarEspelhoPonto } from '../api/espelhoPonto'
import { aprovarCompensacao, listarCompensacoesPendentes, rejeitarCompensacao } from '../api/pontosEmAtraso'
import { competenciaParaTexto, textoParaCompetencia } from '../formatacao/datas'
import { formatarMinutos, horasParaMinutos } from '../formatacao/horas'
import { Alerta } from '../ui/Alerta'
import { Avatar } from '../ui/Avatar'
import { BadgeStatus } from '../ui/BadgeStatus'
import { CampoTexto } from '../ui/CampoTexto'
import { CartaoIndicador } from '../ui/CartaoIndicador'
import { Modal } from '../ui/Modal'
import { SimboloMaterial } from '../ui/SimboloMaterial'
import { SubAbas } from '../ui/SubAbas'
import { TabelaDados, type ColunaTabela } from '../ui/TabelaDados'
import { LayoutAutenticado } from './LayoutAutenticado'
import { AbaSolicitacoes } from './banco-horas/AbaSolicitacoes'
import { DetalheMontador } from './banco-horas/DetalheMontador'

type Aba = 'resumo' | 'solicitacoes'

const mensagemDe = (causa: unknown, padrao: string) => (causa instanceof ErroApi ? causa.message : padrao)

/** US14/UC19 — banco de horas da equipe e aprovação de compensações (`banco_de_horas`). */
export default function BancoHoras() {
  const { sessao } = useAuth()
  const token = sessao?.accessToken ?? ''
  const agora = new Date()
  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [aba, setAba] = useState<Aba>('resumo')
  const [saldos, setSaldos] = useState<SaldoMontadorDTO[]>([])
  const [compensacoes, setCompensacoes] = useState<SolicitacaoPontoDTO[]>([])
  const [busca, setBusca] = useState('')
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null)
  const [espelho, setEspelho] = useState<EspelhoPontoDTO | null>(null)
  const [falhaEspelho, setFalhaEspelho] = useState<{ id: number; ano: number; mes: number } | null>(null)
  const [emRejeicao, setEmRejeicao] = useState<SolicitacaoPontoDTO | null>(null)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [recarregar, setRecarregar] = useState(0)

  useEffect(() => {
    let ativo = true
    Promise.all([listarBancoHorasDaEquipe(token, ano, mes), listarCompensacoesPendentes(token)])
      .then(([linhas, pendentes]) => {
        if (!ativo) return
        setSaldos(linhas)
        setCompensacoes(pendentes)
      })
      .catch((causa: unknown) => {
        if (ativo) setErro(mensagemDe(causa, 'Falha ao carregar o painel.'))
      })
    return () => {
      ativo = false
    }
  }, [token, ano, mes, recarregar])

  const termo = busca.trim().toLowerCase()
  const filtrados = saldos.filter((linha) => linha.usuarioNome.toLowerCase().includes(termo))
  const selecionado = filtrados.find((linha) => linha.usuarioId === selecionadoId) ?? filtrados[0] ?? null
  const idDoDetalhe = selecionado?.usuarioId ?? null

  useEffect(() => {
    if (idDoDetalhe === null) return
    let ativo = true
    buscarEspelhoPonto(token, idDoDetalhe, ano, mes)
      .then((dados) => {
        if (!ativo) return
        setEspelho(dados)
        setFalhaEspelho(null)
      })
      .catch(() => {
        // O detalhe é complementar à tabela: falha aqui não bloqueia o painel.
        if (!ativo) return
        setEspelho(null)
        setFalhaEspelho({ id: idDoDetalhe, ano, mes })
      })
    return () => {
      ativo = false
    }
  }, [token, idDoDetalhe, ano, mes, recarregar])

  const espelhoDoSelecionado = espelho && espelho.usuarioId === idDoDetalhe && espelho.ano === ano && espelho.mes === mes ? espelho : null
  const espelhoFalhou = falhaEspelho !== null && falhaEspelho.id === idDoDetalhe && falhaEspelho.ano === ano && falhaEspelho.mes === mes
  const pendenteDoSelecionado =
    compensacoes.filter((item) => item.usuarioId === idDoDetalhe).sort((a, b) => a.data.localeCompare(b.data))[0] ?? null

  const emDebito = saldos.filter((linha) => linha.saldo < 0).length
  const saldoTotalMinutos = saldos.reduce((soma, linha) => soma + horasParaMinutos(linha.saldo), 0)
  const maiorSaldo = saldos.reduce<SaldoMontadorDTO | null>((maior, linha) => (!maior || linha.saldo > maior.saldo ? linha : maior), null)

  async function aoAprovar(compensacao: SolicitacaoPontoDTO) {
    setErro(null)
    try {
      await aprovarCompensacao(token, compensacao.id)
      setAviso(`Compensação de ${compensacao.usuarioNome} aprovada.`)
      setRecarregar((valor) => valor + 1)
    } catch (causa: unknown) {
      setErro(mensagemDe(causa, 'Falha ao aprovar a compensação.'))
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
      setErro(mensagemDe(causa, 'Falha ao rejeitar a compensação.'))
    }
  }

  function aoMudarCompetencia(texto: string) {
    const alvo = textoParaCompetencia(texto)
    if (!alvo) return
    setAno(alvo.ano)
    setMes(alvo.mes)
  }

  const colunas: ColunaTabela<SaldoMontadorDTO>[] = [
    {
      titulo: 'Montador',
      ordenacao: { tipo: 'texto', valor: (linha) => linha.usuarioNome },
      render: (linha) => (
        <div className="flex items-center gap-12">
          <Avatar nome={linha.usuarioNome} />
          <span className="text-title-sm">{linha.usuarioNome}</span>
        </div>
      ),
    },
    {
      titulo: 'Saldo atual',
      ordenacao: { tipo: 'numero', valor: (linha) => linha.saldo },
      render: (linha) => (
        <span className={['text-title-md', linha.saldo < 0 ? 'text-error' : 'text-primary'].join(' ')}>
          {formatarMinutos(horasParaMinutos(linha.saldo), true)}h
        </span>
      ),
    },
    {
      titulo: 'Situação',
      // Quem tem compensação pendente pede ação do RH — vem primeiro no decrescente.
      ordenacao: { tipo: 'numero', valor: (linha) => linha.compensacoesPendentes },
      render: (linha) => (
        <div className="flex flex-wrap items-center gap-8">
          {linha.saldo > 0 && <BadgeStatus variante="info" texto="Crédito" />}
          {linha.saldo < 0 && <BadgeStatus variante="erro" texto="Débito" />}
          {linha.saldo === 0 && <BadgeStatus variante="neutro" texto="Zerado" />}
          {linha.compensacoesPendentes > 0 && (
            <span className="flex items-center gap-4 text-label-sm text-error">
              <span aria-hidden="true" className="h-8 w-8 rounded-full bg-error" />
              Compensação pendente
            </span>
          )}
        </div>
      ),
    },
    {
      titulo: 'Ação',
      alinhamento: 'direita',
      render: () => <SimboloMaterial nome="chevron_right" className="text-2xl text-on-surface-variant" />,
    },
  ]

  return (
    <LayoutAutenticado
      itemAtivo="/banco-horas"
      titulo="Banco de Horas"
      complementoTitulo={
        <SubAbas<Aba>
          abas={[
            { id: 'resumo', rotulo: 'Resumo Geral' },
            { id: 'solicitacoes', rotulo: 'Solicitações', contador: compensacoes.length },
          ]}
          ativa={aba}
          aoMudar={setAba}
        />
      }
    >
      <div className="space-y-32">
        {erro && <Alerta variante="erro" mensagem={erro} />}
        {aviso && <Alerta variante="sucesso" mensagem={aviso} />}

        {aba === 'solicitacoes' ? (
          <AbaSolicitacoes compensacoes={compensacoes} aoAprovar={(item) => void aoAprovar(item)} aoRejeitar={setEmRejeicao} />
        ) : (
          <>
            <div className="flex flex-col gap-32 lg:flex-row lg:items-start">
              <section className="min-w-0 flex-1 space-y-24">
                <div className="flex flex-wrap items-end justify-between gap-16">
                  <h2 className="text-headline-sm text-on-surface">Saldos por Montador</h2>
                  <div className="flex flex-wrap items-end gap-16">
                    <div className="w-full max-w-xs">
                      <CampoTexto rotulo="Buscar montador" iconeEsquerda="search" placeholder="Nome do montador" valor={busca} aoAlterar={setBusca} />
                    </div>
                    <label className="space-y-6">
                      <span className="block px-4 text-label-lg uppercase text-on-surface-variant">Competência</span>
                      <input
                        type="month"
                        value={competenciaParaTexto(ano, mes)}
                        onChange={(evento) => aoMudarCompetencia(evento.target.value)}
                        className="h-alturaCampo rounded-lg border-none bg-surface-container-low px-16 text-body-md text-on-surface focus:outline-none"
                      />
                    </label>
                  </div>
                </div>
                <TabelaDados
                  rotulo="Saldos por montador"
                  colunas={colunas}
                  linhas={filtrados}
                  chave={(linha) => linha.usuarioId}
                  selecionada={idDoDetalhe}
                  aoSelecionar={(linha) => setSelecionadoId(linha.usuarioId)}
                  classeLinha={(linha) => (linha.compensacoesPendentes > 0 ? 'border-l-4 border-error bg-error-container/20' : '')}
                  vazio={saldos.length === 0 ? 'Nenhum saldo calculado para o mês.' : 'Nenhum montador encontrado para a busca.'}
                />
              </section>
              {selecionado && (
                <DetalheMontador
                  saldo={selecionado}
                  espelho={espelhoDoSelecionado}
                  falhaEspelho={espelhoFalhou && !espelhoDoSelecionado}
                  compensacaoPendente={pendenteDoSelecionado}
                  ano={ano}
                  mes={mes}
                  aoAprovar={(item) => void aoAprovar(item)}
                  aoRejeitar={setEmRejeicao}
                />
              )}
            </div>

            <div className="grid gap-24 sm:grid-cols-2 xl:grid-cols-4">
              <CartaoIndicador icone="warning" tom="erro" rotulo="Montadores em débito" valor={String(emDebito)} />
              <CartaoIndicador icone="trending_up" rotulo="Saldo total acumulado" valor={`${formatarMinutos(saldoTotalMinutos, true)}h`} />
              <CartaoIndicador icone="pending_actions" rotulo="Compensações pendentes" valor={String(compensacoes.length)} />
              <CartaoIndicador tom="destaque" rotulo="Maior saldo" valor={maiorSaldo ? maiorSaldo.usuarioNome : '—'} complemento={maiorSaldo ? `${formatarMinutos(horasParaMinutos(maiorSaldo.saldo), true)}h` : undefined} />
            </div>
          </>
        )}
      </div>

      <Modal
        visivel={emRejeicao !== null}
        apresentacao="centro"
        titulo="Rejeitar compensação"
        aoFechar={() => {
          setEmRejeicao(null)
          setMotivo('')
        }}
        acoes={[{ texto: 'Confirmar rejeição', aoPressionar: () => void aoConfirmarRejeicao() }]}
        conteudo={<CampoTexto rotulo="Motivo da rejeição" valor={motivo} aoAlterar={setMotivo} />}
      />
    </LayoutAutenticado>
  )
}
