import { useEffect, useState } from 'react'
import { Perfil } from '@montacontrol/shared'
import type { UsuarioDTO } from '@montacontrol/shared'
import { useAuth } from '../auth/AuthContext'
import { alterarAtivoUsuario, cadastrarUsuario, listarUsuarios } from '../api/usuarios'
import { ErroApi } from '../api/clienteHttp'
import { Alerta } from '../ui/Alerta'
import { Avatar } from '../ui/Avatar'
import { BadgeStatus } from '../ui/BadgeStatus'
import { Botao } from '../ui/Botao'
import { CampoTexto } from '../ui/CampoTexto'
import { CartaoIndicador } from '../ui/CartaoIndicador'
import { Paginacao } from '../ui/Paginacao'
import { TabelaDados, type ColunaTabela } from '../ui/TabelaDados'
import { LayoutAutenticado } from './LayoutAutenticado'
import { ModalNovoMontador, type DadosNovoMontador } from './montadores/ModalNovoMontador'

const POR_PAGINA = 10

const mensagemDe = (causa: unknown, padrao: string) => (causa instanceof ErroApi ? causa.message : padrao)

/** US12/UC17 — listagem, cadastro e desligamento de montadores (`cadastro_de_montadores`). */
export default function Montadores() {
  const { sessao } = useAuth()
  const token = sessao?.accessToken ?? ''
  const [montadores, setMontadores] = useState<UsuarioDTO[]>([])
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [modalAberto, setModalAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

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

  const termo = busca.trim().toLowerCase()
  const filtrados = montadores.filter(
    (montador) => montador.nome.toLowerCase().includes(termo) || montador.email.toLowerCase().includes(termo),
  )
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const visiveis = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)
  const ativos = montadores.filter((montador) => montador.ativo).length

  function aoBuscar(valor: string) {
    setBusca(valor)
    setPagina(1)
  }

  async function aoCadastrar(dados: DadosNovoMontador) {
    setErro(null)
    setAviso(null)
    try {
      const criado = await cadastrarUsuario(token, {
        nome: dados.nome,
        email: dados.email,
        senha: dados.senha,
        telefone: dados.telefone.trim() || undefined,
        perfil: Perfil.MONTADOR,
      })
      setMontadores((atuais) => [...atuais, criado].sort((a, b) => a.nome.localeCompare(b.nome)))
      setModalAberto(false)
      setAviso(`Montador ${criado.nome} cadastrado.`)
    } catch (causa: unknown) {
      setErro(mensagemDe(causa, 'Falha ao cadastrar montador.'))
      throw causa
    }
  }

  async function aoAlternarSituacao(montador: UsuarioDTO) {
    setErro(null)
    try {
      const atualizado = await alterarAtivoUsuario(token, montador.id, !montador.ativo)
      setMontadores((atuais) => atuais.map((item) => (item.id === atualizado.id ? atualizado : item)))
    } catch (causa: unknown) {
      setErro(mensagemDe(causa, 'Falha ao alterar a situação.'))
    }
  }

  const colunas: ColunaTabela<UsuarioDTO>[] = [
    {
      titulo: 'Montador',
      render: (montador) => (
        <div className="flex items-center gap-12">
          <Avatar nome={montador.nome} />
          <div>
            <p className="text-title-sm text-on-surface">{montador.nome}</p>
            <p className="text-body-sm text-on-surface-variant">{montador.email}</p>
          </div>
        </div>
      ),
    },
    { titulo: 'Telefone', render: (montador) => montador.telefone ?? '—' },
    {
      titulo: 'Status',
      render: (montador) =>
        montador.ativo ? <BadgeStatus variante="sucesso" texto="Ativo" /> : <BadgeStatus variante="neutro" texto="Inativo" />,
    },
    {
      titulo: 'Ações',
      alinhamento: 'direita',
      render: (montador) => (
        <Botao
          variante="fantasma"
          tamanho={40}
          forma="retangular"
          texto={montador.ativo ? 'Inativar' : 'Reativar'}
          aoPressionar={() => void aoAlternarSituacao(montador)}
        />
      ),
    },
  ]

  return (
    <LayoutAutenticado
      itemAtivo="/montadores"
      titulo="Montadores"
      complementoTitulo={
        <p className="hidden text-label-md uppercase text-on-surface-variant md:block">
          Recursos Humanos <span aria-hidden="true">›</span> Listagem Geral
        </p>
      }
    >
      <div className="space-y-32">
        <div className="flex flex-wrap items-end justify-between gap-16">
          <div className="w-full max-w-md">
            <CampoTexto
              rotulo="Buscar montador"
              iconeEsquerda="search"
              placeholder="Buscar por nome ou e-mail…"
              valor={busca}
              aoAlterar={aoBuscar}
            />
          </div>
          <Botao variante="primario" tamanho={48} forma="pilula" icone="add" texto="Novo Montador" aoPressionar={() => {
            setErro(null)
            setAviso(null)
            setModalAberto(true)
          }} />
        </div>

        {erro && <Alerta variante="erro" mensagem={erro} />}
        {aviso && <Alerta variante="sucesso" mensagem={aviso} />}

        <div className="grid gap-24 md:grid-cols-3">
          <CartaoIndicador icone="groups" rotulo="Total ativos" valor={String(ativos)} />
          <CartaoIndicador icone="person_off" tom="alerta" rotulo="Inativos" valor={String(montadores.length - ativos)} />
          <CartaoIndicador tom="destaque" rotulo="Total cadastrados" valor={String(montadores.length)} complemento="montadores" />
        </div>

        <div>
          <TabelaDados
            rotulo="Montadores"
            colunas={colunas}
            linhas={visiveis}
            chave={(montador) => montador.id}
            vazio={montadores.length === 0 ? 'Nenhum montador cadastrado.' : 'Nenhum montador encontrado para a busca.'}
          />
          <Paginacao
            pagina={paginaAtual}
            totalPaginas={totalPaginas}
            resumo={`Mostrando ${visiveis.length} de ${filtrados.length} montadores`}
            aoMudar={setPagina}
          />
        </div>
      </div>

      {modalAberto && (
        <ModalNovoMontador
          visivel={modalAberto}
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
