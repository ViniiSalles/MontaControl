import { useState } from 'react'
import { cpfValido } from '@montacontrol/shared'
import { Alerta } from '../../ui/Alerta'
import { CampoTexto } from '../../ui/CampoTexto'
import { Modal } from '../../ui/Modal'

export interface DadosNovoMontador {
  nome: string
  email: string
  cpf: string
  senha: string
  telefone: string
}

const VAZIO: DadosNovoMontador = { nome: '', email: '', cpf: '', senha: '', telefone: '' }

interface PropsModalNovoMontador {
  visivel: boolean
  /** Erro do último envio — mostrado dentro do modal, que cobre o resto da página. */
  erro: string | null
  aoFechar: () => void
  /** Rejeita quando o cadastro falha, para o modal continuar aberto com os dados. */
  aoCadastrar: (dados: DadosNovoMontador) => Promise<void>
}

export function ModalNovoMontador({ visivel, erro, aoFechar, aoCadastrar }: PropsModalNovoMontador) {
  const [dados, setDados] = useState<DadosNovoMontador>(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erroCpf, setErroCpf] = useState<string | undefined>()

  const alterar = (campo: keyof DadosNovoMontador) => (valor: string) => {
    if (campo === 'cpf') setErroCpf(undefined)
    setDados((atual) => ({ ...atual, [campo]: valor }))
  }

  async function aoConfirmar() {
    if (salvando) return
    if (!cpfValido(dados.cpf)) {
      setErroCpf('CPF inválido')
      return
    }
    setSalvando(true)
    try {
      await aoCadastrar(dados)
    } catch {
      // A página já guardou a mensagem em `erro`; aqui só mantemos os dados digitados.
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      visivel={visivel}
      apresentacao="centro"
      titulo="Novo Montador"
      aoFechar={aoFechar}
      acoes={[
        { texto: 'Cancelar', variante: 'fantasma', aoPressionar: aoFechar },
        { texto: salvando ? 'Cadastrando…' : 'Cadastrar', aoPressionar: () => void aoConfirmar() },
      ]}
      conteudo={
        <div className="grid gap-16 sm:grid-cols-2">
          {erro && (
            <div className="sm:col-span-2">
              <Alerta variante="erro" mensagem={erro} />
            </div>
          )}
          <CampoTexto rotulo="Nome" valor={dados.nome} aoAlterar={alterar('nome')} obrigatorio />
          <CampoTexto rotulo="E-mail" tipo="email" valor={dados.email} aoAlterar={alterar('email')} obrigatorio />
          <CampoTexto rotulo="CPF" placeholder="000.000.000-00" valor={dados.cpf} aoAlterar={alterar('cpf')} obrigatorio erro={erroCpf} />
          <CampoTexto rotulo="Telefone" placeholder="(11) 91234-5678" valor={dados.telefone} aoAlterar={alterar('telefone')} />
          <CampoTexto rotulo="Senha" tipo="senha" valor={dados.senha} aoAlterar={alterar('senha')} obrigatorio />
        </div>
      }
    />
  )
}
