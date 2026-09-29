import { useEffect, useState } from 'react'
import type { ClienteResumoDTO, CriarPedidoRequest, PedidoResumoDTO } from '@montacontrol/shared'
import { ErroApi } from '../api/clienteHttp'
import { listarClientes } from '../api/clientes'
import { criarPedido, listarPedidos } from '../api/pedidos'
import { useAuth } from '../auth/AuthContext'
import { progressoDoPedido } from '../formatacao/pedidos'
import { Alerta } from '../ui/Alerta'
import { BadgeStatus } from '../ui/BadgeStatus'
import { Botao } from '../ui/Botao'
import { CartaoIndicador } from '../ui/CartaoIndicador'
import { TabelaDados, type ColunaTabela } from '../ui/TabelaDados'
import { LayoutAutenticado } from './LayoutAutenticado'
import { ModalNovoPedido } from './pedidos/ModalNovoPedido'

const mensagemDe = (causa: unknown, padrao: string) =>
  causa instanceof ErroApi ? causa.message : padrao

/** Cadastro de pedidos pelo gestor: cliente da obra, ambientes e peças planejadas. */
export default function Pedidos() {
  const { sessao } = useAuth()
  const token = sessao?.accessToken ?? ''
  const [pedidos, setPedidos] = useState<PedidoResumoDTO[]>([])
  const [clientes, setClientes] = useState<ClienteResumoDTO[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    Promise.all([listarPedidos(token), listarClientes(token)])
      .then(([listaPedidos, listaClientes]) => {
        if (!ativo) return
        setPedidos(listaPedidos)
        setClientes(listaClientes)
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

  const pecasPlanejadas = pedidos.reduce((total, pedido) => total + pedido.quantidadeTotal, 0)
  const aguardandoTriagem = pedidos.filter((pedido) => pedido.quantidadeTriada === 0).length

  const colunas: ColunaTabela<PedidoResumoDTO>[] = [
    {
      titulo: 'Pedido',
      render: (pedido) => <span className="text-title-sm text-on-surface">{pedido.numeroPedido}</span>,
    },
    { titulo: 'Cliente (local da obra)', render: (pedido) => pedido.clienteNome },
    {
      titulo: 'Status',
      render: (pedido) => <BadgeStatus variante="neutro" texto={pedido.status} />,
    },
    {
      titulo: 'Peças bipadas',
      alinhamento: 'direita',
      render: (pedido) => <span className="whitespace-nowrap">{progressoDoPedido(pedido)}</span>,
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
    </LayoutAutenticado>
  )
}
