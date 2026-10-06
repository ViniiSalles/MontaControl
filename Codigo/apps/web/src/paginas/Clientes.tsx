import { useEffect, useState } from 'react'
import type { ClienteResumoDTO, GeocodificarEnderecoRequest, SalvarClienteRequest } from '@montacontrol/shared'
import { ErroApi } from '../api/clienteHttp'
import { atualizarCliente, criarCliente, detalharCliente, geocodificarEndereco, listarClientes } from '../api/clientes'
import { useAuth } from '../auth/AuthContext'
import { RASCUNHO_VAZIO, rascunhoDe, type RascunhoCliente } from '../formatacao/clientes'
import { filtrarPorNome } from '../formatacao/equipes'
import { Alerta } from '../ui/Alerta'
import { Botao } from '../ui/Botao'
import { CampoTexto } from '../ui/CampoTexto'
import { TabelaDados, type ColunaTabela } from '../ui/TabelaDados'
import { LayoutAutenticado } from './LayoutAutenticado'
import { ModalCliente } from './clientes/ModalCliente'

const mensagemDe = (causa: unknown, padrao: string) => (causa instanceof ErroApi ? causa.message : padrao)

interface EdicaoCliente {
  /** `null` = cliente novo. */
  id: number | null
  inicial: RascunhoCliente
}

/** Cadastro de clientes (locais de obra) pelo gestor — base do cadastro de pedidos. */
export default function Clientes() {
  const { sessao } = useAuth()
  const token = sessao?.accessToken ?? ''
  const [clientes, setClientes] = useState<ClienteResumoDTO[]>([])
  const [busca, setBusca] = useState('')
  const [edicao, setEdicao] = useState<EdicaoCliente | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [erroModal, setErroModal] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    listarClientes(token)
      .then((lista) => {
        if (ativo) setClientes(lista)
      })
      .catch((causa: unknown) => {
        if (ativo) setErro(mensagemDe(causa, 'Falha ao carregar os clientes.'))
      })
    return () => {
      ativo = false
    }
  }, [token])

  const linhas = filtrarPorNome(clientes, busca)

  function limparMensagens() {
    setErro(null)
    setAviso(null)
    setErroModal(null)
  }

  async function abrirEdicao(cliente: ClienteResumoDTO) {
    limparMensagens()
    try {
      setEdicao({ id: cliente.id, inicial: rascunhoDe(await detalharCliente(token, cliente.id)) })
    } catch (causa: unknown) {
      setErro(mensagemDe(causa, 'Falha ao abrir o cliente.'))
    }
  }

  async function aoSalvar(dados: SalvarClienteRequest) {
    if (!edicao) return
    setErroModal(null)
    try {
      const salvo = edicao.id === null ? await criarCliente(token, dados) : await atualizarCliente(token, edicao.id, dados)
      setClientes(await listarClientes(token))
      setAviso(`Cliente ${salvo.nome} salvo.`)
      setEdicao(null)
    } catch (causa: unknown) {
      setErroModal(mensagemDe(causa, 'Falha ao salvar o cliente.'))
      throw causa
    }
  }

  async function aoLocalizar(endereco: GeocodificarEnderecoRequest) {
    try {
      return await geocodificarEndereco(token, endereco)
    } catch (causa: unknown) {
      throw new Error(mensagemDe(causa, 'Não foi possível localizar o endereço.'), { cause: causa })
    }
  }

  const colunas: ColunaTabela<ClienteResumoDTO>[] = [
    { titulo: 'Cliente', render: (cliente) => <span className="text-title-sm text-on-surface">{cliente.nome}</span> },
    {
      titulo: 'Local da obra',
      render: (cliente) => (
        <div>
          <p className="text-body-md text-on-surface">{cliente.endereco}</p>
          <p className="text-body-sm text-on-surface-variant">
            {cliente.cidade} / {cliente.estado}
          </p>
        </div>
      ),
    },
    {
      titulo: 'Ações',
      alinhamento: 'direita',
      render: (cliente) => (
        <Botao variante="tonal" tamanho={40} forma="pilula" texto="Editar" aoPressionar={() => void abrirEdicao(cliente)} />
      ),
    },
  ]

  return (
    <LayoutAutenticado itemAtivo="/clientes" titulo="Clientes">
      <div className="space-y-24">
        <div className="flex flex-wrap items-end justify-between gap-16">
          <div className="w-full max-w-xs">
            <CampoTexto rotulo="Buscar cliente" iconeEsquerda="search" placeholder="Filtrar por nome…" valor={busca} aoAlterar={setBusca} />
          </div>
          <Botao
            variante="primario"
            tamanho={48}
            forma="pilula"
            icone="add"
            texto="Novo cliente"
            aoPressionar={() => {
              limparMensagens()
              setEdicao({ id: null, inicial: RASCUNHO_VAZIO })
            }}
          />
        </div>

        {erro && <Alerta variante="erro" mensagem={erro} />}
        {aviso && <Alerta variante="sucesso" mensagem={aviso} />}

        <TabelaDados
          rotulo="Clientes"
          colunas={colunas}
          linhas={linhas}
          chave={(cliente) => cliente.id}
          vazio={clientes.length === 0 ? 'Nenhum cliente cadastrado.' : 'Nenhum cliente encontrado para a busca.'}
        />
      </div>

      {edicao && (
        <ModalCliente
          titulo={edicao.id === null ? 'Novo cliente' : 'Editar cliente'}
          inicial={edicao.inicial}
          erro={erroModal}
          aoFechar={() => setEdicao(null)}
          aoSalvar={aoSalvar}
          aoLocalizar={aoLocalizar}
        />
      )}
    </LayoutAutenticado>
  )
}
