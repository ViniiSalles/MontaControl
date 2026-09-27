import { useState } from 'react'
import { cpfValido } from '@montacontrol/shared'
import { Alerta } from '../../ui/Alerta'
import { CampoTexto } from '../../ui/CampoTexto'
import { Modal } from '../../ui/Modal'

interface PropsModalInformarCpf {
  nome: string
  erro: string | null
  aoFechar: () => void
  aoConfirmar: (cpf: string) => Promise<void>
}

/** Renderizado só enquanto aberto (estado zera a cada abertura). */
export function ModalInformarCpf({ nome, erro, aoFechar, aoConfirmar }: PropsModalInformarCpf) {
  const [cpf, setCpf] = useState('')
  const [erroLocal, setErroLocal] = useState<string | undefined>()
  const [salvando, setSalvando] = useState(false)

  async function confirmar() {
    if (salvando) return
    if (!cpfValido(cpf)) {
      setErroLocal('CPF inválido')
      return
    }
    setSalvando(true)
    try {
      await aoConfirmar(cpf)
    } catch {
      // a página guarda a mensagem em `erro`
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      visivel
      apresentacao="centro"
      titulo={`Informar CPF de ${nome}`}
      aoFechar={aoFechar}
      acoes={[
        { texto: 'Cancelar', variante: 'fantasma', aoPressionar: aoFechar },
        { texto: salvando ? 'Salvando…' : 'Salvar CPF', aoPressionar: () => void confirmar() },
      ]}
      conteudo={
        <div className="space-y-16">
          {erro && <Alerta variante="erro" mensagem={erro} />}
          <CampoTexto
            rotulo="CPF"
            placeholder="000.000.000-00"
            valor={cpf}
            aoAlterar={(valor) => {
              setCpf(valor)
              setErroLocal(undefined)
            }}
            erro={erroLocal}
            obrigatorio
          />
        </div>
      }
    />
  )
}
