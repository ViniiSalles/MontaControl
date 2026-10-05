import { useEffect, useState } from 'react'
import type { EquipeDTO, SalvarEquipeRequest, UsuarioDTO } from '@montacontrol/shared'
import { ErroApi } from '../api/clienteHttp'
import { atualizarEquipe, criarEquipe, listarEquipes, removerEquipe } from '../api/equipes'
import { listarUsuarios } from '../api/usuarios'
import { useAuth } from '../auth/AuthContext'
import { montadoresDisponiveis, textoQuantidadeMontadores } from '../formatacao/equipes'
import { Alerta } from '../ui/Alerta'
import { Botao } from '../ui/Botao'
import { Modal } from '../ui/Modal'
import { TabelaDados, type ColunaTabela } from '../ui/TabelaDados'
import { LayoutAutenticado } from './LayoutAutenticado'
import { ModalEquipe } from './equipes/ModalEquipe'

const mensagemDe = (causa: unknown, padrao: string) => (causa instanceof ErroApi ? causa.message : padrao)

/** `undefined` = modal fechado; `null` = criando; equipe = editando. */
type EdicaoEquipe = EquipeDTO | null | undefined

/**
 * Equipes de montadores que costumam ir juntos para a mesma obra. Servem de
 * atalho na atribuição do pedido — a obra recebe cada pessoa, não a equipe.
 */
export default function Equipes() {
  const { sessao } = useAuth()
  const token = sessao?.accessToken ?? ''
  const [equipes, setEquipes] = useState<EquipeDTO[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioDTO[]>([])
  const [edicao, setEdicao] = useState<EdicaoEquipe>(undefined)
  const [paraExcluir, setParaExcluir] = useState<EquipeDTO | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [erroModal, setErroModal] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    Promise.all([listarEquipes(token), listarUsuarios(token)])
      .then(([listaEquipes, listaUsuarios]) => {
        if (!ativo) return
        setEquipes(listaEquipes)
        setUsuarios(listaUsuarios)
      })
      .catch((causa: unknown) => {
        if (ativo) setErro(mensagemDe(causa, 'Falha ao carregar as equipes.'))
      })
    return () => {
      ativo = false
    }
  }, [token])

  const montadores = montadoresDisponiveis(usuarios)

  function abrir(equipe: EquipeDTO | null) {
    setErro(null)
    setAviso(null)
    setErroModal(null)
    setEdicao(equipe)
  }

  async function aoSalvar(dados: SalvarEquipeRequest) {
    setErroModal(null)
    try {
      const salva = edicao ? await atualizarEquipe(token, edicao.id, dados) : await criarEquipe(token, dados)
      setEquipes(await listarEquipes(token))
      setAviso(`Equipe ${salva.nome} salva.`)
      setEdicao(undefined)
    } catch (causa: unknown) {
      setErroModal(mensagemDe(causa, 'Falha ao salvar a equipe.'))
      throw causa
    }
  }

  async function aoConfirmarExclusao() {
    if (!paraExcluir) return
    try {
      await removerEquipe(token, paraExcluir.id)
      setEquipes((atuais) => atuais.filter((equipe) => equipe.id !== paraExcluir.id))
      setAviso(`Equipe ${paraExcluir.nome} excluída.`)
    } catch (causa: unknown) {
      setErro(mensagemDe(causa, 'Falha ao excluir a equipe.'))
    } finally {
      setParaExcluir(null)
    }
  }

  const colunas: ColunaTabela<EquipeDTO>[] = [
    { titulo: 'Equipe', render: (equipe) => <span className="text-title-sm text-on-surface">{equipe.nome}</span> },
    {
      titulo: 'Membros',
      render: (equipe) => (
        <div>
          <p className="text-body-md text-on-surface">{textoQuantidadeMontadores(equipe.membros.length)}</p>
          <p className="text-body-sm text-on-surface-variant">
            {equipe.membros.map((membro) => membro.nome).join(', ')}
          </p>
        </div>
      ),
    },
    {
      titulo: 'Ações',
      alinhamento: 'direita',
      render: (equipe) => (
        <div className="flex justify-end gap-8">
          <Botao variante="tonal" tamanho={40} forma="pilula" texto="Editar" aoPressionar={() => abrir(equipe)} />
          <Botao variante="fantasma" tamanho={40} forma="pilula" texto="Excluir" aoPressionar={() => setParaExcluir(equipe)} />
        </div>
      ),
    },
  ]

  return (
    <LayoutAutenticado itemAtivo="/equipes" titulo="Equipes">
      <div className="space-y-24">
        <div className="flex flex-wrap items-end justify-between gap-16">
          <p className="max-w-xl text-body-md text-on-surface-variant">
            Monte equipes de quem costuma trabalhar junto. Na atribuição do pedido, a equipe preenche os montadores
            de uma vez — depois dá para tirar ou acrescentar pessoas avulsas.
          </p>
          <Botao variante="primario" tamanho={48} forma="pilula" icone="add" texto="Nova equipe" aoPressionar={() => abrir(null)} />
        </div>

        {erro && <Alerta variante="erro" mensagem={erro} />}
        {aviso && <Alerta variante="sucesso" mensagem={aviso} />}

        <TabelaDados
          rotulo="Equipes"
          colunas={colunas}
          linhas={equipes}
          chave={(equipe) => equipe.id}
          vazio="Nenhuma equipe cadastrada."
        />
      </div>

      {edicao !== undefined && (
        <ModalEquipe
          equipe={edicao}
          montadores={montadores}
          erro={erroModal}
          aoFechar={() => setEdicao(undefined)}
          aoSalvar={aoSalvar}
        />
      )}

      <Modal
        visivel={paraExcluir !== null}
        apresentacao="centro"
        titulo="Excluir equipe"
        aoFechar={() => setParaExcluir(null)}
        acoes={[
          { texto: 'Cancelar', variante: 'fantasma', aoPressionar: () => setParaExcluir(null) },
          { texto: 'Excluir', aoPressionar: () => void aoConfirmarExclusao() },
        ]}
        conteudo={
          <p className="text-body-md text-on-surface">
            Excluir a equipe <strong>{paraExcluir?.nome}</strong>? Os montadores já atribuídos às obras continuam
            nelas.
          </p>
        }
      />
    </LayoutAutenticado>
  )
}
