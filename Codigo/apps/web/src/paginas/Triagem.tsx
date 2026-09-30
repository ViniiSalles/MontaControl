import { useRef, useState } from 'react'
import { StatusAmbiente, StatusPeca } from '@montacontrol/shared'
import type { PecaDTO, PedidoComAmbientesDTO } from '@montacontrol/shared'
import { useAuth } from '../auth/AuthContext'
import { ErroApi } from '../api/clienteHttp'
import { buscarPedidoComAmbientes } from '../api/pedidos'
import { triarPeca } from '../api/pecas'
import { Alerta } from '../ui/Alerta'
import { Botao } from '../ui/Botao'
import { CampoTexto } from '../ui/CampoTexto'
import { Cartao } from '../ui/Cartao'
import { LayoutAutenticado } from './LayoutAutenticado'

const ROTULO_STATUS_PECA: Record<StatusPeca, string> = {
  [StatusPeca.PENDENTE]: 'Pendente',
  [StatusPeca.TRIADA]: 'Triada',
  [StatusPeca.CARREGADA]: 'Carregada',
  [StatusPeca.ENTREGUE]: 'Entregue',
}

const ROTULO_STATUS_AMBIENTE: Record<StatusAmbiente, string> = {
  [StatusAmbiente.PENDENTE]: 'Pendente',
  [StatusAmbiente.EM_PROGRESSO]: 'Em progresso',
  [StatusAmbiente.COMPLETO]: 'Completo',
}

interface PecaRecente extends PecaDTO {
  ambienteNome: string
}

/** US07/UC09/UC10 — triagem de peças por código de barras (Figura 28). */
export default function Triagem() {
  const { sessao } = useAuth()
  const token = sessao?.accessToken ?? ''

  const [numeroPedido, setNumeroPedido] = useState('')
  const [ambiente, setAmbiente] = useState('')
  const [codigoBarras, setCodigoBarras] = useState('')
  const [descricao, setDescricao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [recentes, setRecentes] = useState<PecaRecente[]>([])
  const [pedido, setPedido] = useState<PedidoComAmbientesDTO | null>(null)
  const campoCodigoBarrasRef = useRef<HTMLInputElement>(null)

  const pedidoConfirmado = numeroPedido.trim().length > 0 && ambiente.trim().length > 0

  async function atualizarConferencia(numero: string) {
    try {
      setPedido(await buscarPedidoComAmbientes(token, numero))
    } catch {
      // A conferência é um bônus visual — uma falha aqui não pode interromper a leitura contínua.
    }
  }

  async function aoTriar() {
    if (!pedidoConfirmado || !codigoBarras.trim() || enviando) return
    setErro(null)
    setEnviando(true)
    try {
      const numero = numeroPedido.trim()
      const ambienteConfirmado = ambiente.trim()
      const peca = await triarPeca(token, {
        codigoBarras: codigoBarras.trim(),
        descricao: descricao.trim(),
        numeroPedido: numero,
        ambiente: ambienteConfirmado,
      })
      setRecentes((atuais) => [{ ...peca, ambienteNome: ambienteConfirmado }, ...atuais])
      setCodigoBarras('')
      setDescricao('')
      await atualizarConferencia(numero)
    } catch (causa: unknown) {
      setErro(causa instanceof ErroApi ? causa.message : 'Falha ao cadastrar a peça.')
    } finally {
      setEnviando(false)
      campoCodigoBarrasRef.current?.focus()
    }
  }

  return (
    <LayoutAutenticado itemAtivo="/triagem" titulo="Triagem de Peças">
      <div className="grid gap-24 lg:grid-cols-2">
        <div className="space-y-24">
          <Cartao
            elevacao="elev1"
            tom="padrao"
            conteudo={
              <div className="space-y-16">
                <h1 className="text-title-lg font-bold text-on-surface">Triagem de Peças</h1>
                <p className="text-body-md text-on-surface-variant">
                  Confirme o pedido e o ambiente de destino; a leitura do código de barras cadastra e
                  agrupa cada peça automaticamente.
                </p>
                {erro && <Alerta variante="erro" mensagem={erro} />}
                <div className="grid gap-16 sm:grid-cols-2">
                  <CampoTexto
                    rotulo="Número do pedido"
                    placeholder="PED-0001"
                    valor={numeroPedido}
                    aoAlterar={setNumeroPedido}
                    obrigatorio
                  />
                  <CampoTexto
                    rotulo="Ambiente de destino"
                    placeholder="Cozinha"
                    valor={ambiente}
                    aoAlterar={setAmbiente}
                    obrigatorio
                  />
                </div>
              </div>
            }
          />

          <Cartao
            elevacao="elev1"
            tom="padrao"
            conteudo={
              <form
                className="space-y-16"
                onSubmit={(evento) => {
                  evento.preventDefault()
                  void aoTriar()
                }}
              >
                <h2 className="text-title-md font-bold text-on-surface">Leitura de código de barras</h2>
                {!pedidoConfirmado && (
                  <p className="text-body-md text-on-surface-variant">
                    Informe o pedido e o ambiente acima para liberar a leitura.
                  </p>
                )}
                <div className="space-y-6">
                  <label
                    htmlFor="campo-codigo-barras"
                    className="block px-4 text-label-lg uppercase text-on-surface-variant"
                  >
                    Código de barras <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="campo-codigo-barras"
                    ref={campoCodigoBarrasRef}
                    type="text"
                    autoFocus
                    disabled={!pedidoConfirmado || enviando}
                    placeholder="Bipe ou digite o código de barras"
                    value={codigoBarras}
                    onChange={(evento) => setCodigoBarras(evento.target.value)}
                    className="h-alturaCampo w-full rounded-lg border-none bg-surface-container-low px-16 text-on-surface placeholder:text-outline/50 focus:bg-white focus:shadow-md focus:outline-none disabled:opacity-50"
                  />
                </div>
                <CampoTexto
                  rotulo="Descrição da peça"
                  placeholder="Porta de armário"
                  valor={descricao}
                  aoAlterar={setDescricao}
                  desabilitado={!pedidoConfirmado || enviando}
                  obrigatorio
                />
                <Botao
                  variante="primario"
                  tamanho={48}
                  forma="retangular"
                  texto="Cadastrar peça"
                  icone="barcode_scanner"
                  carregando={enviando}
                  desabilitado={!pedidoConfirmado || !codigoBarras.trim() || !descricao.trim()}
                  larguraTotal
                  aoPressionar={() => void aoTriar()}
                />
              </form>
            }
          />

          {recentes.length > 0 && (
            <Cartao
              elevacao="elev1"
              tom="padrao"
              conteudo={
                <div className="space-y-16">
                  <h2 className="text-title-md font-bold text-on-surface">
                    Triadas nesta sessão ({recentes.length})
                  </h2>
                  <ul className="space-y-8">
                    {recentes.map((peca) => (
                      <li
                        key={peca.id}
                        className="flex items-center justify-between rounded-lg bg-surface-container-low px-16 py-8"
                      >
                        <div>
                          <p className="text-body-md text-on-surface">{peca.descricao}</p>
                          <p className="text-label-sm text-on-surface-variant">
                            {peca.codigoBarras} · {peca.ambienteNome}
                          </p>
                        </div>
                        <span className="text-label-sm font-bold uppercase text-primary">
                          {ROTULO_STATUS_PECA[peca.status]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              }
            />
          )}
        </div>

        <Cartao
          elevacao="elev1"
          tom="padrao"
          conteudo={
            <div className="space-y-16">
              <h2 className="text-title-md font-bold text-on-surface">Conferência do pedido</h2>
              {!pedido ? (
                <p className="text-body-md text-on-surface-variant">
                  A conferência aparece aqui após a primeira peça triada do pedido.
                </p>
              ) : (
                <div className="space-y-16">
                  <p className="text-body-md text-on-surface-variant">Pedido {pedido.numeroPedido}</p>
                  {pedido.ambientes.map((ambienteDoPedido) => (
                    <div key={ambienteDoPedido.id} className="space-y-8">
                      <div className="flex items-center justify-between">
                        <h3 className="text-title-sm font-bold text-on-surface">{ambienteDoPedido.nome}</h3>
                        <span className="text-label-sm font-bold uppercase text-on-surface-variant">
                          {ROTULO_STATUS_AMBIENTE[ambienteDoPedido.status]}
                        </span>
                      </div>
                      <table className="w-full text-body-md text-on-surface">
                        <tbody>
                          {ambienteDoPedido.pecas.map((peca) => (
                            <tr key={peca.id} className="border-t border-outline-variant/30">
                              <td className="py-8">{peca.descricao}</td>
                              <td className="py-8 text-right text-label-sm text-on-surface-variant">
                                {peca.codigoBarras}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </div>
          }
        />
      </div>
    </LayoutAutenticado>
  )
}
