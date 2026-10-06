import { useState } from 'react'
import { cpfValido } from '@montacontrol/shared'
import type { FotoBase64 } from '@montacontrol/shared'
import { TIPOS_FOTO_ACEITOS, lerFotoComoBase64, validarArquivoFoto } from '../../formatacao/fotos'
import { Alerta } from '../../ui/Alerta'
import { Avatar } from '../../ui/Avatar'
import { Botao } from '../../ui/Botao'
import { CampoTexto } from '../../ui/CampoTexto'
import { Modal } from '../../ui/Modal'

export interface DadosNovoMontador {
  nome: string
  email: string
  cpf: string
  senha: string
  telefone: string
  /** Opcional. */
  foto: FotoBase64 | null
}

const VAZIO: DadosNovoMontador = { nome: '', email: '', cpf: '', senha: '', telefone: '', foto: null }

type CampoTextoMontador = Exclude<keyof DadosNovoMontador, 'foto'>

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
  const [erroFoto, setErroFoto] = useState<string | null>(null)

  const alterar = (campo: CampoTextoMontador) => (valor: string) => {
    if (campo === 'cpf') setErroCpf(undefined)
    setDados((atual) => ({ ...atual, [campo]: valor }))
  }

  async function aoEscolherFoto(arquivo: File | undefined) {
    setErroFoto(null)
    if (!arquivo) return
    const problema = validarArquivoFoto(arquivo)
    if (problema) {
      setErroFoto(problema)
      return
    }
    try {
      const foto = await lerFotoComoBase64(arquivo)
      setDados((atual) => ({ ...atual, foto }))
    } catch {
      setErroFoto('Não foi possível ler a foto. Tente outra.')
    }
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

  const previa = dados.foto ? `data:${dados.foto.mimeType};base64,${dados.foto.conteudoBase64}` : null

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
          <div className="flex items-center gap-16 sm:col-span-2">
            <Avatar nome={dados.nome || '?'} fotoUrl={previa} tamanho="xl" />
            <div className="space-y-6">
              <label htmlFor="foto-montador" className="block px-4 text-label-lg uppercase text-on-surface-variant">
                Foto (opcional)
              </label>
              <input
                id="foto-montador"
                type="file"
                accept={TIPOS_FOTO_ACEITOS}
                onChange={(evento) => {
                  void aoEscolherFoto(evento.target.files?.[0])
                  evento.target.value = ''
                }}
                className="block text-body-sm text-on-surface-variant"
              />
              {dados.foto && (
                <Botao
                  variante="fantasma"
                  tamanho={40}
                  forma="pilula"
                  texto="Remover foto"
                  aoPressionar={() => setDados((atual) => ({ ...atual, foto: null }))}
                />
              )}
              {erroFoto && <p className="px-4 text-body-sm text-error">{erroFoto}</p>}
            </div>
          </div>
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
