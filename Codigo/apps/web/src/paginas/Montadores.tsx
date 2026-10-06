import { useEffect, useState } from 'react'
import { Perfil, mascararCpf } from '@montacontrol/shared'
import type { UsuarioDTO } from '@montacontrol/shared'
import { useAuth } from '../auth/AuthContext'
import { alterarAtivoUsuario, cadastrarUsuario, informarCpfUsuario, listarUsuarios } from '../api/usuarios'
import { contarNovosNoMes, filtrarMontadores, formatarDataCadastro } from '../formatacao/montadores'
import { ordenarLinhas, type OrdemTabela } from '../formatacao/ordenacao'
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
import { ModalInformarCpf } from './montadores/ModalInformarCpf'
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
  const [ordem, setOrdem] = useState<OrdemTabela | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [emCpf, setEmCpf] = useState<UsuarioDTO | null>(null)
  const [erroCpf, setErroCpf] = useState<string | null>(null)

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

  const filtrados = filtrarMontadores(montadores, busca)
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
        cpf: dados.cpf,
        senha: dados.senha,
        telefone: dados.telefone.trim() || undefined,
        perfil: Perfil.MONTADOR,
        ...(dados.foto ? { foto: dados.foto } : {}),
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

  async function aoInformarCpf(cpf: string) {
    if (!emCpf) return
    setErroCpf(null)
    try {
      const atualizado = await informarCpfUsuario(token, emCpf.id, cpf)
      setMontadores((atuais) => atuais.map((item) => (item.id === atualizado.id ? atualizado : item)))
      setEmCpf(null)
      setAviso(`CPF de ${atualizado.nome} registrado.`)
    } catch (causa: unknown) {
      setErroCpf(mensagemDe(causa, 'Falha ao registrar o CPF.'))
      throw causa
    }
  }

  const colunas: ColunaTabela<UsuarioDTO>[] = [
    {
      titulo: 'Montador',
      ordenacao: { tipo: 'texto', valor: (montador) => montador.nome },
      render: (montador) => (
        <div className="flex items-center gap-12">
          <Avatar nome={montador.nome} fotoUrl={montador.fotoUrl} />
          <div>
            <p className="text-title-sm text-on-surface">{montador.nome}</p>
            <p className="break-all text-body-sm text-on-surface-variant">{montador.email}</p>
          </div>
        </div>
      ),
    },
    { titulo: 'Documento (CPF)', ordenacao: { tipo: 'texto', valor: (montador) => montador.cpf }, render: (montador) => mascararCpf(montador.cpf) },
    { titulo: 'Telefone', ordenacao: { tipo: 'texto', valor: (montador) => montador.telefone }, render: (montador) => montador.telefone ?? '—' },
    {
      titulo: 'Status',
      ordenacao: { tipo: 'texto', valor: (montador) => (montador.ativo ? 'Ativo' : 'Inativo') },
      render: (montador) =>
        montador.ativo ? <BadgeStatus variante="sucesso" texto="Ativo" /> : <BadgeStatus variante="neutro" texto="Inativo" />,
    },
    {
      titulo: 'Data cadastro',
      ordenacao: { tipo: 'data', valor: (montador) => montador.criadoEm },
      render: (montador) => <span className="whitespace-nowrap">{formatarDataCadastro(montador.criadoEm)}</span>,
    },
    {
      titulo: 'Ações',
      alinhamento: 'direita',
      render: (montador) => (
        <div className="flex items-center justify-end gap-8 whitespace-nowrap">
          {!montador.cpf && (
            <Botao
              variante="fantasma"
              tamanho={40}
              forma="retangular"
              texto="Informar CPF"
              aoPressionar={() => {
                setErroCpf(null)
                setAviso(null)
                setEmCpf(montador)
              }}
            />
          )}
          <Botao
            variante="fantasma"
            tamanho={40}
            forma="retangular"
            texto={montador.ativo ? 'Inativar' : 'Reativar'}
            aoPressionar={() => void aoAlternarSituacao(montador)}
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
              placeholder="Buscar por nome, e-mail ou CPF…"
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
          <CartaoIndicador
            tom="destaque"
            rotulo="Novos no mês"
            valor={String(contarNovosNoMes(montadores, new Date()))}
            complemento="cadastros"
          />
        </div>

        <div>
          <TabelaDados
            rotulo="Montadores"
            colunas={colunas}
            linhas={visiveis}
            chave={(montador) => montador.id}
            ordem={ordem}
            aoOrdenar={(nova) => {
              setOrdem(nova)
              setPagina(1)
            }}
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
      {emCpf && (
        <ModalInformarCpf
          nome={emCpf.nome}
          erro={erroCpf}
          aoFechar={() => {
            setErroCpf(null)
            setEmCpf(null)
          }}
          aoConfirmar={aoInformarCpf}
        />
      )}
    </LayoutAutenticado>
  )
}
