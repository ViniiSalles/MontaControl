import { useEffect, useRef, useState } from 'react'
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
import { formatarDataHoraCurta } from '../formatacao/datas'
import { Alerta } from '../ui/Alerta'
import { Avatar } from '../ui/Avatar'
import { BadgeStatus } from '../ui/BadgeStatus'
import { CampoTexto } from '../ui/CampoTexto'
import { SimboloMaterial } from '../ui/SimboloMaterial'
import { TabelaDados, type ColunaTabela } from '../ui/TabelaDados'
import { LayoutAutenticado } from './LayoutAutenticado'
import { PainelAtestado, ROTULO_STATUS, VARIANTE_STATUS, textoPeriodo } from './atestados/PainelAtestado'

const mensagemDe = (causa: unknown, padrao: string) => (causa instanceof ErroApi ? causa.message : padrao)

/** US13/UC18 — fila e histórico de atestados do RH (`gest_o_de_atestados`). */
export default function Atestados() {
  const { sessao } = useAuth()
  const token = sessao?.accessToken ?? ''
  const [pendentes, setPendentes] = useState<AtestadoDTO[]>([])
  const [historico, setHistorico] = useState<AtestadoDTO[]>([])
  const [busca, setBusca] = useState('')
  const [detalhe, setDetalhe] = useState<AtestadoDetalhadoDTO | null>(null)
  const [motivo, setMotivo] = useState('')
  const [erroMotivo, setErroMotivo] = useState<string | undefined>()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [recarregar, setRecarregar] = useState(0)
  /** Guarda contra corrida: só a resposta da seleção mais recente pode atualizar `detalhe`/`erro`. */
  const idRequisicaoRef = useRef(0)

  useEffect(() => {
    let ativo = true
    Promise.all([listarAtestadosPendentes(token), listarHistoricoAtestados(token)])
      .then(([filaPendente, jaAnalisados]) => {
        if (!ativo) return
        setPendentes(filaPendente)
        setHistorico(jaAnalisados)
      })
      .catch((causa: unknown) => {
        if (ativo) setErro(mensagemDe(causa, 'Falha ao carregar os atestados.'))
      })
    return () => {
      ativo = false
    }
  }, [token, recarregar])

  const termo = busca.trim().toLowerCase()
  const linhas = [...pendentes, ...historico].filter((atestado) => atestado.usuarioNome.toLowerCase().includes(termo))

  async function aoSelecionar(atestado: AtestadoDTO) {
    // Uma aprovação/recusa em andamento não pode ser interrompida por uma
    // nova seleção — a tabela continua navegável, o clique só é ignorado.
    if (enviando) return
    const idRequisicao = ++idRequisicaoRef.current
    setErro(null)
    setAviso(null)
    setMotivo('')
    setErroMotivo(undefined)
    try {
      const detalhado = await detalharAtestado(token, atestado.id)
      // Só aplica se ainda for a seleção mais recente — evita que uma
      // resposta antiga (A) sobrescreva uma seleção mais nova (B).
      if (idRequisicaoRef.current === idRequisicao) setDetalhe(detalhado)
    } catch (causa: unknown) {
      if (idRequisicaoRef.current === idRequisicao) setErro(mensagemDe(causa, 'Falha ao abrir o atestado.'))
    }
  }

  function aoFechar() {
    if (enviando) return
    idRequisicaoRef.current++
    setDetalhe(null)
  }

  function concluir(mensagem: string) {
    setAviso(mensagem)
    setDetalhe(null)
    setMotivo('')
    setRecarregar((valor) => valor + 1)
  }

  async function aoAprovar() {
    if (!detalhe) return
    setEnviando(true)
    try {
      await validarAtestado(token, detalhe.id)
      concluir(`Atestado de ${detalhe.usuarioNome} aprovado.`)
    } catch (causa: unknown) {
      setErro(mensagemDe(causa, 'Falha ao aprovar o atestado.'))
    } finally {
      setEnviando(false)
    }
  }

  async function aoRecusar() {
    if (!detalhe) return
    if (!motivo.trim()) {
      setErroMotivo('Informe o motivo para recusar.')
      return
    }
    setEnviando(true)
    try {
      await rejeitarAtestado(token, detalhe.id, motivo.trim())
      concluir(`Atestado de ${detalhe.usuarioNome} recusado.`)
    } catch (causa: unknown) {
      setErro(mensagemDe(causa, 'Falha ao recusar o atestado.'))
    } finally {
      setEnviando(false)
    }
  }

  const colunas: ColunaTabela<AtestadoDTO>[] = [
    {
      titulo: 'Montador',
      render: (atestado) => (
        <div className="flex items-center gap-12">
          <Avatar nome={atestado.usuarioNome} />
          <span className="text-title-sm">{atestado.usuarioNome}</span>
        </div>
      ),
    },
    { titulo: 'Data de envio', render: (atestado) => formatarDataHoraCurta(atestado.criadoEm) },
    { titulo: 'Período', render: (atestado) => textoPeriodo(atestado.dataInicio, atestado.dataFim) },
    {
      titulo: 'Status',
      render: (atestado) => <BadgeStatus variante={VARIANTE_STATUS[atestado.status]} texto={ROTULO_STATUS[atestado.status]} />,
    },
    {
      titulo: 'Ações',
      alinhamento: 'direita',
      render: (atestado) => (
        <SimboloMaterial
          nome="chevron_right"
          className={['text-2xl', atestado.status === StatusAtestado.PENDENTE ? 'text-primary' : 'text-outline'].join(' ')}
        />
      ),
    },
  ]

  return (
    <LayoutAutenticado
      itemAtivo="/atestados"
      titulo="Atestados"
      complementoTitulo={
        pendentes.length > 0 ? (
          <BadgeStatus variante="aviso" texto={`${pendentes.length} ${pendentes.length === 1 ? 'pendente' : 'pendentes'}`} />
        ) : undefined
      }
    >
      <div className="flex flex-col gap-32 lg:flex-row lg:items-start">
        <section className="min-w-0 flex-1 space-y-24">
          <div className="flex flex-wrap items-end justify-between gap-16">
            <div>
              <h2 className="text-headline-sm text-on-surface">Histórico de Submissões</h2>
              <p className="text-body-md text-on-surface-variant">Gerencie e valide as ausências justificadas dos montadores.</p>
            </div>
            <div className="w-full max-w-xs">
              <CampoTexto rotulo="Buscar montador" iconeEsquerda="search" placeholder="Filtrar por nome…" valor={busca} aoAlterar={setBusca} />
            </div>
          </div>
          {erro && <Alerta variante="erro" mensagem={erro} />}
          {aviso && <Alerta variante="sucesso" mensagem={aviso} />}
          <TabelaDados
            rotulo="Atestados"
            colunas={colunas}
            linhas={linhas}
            chave={(atestado) => atestado.id}
            selecionada={detalhe?.id ?? null}
            aoSelecionar={(atestado) => void aoSelecionar(atestado)}
            vazio={pendentes.length + historico.length === 0 ? 'Nenhum atestado enviado ainda.' : 'Nenhum montador encontrado para a busca.'}
          />
        </section>

        <PainelAtestado
          atestado={detalhe}
          motivo={motivo}
          erroMotivo={erroMotivo}
          aoAlterarMotivo={(valor) => {
            setMotivo(valor)
            setErroMotivo(undefined)
          }}
          aoAprovar={() => void aoAprovar()}
          aoRecusar={() => void aoRecusar()}
          aoFechar={aoFechar}
          enviando={enviando}
        />
      </div>
    </LayoutAutenticado>
  )
}
