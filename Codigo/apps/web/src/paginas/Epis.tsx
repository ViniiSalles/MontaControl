import { useEffect, useState } from 'react'
import type { AluguelEpiDTO, RegistrarAluguelEpiRequest, SalvarTipoEpiRequest, TipoEpiDTO, UsuarioDTO } from '@montacontrol/shared'
import { ErroApi } from '../api/clienteHttp'
import {
  atualizarTipoEpi,
  cancelarAluguelEpi,
  criarTipoEpi,
  listarAlugueisEpi,
  listarTiposEpi,
  registrarAluguelEpi,
  registrarDevolucaoEpi,
} from '../api/epis'
import { listarUsuarios } from '../api/usuarios'
import { useAuth } from '../auth/AuthContext'
import { formatarDataHoraCurta } from '../formatacao/datas'
import {
  colaboradoresParaEpi,
  contarPorStatus,
  filtrarAlugueis,
  ROTULO_STATUS_ALUGUEL,
  tempoDeAtraso,
  tempoEmUso,
  tempoReservado,
  VARIANTE_STATUS_ALUGUEL,
  type FiltroAluguel,
} from '../formatacao/epis'
import { Alerta } from '../ui/Alerta'
import { BadgeStatus } from '../ui/BadgeStatus'
import { Botao } from '../ui/Botao'
import { Modal } from '../ui/Modal'
import { SubAbas } from '../ui/SubAbas'
import { TabelaDados, type ColunaTabela } from '../ui/TabelaDados'
import { LayoutAutenticado } from './LayoutAutenticado'
import { ModalAluguelEpi } from './epis/ModalAluguelEpi'
import { ModalDevolucaoEpi } from './epis/ModalDevolucaoEpi'
import { ModalTipoEpi } from './epis/ModalTipoEpi'

const mensagemDe = (causa: unknown, padrao: string) => (causa instanceof ErroApi ? causa.message : padrao)

type Aba = 'alugueis' | 'catalogo'

/** `undefined` = modal fechado; `null` = criando; tipo = editando. */
type EdicaoTipo = TipoEpiDTO | null | undefined

/**
 * Aluguel de EPIs do almoxarifado. O gestor registra a reserva (EPI,
 * colaborador, início e devolução prevista) e a devolução real; a tela mostra
 * o tempo reservado, o tempo em uso e o atraso de cada aluguel.
 */
export default function Epis() {
  const { sessao } = useAuth()
  const token = sessao?.accessToken ?? ''
  const [aba, setAba] = useState<Aba>('alugueis')
  const [filtro, setFiltro] = useState<FiltroAluguel>('ABERTOS')
  const [alugueis, setAlugueis] = useState<AluguelEpiDTO[]>([])
  const [tipos, setTipos] = useState<TipoEpiDTO[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioDTO[]>([])
  /** Referência dos tempos "em uso"/"atraso" — renova a cada recarga, não a cada render. */
  const [agora, setAgora] = useState(() => new Date())
  const [novoAluguel, setNovoAluguel] = useState(false)
  const [devolvendo, setDevolvendo] = useState<AluguelEpiDTO | null>(null)
  const [cancelando, setCancelando] = useState<AluguelEpiDTO | null>(null)
  const [edicaoTipo, setEdicaoTipo] = useState<EdicaoTipo>(undefined)
  const [erro, setErro] = useState<string | null>(null)
  const [erroModal, setErroModal] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    Promise.all([listarAlugueisEpi(token), listarTiposEpi(token), listarUsuarios(token)])
      .then(([listaAlugueis, listaTipos, listaUsuarios]) => {
        if (!ativo) return
        setAlugueis(listaAlugueis)
        setTipos(listaTipos)
        setUsuarios(listaUsuarios)
        setAgora(new Date())
      })
      .catch((causa: unknown) => {
        if (ativo) setErro(mensagemDe(causa, 'Falha ao carregar os EPIs.'))
      })
    return () => {
      ativo = false
    }
  }, [token])

  const colaboradores = colaboradoresParaEpi(usuarios)
  const linhas = filtrarAlugueis(alugueis, filtro)

  function limparMensagens() {
    setErro(null)
    setAviso(null)
    setErroModal(null)
  }

  /** Aluguel mexe no "em uso" do catálogo — recarrega os dois juntos. */
  async function recarregar() {
    const [listaAlugueis, listaTipos] = await Promise.all([listarAlugueisEpi(token), listarTiposEpi(token)])
    setAlugueis(listaAlugueis)
    setTipos(listaTipos)
    setAgora(new Date())
  }

  async function aoRegistrarAluguel(dados: RegistrarAluguelEpiRequest) {
    setErroModal(null)
    try {
      const registrado = await registrarAluguelEpi(token, dados)
      await recarregar()
      setAviso(`Aluguel de ${registrado.tipoEpi.nome} para ${registrado.colaborador.nome} registrado.`)
      setNovoAluguel(false)
    } catch (causa: unknown) {
      setErroModal(mensagemDe(causa, 'Falha ao registrar o aluguel.'))
      throw causa
    }
  }

  async function aoRegistrarDevolucao(devolvidoEm: string) {
    if (!devolvendo) return
    setErroModal(null)
    try {
      await registrarDevolucaoEpi(token, devolvendo.id, { devolvidoEm })
      await recarregar()
      setAviso(`Devolução de ${devolvendo.tipoEpi.nome} por ${devolvendo.colaborador.nome} registrada.`)
      setDevolvendo(null)
    } catch (causa: unknown) {
      setErroModal(mensagemDe(causa, 'Falha ao registrar a devolução.'))
      throw causa
    }
  }

  async function aoConfirmarCancelamento() {
    if (!cancelando) return
    try {
      await cancelarAluguelEpi(token, cancelando.id)
      await recarregar()
      setAviso(`Reserva de ${cancelando.tipoEpi.nome} cancelada.`)
    } catch (causa: unknown) {
      setErro(mensagemDe(causa, 'Falha ao cancelar a reserva.'))
    } finally {
      setCancelando(null)
    }
  }

  async function aoSalvarTipo(dados: SalvarTipoEpiRequest) {
    setErroModal(null)
    try {
      const salvo = edicaoTipo ? await atualizarTipoEpi(token, edicaoTipo.id, dados) : await criarTipoEpi(token, dados)
      setTipos(await listarTiposEpi(token))
      setAviso(`EPI ${salvo.nome} salvo.`)
      setEdicaoTipo(undefined)
    } catch (causa: unknown) {
      setErroModal(mensagemDe(causa, 'Falha ao salvar o EPI.'))
      throw causa
    }
  }

  const colunasAlugueis: ColunaTabela<AluguelEpiDTO>[] = [
    {
      titulo: 'EPI',
      ordenacao: { tipo: 'texto', valor: (aluguel) => aluguel.tipoEpi.nome },
      render: (aluguel) => (
        <div>
          <p className="text-title-sm text-on-surface">{aluguel.tipoEpi.nome}</p>
          <p className="text-body-sm text-on-surface-variant">{aluguel.quantidade} unidade(s)</p>
        </div>
      ),
    },
    {
      titulo: 'Colaborador',
      ordenacao: { tipo: 'texto', valor: (aluguel) => aluguel.colaborador.nome },
      render: (aluguel) => <span className="text-body-md text-on-surface">{aluguel.colaborador.nome}</span>,
    },
    {
      titulo: 'Reserva',
      ordenacao: { tipo: 'data', valor: (aluguel) => aluguel.inicio },
      render: (aluguel) => (
        <div>
          <p className="text-body-md text-on-surface">
            {formatarDataHoraCurta(aluguel.inicio)} → {formatarDataHoraCurta(aluguel.fimPrevisto)}
          </p>
          <p className="text-body-sm text-on-surface-variant">
            {tempoReservado(aluguel)} reservado · por {aluguel.registradoPor.nome}
          </p>
        </div>
      ),
    },
    {
      titulo: 'Devolução',
      render: (aluguel) => {
        const emUso = tempoEmUso(aluguel, agora)
        const atraso = tempoDeAtraso(aluguel, agora)
        return (
          <div>
            <p className="text-body-md text-on-surface">
              {aluguel.devolvidoEm ? formatarDataHoraCurta(aluguel.devolvidoEm) : '—'}
            </p>
            {emUso && (
              <p className="text-body-sm text-on-surface-variant">
                {emUso} em uso
                {atraso && <span className="text-error"> · {atraso} de atraso</span>}
              </p>
            )}
          </div>
        )
      },
    },
    {
      titulo: 'Status',
      render: (aluguel) => (
        <BadgeStatus variante={VARIANTE_STATUS_ALUGUEL[aluguel.status]} texto={ROTULO_STATUS_ALUGUEL[aluguel.status]} />
      ),
    },
    {
      titulo: 'Ações',
      alinhamento: 'direita',
      render: (aluguel) => {
        if (aluguel.status === 'RESERVADO') {
          return (
            <Botao
              variante="fantasma"
              tamanho={40}
              forma="pilula"
              texto="Cancelar"
              aoPressionar={() => {
                limparMensagens()
                setCancelando(aluguel)
              }}
            />
          )
        }
        if (aluguel.status === 'DEVOLVIDO') return null
        return (
          <Botao
            variante="tonal"
            tamanho={40}
            forma="pilula"
            texto="Registrar devolução"
            aoPressionar={() => {
              limparMensagens()
              setDevolvendo(aluguel)
            }}
          />
        )
      },
    },
  ]

  const colunasTipos: ColunaTabela<TipoEpiDTO>[] = [
    {
      titulo: 'EPI',
      ordenacao: { tipo: 'texto', valor: (tipo) => tipo.nome },
      render: (tipo) => (
        <div>
          <p className="text-title-sm text-on-surface">{tipo.nome}</p>
          {tipo.descricao && <p className="text-body-sm text-on-surface-variant">{tipo.descricao}</p>}
        </div>
      ),
    },
    {
      titulo: 'Estoque',
      alinhamento: 'direita',
      ordenacao: { tipo: 'numero', valor: (tipo) => tipo.estoque },
      render: (tipo) => <span className="text-body-md text-on-surface">{tipo.estoque}</span>,
    },
    {
      titulo: 'Em uso agora',
      alinhamento: 'direita',
      ordenacao: { tipo: 'numero', valor: (tipo) => tipo.emUso },
      render: (tipo) => <span className="text-body-md text-on-surface">{tipo.emUso}</span>,
    },
    {
      titulo: 'Livres agora',
      alinhamento: 'direita',
      ordenacao: { tipo: 'numero', valor: (tipo) => tipo.estoque - tipo.emUso },
      render: (tipo) => <span className="text-title-sm text-on-surface">{tipo.estoque - tipo.emUso}</span>,
    },
    {
      titulo: 'Ações',
      alinhamento: 'direita',
      render: (tipo) => (
        <Botao
          variante="tonal"
          tamanho={40}
          forma="pilula"
          texto="Editar"
          aoPressionar={() => {
            limparMensagens()
            setEdicaoTipo(tipo)
          }}
        />
      ),
    },
  ]

  return (
    <LayoutAutenticado itemAtivo="/epis" titulo="Aluguel de EPIs">
      <div className="space-y-24">
        <div className="flex flex-wrap items-end justify-between gap-16">
          <SubAbas<Aba>
            abas={[
              { id: 'alugueis', rotulo: 'Aluguéis', contador: contarPorStatus(alugueis, 'ATRASADO') },
              { id: 'catalogo', rotulo: 'Catálogo de EPIs' },
            ]}
            ativa={aba}
            aoMudar={setAba}
          />
          {aba === 'alugueis' ? (
            <Botao
              variante="primario"
              tamanho={48}
              forma="pilula"
              icone="add"
              texto="Novo aluguel"
              desabilitado={tipos.length === 0}
              aoPressionar={() => {
                limparMensagens()
                setNovoAluguel(true)
              }}
            />
          ) : (
            <Botao
              variante="primario"
              tamanho={48}
              forma="pilula"
              icone="add"
              texto="Novo EPI"
              aoPressionar={() => {
                limparMensagens()
                setEdicaoTipo(null)
              }}
            />
          )}
        </div>

        {erro && <Alerta variante="erro" mensagem={erro} />}
        {aviso && <Alerta variante="sucesso" mensagem={aviso} />}

        {aba === 'alugueis' ? (
          <>
            <SubAbas<FiltroAluguel>
              abas={[
                { id: 'ABERTOS', rotulo: 'Em aberto' },
                { id: 'RESERVADO', rotulo: 'Reservados' },
                { id: 'EM_USO', rotulo: 'Em uso' },
                { id: 'ATRASADO', rotulo: 'Atrasados', contador: contarPorStatus(alugueis, 'ATRASADO') },
                { id: 'DEVOLVIDO', rotulo: 'Devolvidos' },
                { id: 'TODOS', rotulo: 'Todos' },
              ]}
              ativa={filtro}
              aoMudar={setFiltro}
            />
            <TabelaDados
              rotulo="Aluguéis de EPI"
              colunas={colunasAlugueis}
              linhas={linhas}
              chave={(aluguel) => aluguel.id}
              classeLinha={(aluguel) => (aluguel.status === 'ATRASADO' ? 'border-l-4 border-error bg-error-container/20' : '')}
              vazio={
                tipos.length === 0
                  ? 'Cadastre os EPIs no catálogo antes de registrar aluguéis.'
                  : 'Nenhum aluguel nesta situação.'
              }
            />
          </>
        ) : (
          <TabelaDados
            rotulo="Catálogo de EPIs"
            colunas={colunasTipos}
            linhas={tipos}
            chave={(tipo) => tipo.id}
            vazio="Nenhum EPI cadastrado."
          />
        )}
      </div>

      {novoAluguel && (
        <ModalAluguelEpi
          tipos={tipos}
          colaboradores={colaboradores}
          erro={erroModal}
          aoFechar={() => setNovoAluguel(false)}
          aoSalvar={aoRegistrarAluguel}
        />
      )}

      {devolvendo && (
        <ModalDevolucaoEpi
          aluguel={devolvendo}
          erro={erroModal}
          aoFechar={() => setDevolvendo(null)}
          aoConfirmar={aoRegistrarDevolucao}
        />
      )}

      {edicaoTipo !== undefined && (
        <ModalTipoEpi tipo={edicaoTipo} erro={erroModal} aoFechar={() => setEdicaoTipo(undefined)} aoSalvar={aoSalvarTipo} />
      )}

      <Modal
        visivel={cancelando !== null}
        apresentacao="centro"
        titulo="Cancelar reserva"
        aoFechar={() => setCancelando(null)}
        acoes={[
          { texto: 'Voltar', variante: 'fantasma', aoPressionar: () => setCancelando(null) },
          { texto: 'Cancelar reserva', aoPressionar: () => void aoConfirmarCancelamento() },
        ]}
        conteudo={
          <p className="text-body-md text-on-surface">
            Cancelar a reserva de <strong>{cancelando?.tipoEpi.nome}</strong> para {cancelando?.colaborador.nome}? As
            unidades voltam a ficar livres no período.
          </p>
        }
      />
    </LayoutAutenticado>
  )
}
