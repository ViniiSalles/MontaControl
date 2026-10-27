import { useState } from 'react'
import { cpfValido } from '@montacontrol/shared'
import type { UsuarioDTO } from '@montacontrol/shared'
import { Alerta } from '../../ui/Alerta'
import { CampoTexto } from '../../ui/CampoTexto'
import { Modal } from '../../ui/Modal'

export interface DadosColaborador {
  nome: string
  email: string
  telefone: string
  cpf: string
  senha: string
}

type CampoColaborador = keyof DadosColaborador

interface PropsModalColaborador {
  /** Ex.: "membro do RH", "operador". */
  rotuloPerfil: string
  /** Ausente = cadastro; presente = edição de nome e telefone. */
  emEdicao?: UsuarioDTO
  /** Erro do último envio — mostrado dentro do modal, que cobre o resto da página. */
  erro: string | null
  aoFechar: () => void
  /** Rejeita quando o envio falha, para o modal continuar aberto com os dados. */
  aoSalvar: (dados: DadosColaborador) => Promise<void>
}

export function ModalColaborador({ rotuloPerfil, emEdicao, erro, aoFechar, aoSalvar }: PropsModalColaborador) {
  const [dados, setDados] = useState<DadosColaborador>({
    nome: emEdicao?.nome ?? '',
    email: emEdicao?.email ?? '',
    telefone: emEdicao?.telefone ?? '',
    cpf: '',
    senha: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erroCpf, setErroCpf] = useState<string | undefined>()
  const [erroNome, setErroNome] = useState<string | undefined>()

  const alterar = (campo: CampoColaborador) => (valor: string) => {
    if (campo === 'cpf') setErroCpf(undefined)
    if (campo === 'nome') setErroNome(undefined)
    setDados((atual) => ({ ...atual, [campo]: valor }))
  }

  async function aoConfirmar() {
    if (salvando) return
    if (!dados.nome.trim()) {
      setErroNome('Informe o nome')
      return
    }
    if (!emEdicao && dados.cpf.trim() && !cpfValido(dados.cpf)) {
      setErroCpf('CPF inválido')
      return
    }
    setSalvando(true)
    try {
      await aoSalvar(dados)
    } catch {
      // A página já guardou a mensagem em `erro`; aqui só mantemos os dados digitados.
    } finally {
      setSalvando(false)
    }
  }

  const textoSalvar = emEdicao ? (salvando ? 'Salvando…' : 'Salvar') : salvando ? 'Cadastrando…' : 'Cadastrar'

  return (
    <Modal
      visivel
      apresentacao="centro"
      titulo={emEdicao ? `Editar ${rotuloPerfil}` : `Novo ${rotuloPerfil}`}
      aoFechar={aoFechar}
      acoes={[
        { texto: 'Cancelar', variante: 'fantasma', aoPressionar: aoFechar },
        { texto: textoSalvar, aoPressionar: () => void aoConfirmar() },
      ]}
      conteudo={
        <div className="grid gap-16 sm:grid-cols-2">
          {erro && (
            <div className="sm:col-span-2">
              <Alerta variante="erro" mensagem={erro} />
            </div>
          )}
          <CampoTexto rotulo="Nome" valor={dados.nome} aoAlterar={alterar('nome')} obrigatorio erro={erroNome} />
          {emEdicao ? (
            <CampoTexto rotulo="E-mail" tipo="email" valor={dados.email} aoAlterar={alterar('email')} desabilitado ajuda="O e-mail é o login e não pode ser alterado." />
          ) : (
            <CampoTexto rotulo="E-mail" tipo="email" valor={dados.email} aoAlterar={alterar('email')} obrigatorio />
          )}
          <CampoTexto rotulo="Telefone" placeholder="(11) 91234-5678" valor={dados.telefone} aoAlterar={alterar('telefone')} />
          {!emEdicao && (
            <>
              <CampoTexto rotulo="CPF (opcional)" placeholder="000.000.000-00" valor={dados.cpf} aoAlterar={alterar('cpf')} erro={erroCpf} />
              <CampoTexto rotulo="Senha inicial" tipo="senha" valor={dados.senha} aoAlterar={alterar('senha')} obrigatorio ajuda="Mínimo de 8 caracteres." />
            </>
          )}
        </div>
      }
    />
  )
}
