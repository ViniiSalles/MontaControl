import { useEffect, useRef, useState } from 'react'
import { StatusAvaria } from '@montacontrol/shared'
import type { AvariaDTO, AvariaDetalhadaDTO, TipoAvariaDTO } from '@montacontrol/shared'
import { useAuth } from '../auth/AuthContext'
import { ErroApi } from '../api/clienteHttp'
import { atualizarStatusAvaria, detalharAvaria, listarAvarias, listarTiposAvaria } from '../api/avarias'
import {
  contarAbertas,
  contarPorStatus,
  FILTRO_VAZIO,
  filtrarAvarias,
  ORDEM_STATUS_AVARIA,
  ROTULO_ORIGEM,
  ROTULO_STATUS_AVARIA,
  VARIANTE_STATUS_AVARIA,
  type AcaoAvaria,
  type FiltroTelaAvarias,
} from '../formatacao/avarias'
import { formatarDataHoraCurta } from '../formatacao/datas'
import { Alerta } from '../ui/Alerta'
import { BadgeStatus } from '../ui/BadgeStatus'
import { CartaoIndicador } from '../ui/CartaoIndicador'
import { SimboloMaterial } from '../ui/SimboloMaterial'
import { TabelaDados, type ColunaTabela } from '../ui/TabelaDados'
import { LayoutAutenticado } from './LayoutAutenticado'
import { FiltrosAvarias } from './avarias/FiltrosAvarias'
import { PainelAvaria } from './avarias/PainelAvaria'

const mensagemDe = (causa: unknown, padrao: string) => (causa instanceof ErroApi ? causa.message : padrao)

const colunas: ColunaTabela<AvariaDTO>[] = [
  {
    titulo: 'Peça',
    ordenacao: { tipo: 'texto', valor: (avaria) => avaria.descricaoPeca },
    render: (avaria) => (
      <div>
        <p className="text-title-sm text-on-surface">{avaria.descricaoPeca}</p>
        <p className="text-body-sm text-on-surface-variant">
          {avaria.numeroPedido} · {avaria.ambiente}
        </p>
      </div>
    ),
  },
  { titulo: 'Problema', ordenacao: { tipo: 'texto', valor: (avaria) => avaria.tipoAvaria }, render: (avaria) => avaria.tipoAvaria },
  {
    titulo: 'Reportada por',
    ordenacao: { tipo: 'texto', valor: (avaria) => avaria.registradaPorNome },
    render: (avaria) => (
      <div>
        <p className="text-body-md text-on-surface">{avaria.registradaPorNome}</p>
        <p className="text-body-sm text-on-surface-variant">{ROTULO_ORIGEM[avaria.registradaPorPerfil]}</p>
      </div>
    ),
  },
  { titulo: 'Data', ordenacao: { tipo: 'data', valor: (avaria) => avaria.criadoEm }, render: (avaria) => formatarDataHoraCurta(avaria.criadoEm) },
  {
    titulo: 'Status',
    // Ordem do fluxo de análise, não alfabética.
    ordenacao: { tipo: 'numero', valor: (avaria) => ORDEM_STATUS_AVARIA.indexOf(avaria.status) },
    render: (avaria) => (
      <BadgeStatus variante={VARIANTE_STATUS_AVARIA[avaria.status]} texto={ROTULO_STATUS_AVARIA[avaria.status]} />
    ),
  },
  {
    titulo: 'Ações',
    alinhamento: 'direita',
    render: (avaria) => (
      <SimboloMaterial
        nome="chevron_right"
        className={['text-2xl', avaria.status === StatusAvaria.RESOLVIDA ? 'text-outline' : 'text-primary'].join(' ')}
      />
    ),
  },
]

/** Análise de avarias pelo gestor: problemas com peças reportados pelo operador ou pelo montador. */
export default function Avarias() {
  const { sessao } = useAuth()
  const token = sessao?.accessToken ?? ''
  const [avarias, setAvarias] = useState<AvariaDTO[]>([])
  const [tipos, setTipos] = useState<TipoAvariaDTO[]>([])
  const [filtro, setFiltro] = useState<FiltroTelaAvarias>(FILTRO_VAZIO)
  const [detalhe, setDetalhe] = useState<AvariaDetalhadaDTO | null>(null)
  const [parecer, setParecer] = useState('')
  const [erroParecer, setErroParecer] = useState<string | undefined>()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [recarregar, setRecarregar] = useState(0)
  /** Guarda contra corrida: só a resposta da seleção mais recente pode atualizar `detalhe`/`erro`. */
  const idRequisicaoRef = useRef(0)

  useEffect(() => {
    let ativo = true
    Promise.all([listarAvarias(token), listarTiposAvaria(token)])
      .then(([lista, listaTipos]) => {
        if (!ativo) return
        setAvarias(lista)
        setTipos(listaTipos)
      })
      .catch((causa: unknown) => {
        if (ativo) setErro(mensagemDe(causa, 'Falha ao carregar as avarias.'))
      })
    return () => {
      ativo = false
    }
  }, [token, recarregar])

  const linhas = filtrarAvarias(avarias, filtro)
  const abertas = contarAbertas(avarias)

  async function abrirDetalhe(id: number) {
    const idRequisicao = ++idRequisicaoRef.current
    try {
      const detalhado = await detalharAvaria(token, id)
      if (idRequisicaoRef.current === idRequisicao) setDetalhe(detalhado)
    } catch (causa: unknown) {
      if (idRequisicaoRef.current === idRequisicao) setErro(mensagemDe(causa, 'Falha ao abrir a avaria.'))
    }
  }

  function aoSelecionar(avaria: AvariaDTO) {
    // Uma decisão em andamento não pode ser interrompida por uma nova seleção.
    if (enviando) return
    setErro(null)
    setAviso(null)
    setParecer('')
    setErroParecer(undefined)
    void abrirDetalhe(avaria.id)
  }

  function aoFechar() {
    if (enviando) return
    idRequisicaoRef.current++
    setDetalhe(null)
  }

  async function aoExecutar(acao: AcaoAvaria) {
    if (!detalhe) return
    if (acao.exigeParecer && !parecer.trim()) {
      setErroParecer('Informe o parecer para concluir esta etapa.')
      return
    }
    setEnviando(true)
    setErro(null)
    try {
      await atualizarStatusAvaria(token, detalhe.id, acao.status, parecer.trim() || undefined)
      setAviso(`Avaria da peça ${detalhe.descricaoPeca} (${detalhe.numeroPedido}): ${ROTULO_STATUS_AVARIA[acao.status].toLowerCase()}.`)
      setParecer('')
      setRecarregar((valor) => valor + 1)
      // Mantém o painel aberto no novo status — o gestor costuma seguir para a próxima etapa.
      await abrirDetalhe(detalhe.id)
    } catch (causa: unknown) {
      setErro(mensagemDe(causa, 'Falha ao atualizar a avaria.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <LayoutAutenticado
      itemAtivo="/avarias"
      titulo="Avarias"
      complementoTitulo={
        abertas > 0 ? (
          <BadgeStatus variante="erro" texto={`${abertas} ${abertas === 1 ? 'aberta' : 'abertas'}`} />
        ) : undefined
      }
    >
      <div className="space-y-32">
        <div className="grid gap-24 md:grid-cols-3">
          <CartaoIndicador
            icone="report"
            tom="erro"
            rotulo="Aguardando análise"
            valor={String(contarPorStatus(avarias, StatusAvaria.REPORTADA))}
          />
          <CartaoIndicador
            icone="visibility"
            tom="alerta"
            rotulo="Em análise"
            valor={String(contarPorStatus(avarias, StatusAvaria.EM_ANALISE))}
          />
          <CartaoIndicador
            icone="sync"
            rotulo="Reposição solicitada"
            valor={String(contarPorStatus(avarias, StatusAvaria.REPOSICAO_SOLICITADA))}
          />
        </div>

        <div className="flex flex-col gap-32 lg:flex-row lg:items-start">
          <section className="min-w-0 flex-1 space-y-24">
            <div>
              <h2 className="text-headline-sm text-on-surface">Problemas com peças</h2>
              <p className="text-body-md text-on-surface-variant">
                Avarias, faltas e defeitos reportados pelo depósito e pelos montadores em campo.
              </p>
            </div>
            <FiltrosAvarias filtro={filtro} tipos={tipos} aoAlterar={setFiltro} />
            {erro && <Alerta variante="erro" mensagem={erro} />}
            {aviso && <Alerta variante="sucesso" mensagem={aviso} />}
            <TabelaDados
              rotulo="Avarias"
              colunas={colunas}
              linhas={linhas}
              chave={(avaria) => avaria.id}
              selecionada={detalhe?.id ?? null}
              aoSelecionar={aoSelecionar}
              vazio={avarias.length === 0 ? 'Nenhuma avaria reportada.' : 'Nenhuma avaria encontrada para o filtro.'}
            />
          </section>

          <PainelAvaria
            avaria={detalhe}
            parecer={parecer}
            erroParecer={erroParecer}
            aoAlterarParecer={(valor) => {
              setParecer(valor)
              setErroParecer(undefined)
            }}
            aoExecutar={(acao) => void aoExecutar(acao)}
            aoFechar={aoFechar}
            enviando={enviando}
          />
        </div>
      </div>
    </LayoutAutenticado>
  )
}
