import { useEffect, useState } from 'react'
import type {
  ClienteResumoDTO,
  CriarPedidoRequest,
  EquipeDTO,
  MontadorResumoDTO,
  PedidoResumoDTO,
  UsuarioDTO,
} from '@montacontrol/shared'
import { ErroApi } from '../api/clienteHttp'
import { listarClientes } from '../api/clientes'
import { listarEquipes } from '../api/equipes'
import {
  atribuirMontadoresAoPedido,
  criarPedido,
  listarMontadoresDoPedido,
  listarPedidos,
} from '../api/pedidos'
import { listarUsuarios } from '../api/usuarios'
import { useAuth } from '../auth/AuthContext'
import { montadoresDisponiveis, textoQuantidadeMontadores } from '../formatacao/equipes'
import { progressoDoPedido } from '../formatacao/pedidos'
import { Alerta } from '../ui/Alerta'
import { BadgeStatus } from '../ui/BadgeStatus'
import { Botao } from '../ui/Botao'
import { CartaoIndicador } from '../ui/CartaoIndicador'
import { TabelaDados, type ColunaTabela } from '../ui/TabelaDados'
import { LayoutAutenticado } from './LayoutAutenticado'
import { ModalMontadoresPedido } from './pedidos/ModalMontadoresPedido'
import { ModalNovoPedido } from './pedidos/ModalNovoPedido'

const mensagemDe = (causa: unknown, padrao: string) =>
  causa instanceof ErroApi ? causa.message : padrao

interface AtribuicaoAberta {
  pedido: PedidoResumoDTO
  atribuidos: MontadorResumoDTO[]
}

/** Cadastro de pedidos pelo gestor: cliente da obra, ambientes, peças planejadas e montadores da obra. */
export default function Pedidos() {
  const { sessao } = useAuth()
  const token = sessao?.accessToken ?? ''
  const [pedidos, setPedidos] = useState<PedidoResumoDTO[]>([])
  const [clientes, setClientes] = useState<ClienteResumoDTO[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [equipes, setEquipes] = useState<EquipeDTO[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioDTO[]>([])
  const [atribuicao, setAtribuicao] = useState<AtribuicaoAberta | null>(null)
  const [erroAtribuicao, setErroAtribuicao] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    Promise.all([listarPedidos(token), listarClientes(token), listarEquipes(token), listarUsuarios(token)])
      .then(([listaPedidos, listaClientes, listaEquipes, listaUsuarios]) => {
        if (!ativo) return
        setPedidos(listaPedidos)
        setClientes(listaClientes)
        setEquipes(listaEquipes)
        setUsuarios(listaUsuarios)
      })
      .catch((causa: unknown) => {
        if (ativo) setErro(mensagemDe(causa, 'Falha ao carregar pedidos.'))
      })
    return () => {
      ativo = false
    }
  }, [token])

  async function aoCadastrar(dados: CriarPedidoRequest) {
    setErro(null)
    setAviso(null)
    try {
      const criado = await criarPedido(token, dados)
      setPedidos(await listarPedidos(token))
      setModalAberto(false)
      setAviso(`Pedido ${criado.numeroPedido} cadastrado.`)
    } catch (causa: unknown) {
      setErro(mensagemDe(causa, 'Falha ao cadastrar pedido.'))
      throw causa
    }
  }

  async function abrirAtribuicao(pedido: PedidoResumoDTO) {
    setErro(null)
    setAviso(null)
    setErroAtribuicao(null)
    try {
      setAtribuicao({ pedido, atribuidos: await listarMontadoresDoPedido(token, pedido.id) })
    } catch (causa: unknown) {
      setErro(mensagemDe(causa, 'Falha ao carregar os montadores do pedido.'))
    }
  }

  async function aoSalvarAtribuicao(usuarioIds: number[]) {
    if (!atribuicao) return
    setErroAtribuicao(null)
    try {
      const atribuidos = await atribuirMontadoresAoPedido(token, atribuicao.pedido.id, usuarioIds)
      setPedidos((atuais) =>
        atuais.map((pedido) =>
          pedido.id === atribuicao.pedido.id ? { ...pedido, quantidadeMontadores: atribuidos.length } : pedido,
        ),
      )
      setAviso(`${atribuicao.pedido.numeroPedido}: ${textoQuantidadeMontadores(atribuidos.length).toLowerCase()} na obra.`)
      setAtribuicao(null)
    } catch (causa: unknown) {
      setErroAtribuicao(mensagemDe(causa, 'Falha ao salvar os montadores.'))
      throw causa
    }
  }

  const pecasPlanejadas = pedidos.reduce((total, pedido) => total + pedido.quantidadeTotal, 0)
  const aguardandoTriagem = pedidos.filter((pedido) => pedido.quantidadeTriada === 0).length

  const colunas: ColunaTabela<PedidoResumoDTO>[] = [
    {
      titulo: 'Pedido',
      ordenacao: { tipo: 'texto', valor: (pedido) => pedido.numeroPedido },
      render: (pedido) => <span className="text-title-sm text-on-surface">{pedido.numeroPedido}</span>,
    },
    { titulo: 'Cliente (local da obra)', ordenacao: { tipo: 'texto', valor: (pedido) => pedido.clienteNome }, render: (pedido) => pedido.clienteNome },
    {
      titulo: 'Status',
      ordenacao: { tipo: 'texto', valor: (pedido) => pedido.status },
      render: (pedido) => <BadgeStatus variante="neutro" texto={pedido.status} />,
    },
    {
      titulo: 'Peças bipadas',
      alinhamento: 'direita',
      // Pela fração já bipada: pedido sem peças conta como 0.
      ordenacao: {
        tipo: 'numero',
        valor: (pedido) => (pedido.quantidadeTotal ? pedido.quantidadeTriada / pedido.quantidadeTotal : 0),
      },
      render: (pedido) => <span className="whitespace-nowrap">{progressoDoPedido(pedido)}</span>,
    },
    {
      titulo: 'Montadores',
      alinhamento: 'direita',
      ordenacao: { tipo: 'numero', valor: (pedido) => pedido.quantidadeMontadores },
      render: (pedido) => (
        <Botao
          variante="tonal"
          tamanho={40}
          forma="pilula"
          icone="groups"
          texto={textoQuantidadeMontadores(pedido.quantidadeMontadores)}
          aoPressionar={() => void abrirAtribuicao(pedido)}
        />
      ),
    },
  ]

  return (
    <LayoutAutenticado
      itemAtivo="/pedidos"
      titulo="Pedidos"
      complementoTitulo={
        <p className="hidden text-label-md uppercase text-on-surface-variant md:block">
          Gestão <span aria-hidden="true">›</span> Cadastro de Pedidos
        </p>
      }
    >
      <div className="space-y-32">
        <div className="flex flex-wrap items-center justify-end gap-16">
          <Botao
            variante="primario"
            tamanho={48}
            forma="pilula"
            icone="add"
            texto="Novo Pedido"
            aoPressionar={() => {
              setErro(null)
              setAviso(null)
              setModalAberto(true)
            }}
          />
        </div>

        {erro && <Alerta variante="erro" mensagem={erro} />}
        {aviso && <Alerta variante="sucesso" mensagem={aviso} />}

        <div className="grid gap-24 md:grid-cols-3">
          <CartaoIndicador icone="event_note" rotulo="Pedidos" valor={String(pedidos.length)} />
          <CartaoIndicador
            icone="conveyor_belt"
            tom="alerta"
            rotulo="Sem triagem iniciada"
            valor={String(aguardandoTriagem)}
          />
          <CartaoIndicador
            tom="destaque"
            rotulo="Peças planejadas"
            valor={String(pecasPlanejadas)}
            complemento="no total"
          />
        </div>

        <TabelaDados
          rotulo="Pedidos"
          colunas={colunas}
          linhas={pedidos}
          chave={(pedido) => pedido.id}
          vazio="Nenhum pedido cadastrado."
        />
      </div>

      {modalAberto && (
        <ModalNovoPedido
          visivel={modalAberto}
          clientes={clientes}
          erro={erro}
          aoFechar={() => {
            setModalAberto(false)
            setErro(null)
          }}
          aoCadastrar={aoCadastrar}
        />
      )}

      {atribuicao && (
        <ModalMontadoresPedido
          numeroPedido={atribuicao.pedido.numeroPedido}
          atribuidos={atribuicao.atribuidos}
          montadores={montadoresDisponiveis(usuarios)}
          equipes={equipes}
          erro={erroAtribuicao}
          aoFechar={() => setAtribuicao(null)}
          aoSalvar={aoSalvarAtribuicao}
        />
      )}
    </LayoutAutenticado>
  )
}
