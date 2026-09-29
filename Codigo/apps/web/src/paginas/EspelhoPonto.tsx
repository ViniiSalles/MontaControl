import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Perfil } from '@montacontrol/shared'
import type { EspelhoPontoDTO, UsuarioDTO } from '@montacontrol/shared'
import { useAuth } from '../auth/AuthContext'
import { baixarAfd } from '../api/afd'
import { ErroApi } from '../api/clienteHttp'
import { buscarEspelhoPonto } from '../api/espelhoPonto'
import { listarUsuarios } from '../api/usuarios'
import { competenciaParaTexto, nomeDoMes, textoParaCompetencia } from '../formatacao/datas'
import { contarFaltas, hojeCivil } from '../formatacao/espelho'
import { formatarMinutos } from '../formatacao/horas'
import { Alerta } from '../ui/Alerta'
import { BadgeStatus } from '../ui/BadgeStatus'
import { Botao } from '../ui/Botao'
import { CartaoIndicador } from '../ui/CartaoIndicador'
import { SimboloMaterial } from '../ui/SimboloMaterial'
import { LayoutAutenticado } from './LayoutAutenticado'
import { TabelaEspelho } from './espelho-ponto/TabelaEspelho'

const mensagemDe = (causa: unknown, padrao: string) => (causa instanceof ErroApi ? causa.message : padrao)
const classeRotulo = 'mb-8 block text-label-md uppercase text-on-surface-variant'
const classeCampo = 'h-alturaCampo w-full rounded-lg border-none bg-surface-container-low px-16 text-body-lg text-on-surface focus:bg-surface-container-lowest focus:shadow-elev2 focus:outline-none'

interface PropsFiltroEspelho {
  montadores: UsuarioDTO[]
  montadorInicial: string
  competenciaInicial: string
  aoVisualizar: (montadorId: string, competencia: string) => void
}

/** Estado do formulário vive aqui; o pai troca a `key` quando a URL muda para ressincronizar. */
function FiltroEspelho({ montadores, montadorInicial, competenciaInicial, aoVisualizar }: PropsFiltroEspelho) {
  const [montadorEscolhido, setMontadorEscolhido] = useState(montadorInicial)
  const [competencia, setCompetencia] = useState(competenciaInicial)

  return (
    <form
      className="flex flex-col gap-24 rounded-xl bg-surface-container-lowest p-24 shadow-elev1 md:flex-row md:items-end lg:col-span-2"
      onSubmit={(evento) => {
        evento.preventDefault()
        aoVisualizar(montadorEscolhido, competencia)
      }}
    >
      <div className="flex-1">
        <label htmlFor="filtro-montador" className={classeRotulo}>Selecionar montador</label>
        <select id="filtro-montador" value={montadorEscolhido} onChange={(evento) => setMontadorEscolhido(evento.target.value)} className={classeCampo}>
          <option value="">Escolha…</option>
          {montadores.map((montador) => (
            <option key={montador.id} value={montador.id}>{montador.nome}</option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        <label htmlFor="filtro-mes" className={classeRotulo}>Mês de referência</label>
        <input id="filtro-mes" type="month" value={competencia} onChange={(evento) => setCompetencia(evento.target.value)} className={classeCampo} />
      </div>
      <Botao variante="primario" tamanho={56} forma="pilula" icone="search" texto="Visualizar" aoPressionar={() => aoVisualizar(montadorEscolhido, competencia)} />
    </form>
  )
}

/** US14/UC19 — espelho de ponto mensal do montador (`espelho_de_ponto`). */
export default function EspelhoPonto() {
  const { sessao } = useAuth()
  const token = sessao?.accessToken ?? ''
  const navigate = useNavigate()
  const { usuarioId } = useParams<{ usuarioId?: string }>()
  const [parametros] = useSearchParams()
  const agora = new Date()
  const ano = Number(parametros.get('ano') ?? agora.getFullYear())
  const mes = Number(parametros.get('mes') ?? agora.getMonth() + 1)
  const hoje = hojeCivil(agora)

  const [montadores, setMontadores] = useState<UsuarioDTO[]>([])
  const [espelho, setEspelho] = useState<EspelhoPontoDTO | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [baixandoAfd, setBaixandoAfd] = useState(false)
  const [erroAfd, setErroAfd] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    listarUsuarios(token)
      .then((usuarios) => {
        if (ativo) setMontadores(usuarios.filter((usuario) => usuario.perfil === Perfil.MONTADOR))
      })
      .catch((causa: unknown) => {
        if (ativo) setErro(mensagemDe(causa, 'Falha ao carregar montadores.'))
      })
    return () => {
      ativo = false
    }
  }, [token])

  useEffect(() => {
    if (!usuarioId) return
    let ativo = true
    buscarEspelhoPonto(token, Number(usuarioId), ano, mes)
      .then((dados) => {
        if (ativo) setEspelho(dados)
      })
      .catch((causa: unknown) => {
        if (ativo) setErro(mensagemDe(causa, 'Falha ao carregar o espelho.'))
      })
    return () => {
      ativo = false
    }
  }, [token, usuarioId, ano, mes])

  function aoVisualizar(montadorEscolhido: string, competencia: string) {
    const alvo = textoParaCompetencia(competencia)
    if (!montadorEscolhido || !alvo) {
      setErro('Selecione um montador e o mês de referência.')
      return
    }
    setErro(null)
    setErroAfd(null)
    navigate(`/espelho-ponto/${montadorEscolhido}?ano=${alvo.ano}&mes=${alvo.mes}`)
  }

  async function aoExportarAfd() {
    if (!espelhoAtual) return
    setErroAfd(null)
    setBaixandoAfd(true)
    try {
      await baixarAfd(token, espelhoAtual.ano, espelhoAtual.mes)
    } catch (causa: unknown) {
      setErroAfd(mensagemDe(causa, 'Falha ao exportar o AFD.'))
    } finally {
      setBaixandoAfd(false)
    }
  }

  // Espelho de outro montador/mês ainda na tela enquanto o novo carrega: não mostrar dados trocados.
  const espelhoAtual = espelho && String(espelho.usuarioId) === usuarioId && espelho.ano === ano && espelho.mes === mes ? espelho : null
  const faltas = espelhoAtual ? contarFaltas(espelhoAtual.dias, hoje) : 0

  return (
    <LayoutAutenticado
      itemAtivo="/espelho-ponto"
      titulo="Espelho de Ponto"
      complementoTitulo={
        <p className="flex items-center gap-8 text-label-md uppercase text-on-surface-variant">
          <SimboloMaterial nome="calendar_month" className="text-base" />
          {nomeDoMes(mes)} {ano}
        </p>
      }
    >
      <div className="space-y-32">
        <div className="grid gap-24 lg:grid-cols-3 print:hidden">
          <FiltroEspelho
            key={`${usuarioId ?? ''}-${ano}-${mes}`}
            montadores={montadores}
            montadorInicial={usuarioId ?? ''}
            competenciaInicial={competenciaParaTexto(ano, mes)}
            aoVisualizar={aoVisualizar}
          />
          <div className="flex flex-col gap-24">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!espelhoAtual}
              className="flex flex-1 items-center gap-16 rounded-xl bg-surface-container-lowest p-24 text-left shadow-elev1 transition-shadow hover:shadow-elev3 disabled:opacity-40"
            >
              <span className="flex h-48 w-48 items-center justify-center rounded-lg bg-error-container text-error">
                <SimboloMaterial nome="picture_as_pdf" className="text-2xl" />
              </span>
              <span className="text-title-md uppercase text-on-surface">Exportar PDF</span>
            </button>
            <button
              type="button"
              onClick={() => void aoExportarAfd()}
              disabled={!espelhoAtual || baixandoAfd}
              className="flex flex-1 items-center gap-16 rounded-xl bg-surface-container-lowest p-24 text-left shadow-elev1 transition-shadow hover:shadow-elev3 disabled:opacity-40"
            >
              <span className="flex h-48 w-48 items-center justify-center rounded-lg bg-primary-fixed text-primary">
                <SimboloMaterial nome="database" className="text-2xl" />
              </span>
              <span className="text-title-md uppercase text-on-surface">
                {baixandoAfd ? 'Exportando…' : 'Exportar AFD'}
              </span>
            </button>
          </div>
        </div>

        {erroAfd && (
          <div className="space-y-8">
            <Alerta variante="erro" mensagem={erroAfd} />
            <Link to="/montadores" className="text-body-md font-bold text-primary underline">
              Ir para Montadores
            </Link>
          </div>
        )}

        {erro && <Alerta variante="erro" mensagem={erro} />}

        {!usuarioId && (
          <p className="rounded-xl bg-surface-container-low p-32 text-center text-body-md text-on-surface-variant">
            Selecione um montador e o mês de referência.
          </p>
        )}

        {espelhoAtual && (
          <>
            {/* Cabeçalho só do PDF: o cabeçalho da página é print:hidden. */}
            <p className="hidden text-title-lg print:block">
              Espelho de Ponto — {espelhoAtual.usuarioNome} — {nomeDoMes(espelhoAtual.mes)} {espelhoAtual.ano}
            </p>
            <section className="space-y-16">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-12 text-title-lg text-on-surface">
                  <span aria-hidden="true" className="h-24 w-4 rounded-full bg-primary" />
                  Detalhamento Mensal — {espelhoAtual.usuarioNome}
                </h2>
                {faltas > 0 && (
                  <BadgeStatus variante="erro" texto={`${faltas} ${faltas === 1 ? 'falta identificada' : 'faltas identificadas'}`} />
                )}
              </div>
              <TabelaEspelho dias={espelhoAtual.dias} hoje={hoje} />
              <div className="flex items-center justify-end gap-32 rounded-xl bg-surface-container-high px-24 py-24">
                <span className="text-label-lg uppercase text-on-surface-variant">Total mensal acumulado:</span>
                <span className="text-headline-sm text-primary">{formatarMinutos(espelhoAtual.minutosTrabalhados)}</span>
              </div>
            </section>
            <div className="grid gap-24 sm:grid-cols-2 xl:grid-cols-4">
              <CartaoIndicador rotulo="Horas trabalhadas" valor={formatarMinutos(espelhoAtual.minutosTrabalhados)} />
              <CartaoIndicador
                rotulo="Banco de horas"
                valor={formatarMinutos(espelhoAtual.saldoMinutos, true)}
                complemento={espelhoAtual.saldoMinutos < 0 ? 'Débito' : 'Crédito'}
              />
              <CartaoIndicador tom="erro" rotulo="Total de faltas" valor={String(faltas).padStart(2, '0')} complemento="Dias ausentes" />
              <CartaoIndicador tom="alerta" rotulo="Horas abonadas" valor={formatarMinutos(espelhoAtual.minutosAbonados)} complemento="Horas" />
            </div>
          </>
        )}
      </div>
    </LayoutAutenticado>
  )
}
