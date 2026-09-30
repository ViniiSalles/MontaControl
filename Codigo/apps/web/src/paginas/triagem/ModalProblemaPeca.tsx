import { useState } from 'react'
import { CampoAreaTexto } from '../../ui/CampoAreaTexto'
import { Modal } from '../../ui/Modal'

type TipoProblema = 'FALTANDO' | 'DEFEITO'

const OPCOES: { valor: TipoProblema; rotulo: string }[] = [
  { valor: 'FALTANDO', rotulo: 'Peça faltando' },
  { valor: 'DEFEITO', rotulo: 'Peça com defeito' },
]

interface PropsModalProblemaPeca {
  visivel: boolean
  descricaoPeca: string
  numeroPedido: string
  aoFechar: () => void
}

/**
 * Aviso de problema na peça para o gestor que criou o pedido. Só a casca visual:
 * o envio da mensagem ainda não existe, então "Enviar" apenas fecha o modal.
 */
export function ModalProblemaPeca({
  visivel,
  descricaoPeca,
  numeroPedido,
  aoFechar,
}: PropsModalProblemaPeca) {
  const [tipo, setTipo] = useState<TipoProblema>('FALTANDO')
  const [mensagem, setMensagem] = useState('')

  function fechar() {
    setTipo('FALTANDO')
    setMensagem('')
    aoFechar()
  }

  return (
    <Modal
      visivel={visivel}
      apresentacao="centro"
      titulo="Reportar problema na peça"
      aoFechar={fechar}
      acoes={[
        { texto: 'Cancelar', variante: 'fantasma', aoPressionar: fechar },
        { texto: 'Enviar', aoPressionar: fechar },
      ]}
      conteudo={
        <div className="space-y-16">
          <p className="text-body-md text-on-surface-variant">
            O aviso será enviado ao gestor responsável pelo pedido {numeroPedido}.
          </p>
          <p className="text-title-sm text-on-surface">{descricaoPeca}</p>
          <fieldset className="space-y-8">
            <legend className="px-4 text-label-lg uppercase text-on-surface-variant">Problema</legend>
            {OPCOES.map((opcao) => (
              <label key={opcao.valor} className="flex cursor-pointer items-center gap-8 text-body-md text-on-surface">
                <input
                  type="radio"
                  name="tipo-problema"
                  checked={tipo === opcao.valor}
                  onChange={() => setTipo(opcao.valor)}
                  className="accent-primary"
                />
                {opcao.rotulo}
              </label>
            ))}
          </fieldset>
          <CampoAreaTexto
            rotulo="Detalhes"
            placeholder="Descreva o que está faltando ou qual é o defeito"
            valor={mensagem}
            aoAlterar={setMensagem}
          />
        </div>
      }
    />
  )
}
