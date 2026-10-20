import { useEffect, useRef, useState } from 'react'
import { StatusAmbiente, StatusPeca } from '@montacontrol/shared'
import type { PecaDTO, PedidoComAmbientesDTO, PedidoResumoDTO, TipoAvariaDTO } from '@montacontrol/shared'
import { useAuth } from '../auth/AuthContext'
import { reportarAvaria, listarTiposAvaria } from '../api/avarias'
import { ErroApi } from '../api/clienteHttp'
import { associarCodigoBarras } from '../api/pecas'
import { buscarPedidoComAmbientes, listarPedidos } from '../api/pedidos'
import { progressoDoPedido } from '../formatacao/pedidos'
import { Alerta } from '../ui/Alerta'
import { BadgeStatus } from '../ui/BadgeStatus'
import { Botao } from '../ui/Botao'
import { Cartao } from '../ui/Cartao'
import { LayoutAutenticado } from './LayoutAutenticado'
import { ModalProblemaPeca, type DadosProblemaPeca } from './triagem/ModalProblemaPeca'

const ROTULO_STATUS_PECA: Record<StatusPeca, string> = {
  [StatusPeca.PENDENTE]: 'Pendente',
  [StatusPeca.TRIADA]: 'Triada',
  [StatusPeca.CARREGADA]: 'Carregada',
  [StatusPeca.DESCARREGADA]: 'Descarregada',
  [StatusPeca.INCONSISTENTE]: 'Inconsistente',
  [StatusPeca.ENTREGUE]: 'Entregue',
}

const ROTULO_STATUS_AMBIENTE: Record<StatusAmbiente, string> = {
  [StatusAmbiente.PENDENTE]: 'Pendente',
  [StatusAmbiente.EM_PROGRESSO]: 'Em progresso',
  [StatusAmbiente.COMPLETO]: 'Completo',
}

const mensagemDe = (causa: unknown, padrao: string) =>
  causa instanceof ErroApi ? causa.message : padrao

/** US07/UC09/UC10 — o operador abre um pedido, vê as peças cadastradas e associa o código de barras a cada uma. */
export default function Triagem() {
  const { sessao } = useAuth()
  const token = sessao?.accessToken ?? ''

  const [pedidos, setPedidos] = useState<PedidoResumoDTO[]>([])
  const [numeroSelecionado, setNumeroSelecionado] = useState<string | null>(null)
  const [pedido, setPedido] = useState<PedidoComAmbientesDTO | null>(null)
  const [codigos, setCodigos] = useState<Record<number, string>>({})
  const [enviandoId, setEnviandoId] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [pecaComProblema, setPecaComProblema] = useState<PecaDTO | null>(null)
  const [tiposAvaria, setTiposAvaria] = useState<TipoAvariaDTO[]>([])
  const painelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let ativo = true
    Promise.all([listarPedidos(token), listarTiposAvaria(token)])
      .then(([lista, tipos]) => {
        if (!ativo) return
        setPedidos(lista)
        setTiposAvaria(tipos)
      })
      .catch((causa: unknown) => {
        if (ativo) setErro(mensagemDe(causa, 'Falha ao carregar pedidos.'))
      })
    return () => {
      ativo = false
    }
  }, [token])

  async function aoReportarProblema(dados: DadosProblemaPeca) {
    if (!pecaComProblema) return
    try {
      await reportarAvaria(token, { idCliente: crypto.randomUUID(), pecaId: pecaComProblema.id, ...dados })
    } catch (causa: unknown) {
      throw new Error(mensagemDe(causa, 'Falha ao enviar o problema.'), { cause: causa })
    }
    setErro(null)
    setAviso(`Problema em ${pecaComProblema.descricao} enviado ao gestor.`)
  }

  async function aoSelecionar(numeroPedido: string) {
    setNumeroSelecionado(numeroPedido)
    setPedido(null)
    setCodigos({})
    setErro(null)
    setAviso(null)
    try {
      setPedido(await buscarPedidoComAmbientes(token, numeroPedido))
    } catch (causa: unknown) {
      setErro(mensagemDe(causa, 'Falha ao carregar as peças do pedido.'))
    }
  }

  async function aoAssociar(pecaId: number) {
    const codigo = (codigos[pecaId] ?? '').trim()
    if (!codigo || enviandoId !== null || !numeroSelecionado) return
    setErro(null)
    setAviso(null)
    setEnviandoId(pecaId)
    try {
      const peca = await associarCodigoBarras(token, pecaId, codigo)
      setCodigos((atuais) => ({ ...atuais, [pecaId]: '' }))
      setAviso(`Código ${peca.codigoBarras} associado a ${peca.descricao}.`)
      const [detalhe, lista] = await Promise.all([
        buscarPedidoComAmbientes(token, numeroSelecionado),
        listarPedidos(token),
      ])
      setPedido(detalhe)
      setPedidos(lista)
    } catch (causa: unknown) {
      setErro(mensagemDe(causa, 'Falha ao associar o código de barras.'))
    } finally {
      setEnviandoId(null)
      // Leitura contínua: o foco vai direto para a próxima peça pendente.
      requestAnimationFrame(() =>
        painelRef.current?.querySelector<HTMLInputElement>('input[data-codigo]')?.focus(),
      )
    }
  }

  return (
    <LayoutAutenticado itemAtivo="/triagem" titulo="Triagem de Peças">
      <div className="grid gap-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Cartao
          elevacao="elev1"
          tom="padrao"
          conteudo={
            <div className="space-y-16">
              <h2 className="text-title-md font-bold text-on-surface">Pedidos</h2>
              {pedidos.length === 0 ? (
                <p className="text-body-md text-on-surface-variant">Nenhum pedido cadastrado.</p>
              ) : (
                <ul className="space-y-8">
                  {pedidos.map((item) => {
                    const ativo = item.numeroPedido === numeroSelecionado
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => void aoSelecionar(item.numeroPedido)}
                          className={[
                            'flex w-full items-center justify-between rounded-lg px-16 py-12 text-left',
                            ativo
                              ? 'bg-primary-fixed text-on-primary-fixed-variant'
                              : 'bg-surface-container-low text-on-surface hover:bg-surface-container',
                          ].join(' ')}
                        >
                          <span>
                            <span className="block text-title-sm">{item.numeroPedido}</span>
                            <span className="block text-label-sm text-on-surface-variant">
                              {item.clienteNome}
                            </span>
                          </span>
                          <span className="whitespace-nowrap text-label-md">
                            {progressoDoPedido(item)}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          }
        />

        <div ref={painelRef} className="space-y-16">
          {erro && <Alerta variante="erro" mensagem={erro} />}
          {aviso && <Alerta variante="sucesso" mensagem={aviso} />}
          <Cartao
            elevacao="elev1"
            tom="padrao"
            conteudo={
              <div className="space-y-16">
                <h2 className="text-title-md font-bold text-on-surface">
                  {pedido ? `Peças do pedido ${pedido.numeroPedido}` : 'Peças do pedido'}
                </h2>
                {!pedido ? (
                  <p className="text-body-md text-on-surface-variant">
                    {numeroSelecionado
                      ? 'Carregando peças…'
                      : 'Selecione um pedido para ver as peças e associar os códigos de barras.'}
                  </p>
                ) : (
                  pedido.ambientes.map((ambiente) => (
                    <div key={ambiente.id} className="space-y-8">
                      <div className="flex items-center justify-between">
                        <h3 className="text-title-sm font-bold text-on-surface">{ambiente.nome}</h3>
                        <span className="text-label-sm font-bold uppercase text-on-surface-variant">
                          {ROTULO_STATUS_AMBIENTE[ambiente.status]}
                        </span>
                      </div>
                      <ul className="space-y-8">
                        {ambiente.pecas.map((peca) => (
                          <li
                            key={peca.id}
                            className="flex flex-wrap items-center gap-12 rounded-lg bg-surface-container-low px-16 py-8"
                          >
                            <span className="min-w-0 flex-1 text-body-md text-on-surface">
                              {peca.descricao}
                              {peca.quantidade > 1 && (
                                <span className="ml-8 text-label-md text-on-surface-variant">
                                  ({peca.quantidade} un.)
                                </span>
                              )}
                            </span>
                            <Botao
                              variante="icone"
                              tamanho={40}
                              forma="retangular"
                              icone="warning"
                              rotuloAcessivel={`Reportar problema em ${peca.descricao}`}
                              aoPressionar={() => setPecaComProblema(peca)}
                            />
                            {peca.status === StatusPeca.PENDENTE ? (
                              <form
                                className="flex items-center gap-8"
                                onSubmit={(evento) => {
                                  evento.preventDefault()
                                  void aoAssociar(peca.id)
                                }}
                              >
                                <input
                                  data-codigo
                                  type="text"
                                  aria-label={`Código de barras de ${peca.descricao}`}
                                  placeholder="Bipe ou digite o código"
                                  disabled={enviandoId !== null}
                                  value={codigos[peca.id] ?? ''}
                                  onChange={(evento) => {
                                    const valor = evento.target.value
                                    setCodigos((atuais) => ({ ...atuais, [peca.id]: valor }))
                                  }}
                                  className="h-alturaCampo w-56 rounded-lg border-none bg-white px-16 text-on-surface placeholder:text-outline/50 focus:shadow-md focus:outline-none disabled:opacity-50"
                                />
                                <Botao
                                  variante="primario"
                                  tamanho={40}
                                  forma="retangular"
                                  texto="Associar"
                                  carregando={enviandoId === peca.id}
                                  desabilitado={
                                    enviandoId !== null || !(codigos[peca.id] ?? '').trim()
                                  }
                                  aoPressionar={() => void aoAssociar(peca.id)}
                                />
                              </form>
                            ) : (
                              <span className="flex items-center gap-8 text-label-sm text-on-surface-variant">
                                {peca.codigoBarras}
                                <BadgeStatus variante="sucesso" texto={ROTULO_STATUS_PECA[peca.status]} />
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            }
          />
        </div>
      </div>
      <ModalProblemaPeca
        visivel={pecaComProblema !== null}
        descricaoPeca={pecaComProblema?.descricao ?? ''}
        numeroPedido={pedido?.numeroPedido ?? ''}
        tipos={tiposAvaria}
        aoEnviar={aoReportarProblema}
        aoFechar={() => setPecaComProblema(null)}
      />
    </LayoutAutenticado>
  )
}
