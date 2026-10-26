import { useEffect, useState } from 'react'
import { Perfil, mascararCpf } from '@montacontrol/shared'
import type { UsuarioDTO } from '@montacontrol/shared'
import { useAuth } from '../auth/AuthContext'
import { alterarAtivoUsuario, atualizarUsuario, cadastrarUsuario, listarUsuarios } from '../api/usuarios'
import { filtrarMontadores, formatarDataCadastro } from '../formatacao/montadores'
import { ordenarLinhas, type OrdemTabela } from '../formatacao/ordenacao'
import { ErroApi } from '../api/clienteHttp'
import { Alerta } from '../ui/Alerta'
import { Avatar } from '../ui/Avatar'
import { BadgeStatus } from '../ui/BadgeStatus'
import { Botao } from '../ui/Botao'
import { CampoTexto } from '../ui/CampoTexto'
import { CartaoIndicador } from '../ui/CartaoIndicador'
import { Paginacao } from '../ui/Paginacao'
import { SubAbas } from '../ui/SubAbas'
import { TabelaDados, type ColunaTabela } from '../ui/TabelaDados'
import { LayoutAutenticado } from './LayoutAutenticado'
import { ModalColaborador, type DadosColaborador } from './colaboradores/ModalColaborador'

const POR_PAGINA = 10

type PerfilColaborador = Perfil.RH | Perfil.DEPOSITO

const ROTULOS: Record<PerfilColaborador, { aba: string; singular: string; plural: string }> = {
  [Perfil.RH]: { aba: 'Recursos Humanos', singular: 'membro do RH', plural: 'membros do RH' },
  [Perfil.DEPOSITO]: { aba: 'Operadores', singular: 'operador', plural: 'operadores' },
}

type Edicao = { modo: 'novo' } | { modo: 'editar'; usuario: UsuarioDTO }

const mensagemDe = (causa: unknown, padrao: string) => (causa instanceof ErroApi ? causa.message : padrao)

const ehColaborador = (usuario: UsuarioDTO) => usuario.perfil === Perfil.RH || usuario.perfil === Perfil.DEPOSITO

/** Cadastro, edição e desligamento dos membros do RH e dos operadores do depósito, pelo gestor. */
export default function Colaboradores() {
  const { sessao } = useAuth()
  const token = sessao?.accessToken ?? ''
  const [colaboradores, setColaboradores] = useState<UsuarioDTO[]>([])
  const [aba, setAba] = useState<PerfilColaborador>(Perfil.RH)
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [ordem, setOrdem] = useState<OrdemTabela | null>(null)
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [erroModal, setErroModal] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    listarUsuarios(token)
      .then((usuarios) => {
        if (ativo) setColaboradores(usuarios.filter(ehColaborador))
      })
      .catch((causa: unknown) => {
        if (ativo) setErro(mensagemDe(causa, 'Falha ao carregar colaboradores.'))
      })
    return () => {
      ativo = false
    }
  }, [token])

  const rotulos = ROTULOS[aba]
  const daAba = colaboradores.filter((usuario) => usuario.perfil === aba)
  const filtrados = filtrarMontadores(daAba, busca)
  const ativos = daAba.filter((usuario) => usuario.ativo).length

  function aoMudarAba(nova: PerfilColaborador) {
    setAba(nova)
    setBusca('')
    setPagina(1)
    setAviso(null)
  }

  function abrir(nova: Edicao) {
    setErro(null)
    setErroModal(null)
    setAviso(null)
    setEdicao(nova)
  }

  function substituir(atualizado: UsuarioDTO) {
    setColaboradores((atuais) => atuais.map((item) => (item.id === atualizado.id ? atualizado : item)))
  }

  async function aoSalvar(dados: DadosColaborador) {
    if (!edicao) return
    setErroModal(null)
    try {
      if (edicao.modo === 'editar') {
        const atualizado = await atualizarUsuario(token, edicao.usuario.id, {
          nome: dados.nome.trim(),
          telefone: dados.telefone.trim() || null,
        })
        substituir(atualizado)
        setAviso(`Dados de ${atualizado.nome} atualizados.`)
      } else {
        const criado = await cadastrarUsuario(token, {
          nome: dados.nome.trim(),
          email: dados.email.trim(),
          senha: dados.senha,
          telefone: dados.telefone.trim() || undefined,
          cpf: dados.cpf.trim() || undefined,
          perfil: aba,
        })
        setColaboradores((atuais) => [...atuais, criado].sort((a, b) => a.nome.localeCompare(b.nome)))
        setAviso(`${criado.nome} cadastrado(a) como ${rotulos.singular}.`)
      }
      setEdicao(null)
    } catch (causa: unknown) {
      setErroModal(mensagemDe(causa, 'Falha ao salvar.'))
      throw causa
    }
  }

  async function aoAlternarSituacao(usuario: UsuarioDTO) {
    setErro(null)
    setAviso(null)
    try {
      substituir(await alterarAtivoUsuario(token, usuario.id, !usuario.ativo))
    } catch (causa: unknown) {
      setErro(mensagemDe(causa, 'Falha ao alterar a situação.'))
    }
  }

  const colunas: ColunaTabela<UsuarioDTO>[] = [
    {
      titulo: 'Nome',
      ordenacao: { tipo: 'texto', valor: (usuario) => usuario.nome },
      render: (usuario) => (
        <div className="flex items-center gap-12">
          <Avatar nome={usuario.nome} fotoUrl={usuario.fotoUrl} />
          <div>
            <p className="text-title-sm text-on-surface">{usuario.nome}</p>
            <p className="break-all text-body-sm text-on-surface-variant">{usuario.email}</p>
          </div>
        </div>
      ),
    },
    { titulo: 'CPF', ordenacao: { tipo: 'texto', valor: (usuario) => usuario.cpf }, render: (usuario) => mascararCpf(usuario.cpf) },
    { titulo: 'Telefone', ordenacao: { tipo: 'texto', valor: (usuario) => usuario.telefone }, render: (usuario) => usuario.telefone ?? '—' },
    {
      titulo: 'Status',
      ordenacao: { tipo: 'texto', valor: (usuario) => (usuario.ativo ? 'Ativo' : 'Inativo') },
      render: (usuario) =>
        usuario.ativo ? <BadgeStatus variante="sucesso" texto="Ativo" /> : <BadgeStatus variante="neutro" texto="Inativo" />,
    },
    {
      titulo: 'Data cadastro',
      ordenacao: { tipo: 'data', valor: (usuario) => usuario.criadoEm },
      render: (usuario) => <span className="whitespace-nowrap">{formatarDataCadastro(usuario.criadoEm)}</span>,
    },
    {
      titulo: 'Ações',
      alinhamento: 'direita',
      render: (usuario) => (
        <div className="flex items-center justify-end gap-8 whitespace-nowrap">
          <Botao
            variante="fantasma"
            tamanho={40}
            forma="retangular"
            texto="Editar"
            aoPressionar={() => abrir({ modo: 'editar', usuario })}
          />
          <Botao
            variante="fantasma"
            tamanho={40}
            forma="retangular"
            texto={usuario.ativo ? 'Inativar' : 'Reativar'}
            aoPressionar={() => void aoAlternarSituacao(usuario)}
          />
        </div>
      ),
    },
  ]

  // Ordena a lista inteira antes de paginar — senão a ordem valeria só para a página atual.
  const ordenados = ordenarLinhas(filtrados, colunas, ordem)
  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const visiveis = ordenados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)

  return (
    <LayoutAutenticado
      itemAtivo="/colaboradores"
      titulo="Colaboradores"
      complementoTitulo={
        <SubAbas
          abas={[
            { id: Perfil.RH, rotulo: ROTULOS[Perfil.RH].aba },
            { id: Perfil.DEPOSITO, rotulo: ROTULOS[Perfil.DEPOSITO].aba },
          ]}
          ativa={aba}
          aoMudar={aoMudarAba}
        />
      }
    >
      <div className="space-y-32">
        <div className="flex flex-wrap items-end justify-between gap-16">
          <div className="w-full max-w-md">
            <CampoTexto
              rotulo={`Buscar ${rotulos.singular}`}
              iconeEsquerda="search"
              placeholder="Buscar por nome, e-mail ou CPF…"
              valor={busca}
              aoAlterar={(valor) => {
                setBusca(valor)
                setPagina(1)
              }}
            />
          </div>
          <Botao
            variante="primario"
            tamanho={48}
            forma="pilula"
            icone="add"
            texto={aba === Perfil.RH ? 'Novo membro do RH' : 'Novo operador'}
            aoPressionar={() => abrir({ modo: 'novo' })}
          />
        </div>

        {erro && <Alerta variante="erro" mensagem={erro} />}
        {aviso && <Alerta variante="sucesso" mensagem={aviso} />}

        <div className="grid gap-24 md:grid-cols-2">
          <CartaoIndicador icone="groups" rotulo="Ativos" valor={String(ativos)} />
          <CartaoIndicador icone="person_off" tom="alerta" rotulo="Inativos" valor={String(daAba.length - ativos)} />
        </div>

        <div>
          <TabelaDados
            rotulo={rotulos.aba}
            colunas={colunas}
            linhas={visiveis}
            chave={(usuario) => usuario.id}
            ordem={ordem}
            aoOrdenar={(nova) => {
              setOrdem(nova)
              setPagina(1)
            }}
            vazio={daAba.length === 0 ? `Nenhum ${rotulos.singular} cadastrado.` : 'Nenhum resultado para a busca.'}
          />
          <Paginacao
            pagina={paginaAtual}
            totalPaginas={totalPaginas}
            resumo={`Mostrando ${visiveis.length} de ${filtrados.length} ${rotulos.plural}`}
            aoMudar={setPagina}
          />
        </div>
      </div>

      {edicao && (
        <ModalColaborador
          key={edicao.modo === 'editar' ? edicao.usuario.id : 'novo'}
          rotuloPerfil={rotulos.singular}
          emEdicao={edicao.modo === 'editar' ? edicao.usuario : undefined}
          erro={erroModal}
          aoFechar={() => {
            setEdicao(null)
            setErroModal(null)
          }}
          aoSalvar={aoSalvar}
        />
      )}
    </LayoutAutenticado>
  )
}
