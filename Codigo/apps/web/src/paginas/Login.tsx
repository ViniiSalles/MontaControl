import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { VarianteAlerta } from '@montacontrol/ui-contracts/alerta'
import { Alerta } from '../ui/Alerta'
import { Botao } from '../ui/Botao'
import { CampoTexto } from '../ui/CampoTexto'
import { SimboloMaterial } from '../ui/SimboloMaterial'
import { useAuth } from '../auth/AuthContext'
import { ErroAutenticacao } from '../auth/clienteAuth'

const CODIGO_CREDENCIAIS_INVALIDAS = 'CREDENCIAIS_INVALIDAS'

interface EstadoErro {
  variante: VarianteAlerta
  mensagem: string
}

/**
 * Ver `login_montacontrol:92-153`. Sem checkbox "Manter conectado" e sem
 * link "Esqueci minha senha" — nenhum dos dois tem fluxo construído na Fase
 * 11 (recuperação de senha é DTO de backend só; ui-contracts não tem
 * Checkbox), então não entram para não deixar controle morto na tela.
 */
export default function Login() {
  const { entrar } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<EstadoErro | null>(null)

  async function realizarLogin() {
    setErro(null)
    setCarregando(true)
    try {
      const destino = await entrar(email, senha)
      navigate(destino, { replace: true })
    } catch (excecao) {
      if (excecao instanceof ErroAutenticacao) {
        setErro({
          variante: excecao.codigo === CODIGO_CREDENCIAIS_INVALIDAS ? 'erro' : 'aviso',
          mensagem: excecao.message,
        })
      } else {
        setErro({ variante: 'erro', mensagem: 'Não foi possível conectar ao servidor. Tente novamente.' })
      }
      setCarregando(false)
    }
  }

  function aoSubmeter(evento: FormEvent) {
    evento.preventDefault()
    void realizarLogin()
  }

  return (
    <main className="fundo-padrao-logistica relative flex min-h-screen items-center justify-center overflow-hidden px-24 font-sans">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent" />
      <div className="relative z-10 w-full max-w-[440px] rounded-xl bg-white/70 p-40 shadow-elev4 backdrop-blur-lg">
        <header className="mb-40 flex flex-col items-center text-center">
          <div className="mb-16 flex h-64 w-64 items-center justify-center rounded-xl bg-primary-container shadow-sm">
            <SimboloMaterial nome="conveyor_belt" className="text-4xl text-on-primary-container" />
          </div>
          <h1 className="text-headline-sm font-extrabold tracking-tighter text-on-surface">MontaControl</h1>
          <p className="text-label-md uppercase tracking-widest text-on-surface-variant/70">Operational Excellence</p>
        </header>

        {erro && (
          <div className="mb-24">
            <Alerta variante={erro.variante} mensagem={erro.mensagem} />
          </div>
        )}

        <form className="space-y-24" onSubmit={aoSubmeter}>
          <CampoTexto
            rotulo="E-mail"
            valor={email}
            aoAlterar={setEmail}
            tipo="email"
            placeholder="nome@empresa.com.br"
            iconeEsquerda="mail"
            obrigatorio
            desabilitado={carregando}
          />
          <CampoTexto
            rotulo="Senha"
            valor={senha}
            aoAlterar={setSenha}
            tipo="senha"
            placeholder="••••••••"
            iconeEsquerda="lock"
            obrigatorio
            desabilitado={carregando}
          />
          <Botao
            variante="primario"
            tamanho={56}
            forma="pilula"
            texto="Entrar"
            larguraTotal
            carregando={carregando}
            aoPressionar={() => void realizarLogin()}
          />
        </form>

        <footer className="mt-40 flex items-center justify-center gap-8">
          <span className="h-8 w-8 animate-pulse rounded-full bg-primary shadow-marca" aria-hidden="true" />
          <span className="text-label-sm uppercase tracking-widest text-on-surface-variant">
            Sistema de Gestão Ativo
          </span>
        </footer>
      </div>
    </main>
  )
}
