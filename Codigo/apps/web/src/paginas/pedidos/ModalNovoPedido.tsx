import { useId, useState } from 'react'
import type { ClienteResumoDTO, CriarPedidoRequest } from '@montacontrol/shared'
import {
  converterRascunhoPedido,
  validarRascunhoPedido,
  type RascunhoPedido,
} from '../../formatacao/pedidos'
import { Alerta } from '../../ui/Alerta'
import { Botao } from '../../ui/Botao'
import { CampoTexto } from '../../ui/CampoTexto'
import { Modal } from '../../ui/Modal'

const VAZIO: RascunhoPedido = {
  clienteId: null,
  ambientes: [{ nome: '', itens: [{ descricao: '', quantidade: '1' }] }],
}

interface PropsModalNovoPedido {
  visivel: boolean
  clientes: ClienteResumoDTO[]
  /** Erro do último envio — a página guarda a mensagem, o modal só mostra. */
  erro: string | null
  aoFechar: () => void
  /** Rejeita quando o cadastro falha, para o modal continuar aberto com os dados. */
  aoCadastrar: (dados: CriarPedidoRequest) => Promise<void>
}

export function ModalNovoPedido({
  visivel,
  clientes,
  erro,
  aoFechar,
  aoCadastrar,
}: PropsModalNovoPedido) {
  const idCliente = useId()
  const [rascunho, setRascunho] = useState<RascunhoPedido>(VAZIO)
  const [erroValidacao, setErroValidacao] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  function alterarAmbiente(indice: number, nome: string) {
    setRascunho((atual) => ({
      ...atual,
      ambientes: atual.ambientes.map((ambiente, posicao) =>
        posicao === indice ? { ...ambiente, nome } : ambiente,
      ),
    }))
  }

  function alterarItem(
    indiceAmbiente: number,
    indiceItem: number,
    campo: 'descricao' | 'quantidade',
    valor: string,
  ) {
    setRascunho((atual) => ({
      ...atual,
      ambientes: atual.ambientes.map((ambiente, posicao) =>
        posicao === indiceAmbiente
          ? {
              ...ambiente,
              itens: ambiente.itens.map((item, posicaoItem) =>
                posicaoItem === indiceItem ? { ...item, [campo]: valor } : item,
              ),
            }
          : ambiente,
      ),
    }))
  }

  function adicionarItem(indiceAmbiente: number) {
    setRascunho((atual) => ({
      ...atual,
      ambientes: atual.ambientes.map((ambiente, posicao) =>
        posicao === indiceAmbiente
          ? { ...ambiente, itens: [...ambiente.itens, { descricao: '', quantidade: '1' }] }
          : ambiente,
      ),
    }))
  }

  function removerItem(indiceAmbiente: number, indiceItem: number) {
    setRascunho((atual) => ({
      ...atual,
      ambientes: atual.ambientes.map((ambiente, posicao) =>
        posicao === indiceAmbiente
          ? {
              ...ambiente,
              itens: ambiente.itens.filter((_, posicaoItem) => posicaoItem !== indiceItem),
            }
          : ambiente,
      ),
    }))
  }

  function adicionarAmbiente() {
    setRascunho((atual) => ({
      ...atual,
      ambientes: [...atual.ambientes, { nome: '', itens: [{ descricao: '', quantidade: '1' }] }],
    }))
  }

  function removerAmbiente(indice: number) {
    setRascunho((atual) => ({
      ...atual,
      ambientes: atual.ambientes.filter((_, posicao) => posicao !== indice),
    }))
  }

  async function aoConfirmar() {
    if (salvando) return
    const problema = validarRascunhoPedido(rascunho)
    setErroValidacao(problema)
    if (problema) return

    setSalvando(true)
    try {
      await aoCadastrar(converterRascunhoPedido(rascunho))
      setRascunho(VAZIO)
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
      titulo="Novo Pedido"
      aoFechar={aoFechar}
      acoes={[
        { texto: 'Cancelar', variante: 'fantasma', aoPressionar: aoFechar },
        { texto: salvando ? 'Cadastrando…' : 'Cadastrar', aoPressionar: () => void aoConfirmar() },
      ]}
      conteudo={
        <div className="space-y-24">
          {erro && <Alerta variante="erro" mensagem={erro} />}
          {erroValidacao && <Alerta variante="aviso" mensagem={erroValidacao} />}

          <div className="space-y-6">
            <label
              htmlFor={idCliente}
              className="block px-4 text-label-lg uppercase text-on-surface-variant"
            >
              Cliente da obra <span aria-hidden="true">*</span>
            </label>
            <select
              id={idCliente}
              value={rascunho.clienteId ?? ''}
              onChange={(evento) =>
                setRascunho((atual) => ({
                  ...atual,
                  clienteId: evento.target.value ? Number(evento.target.value) : null,
                }))
              }
              className="h-alturaCampo w-full rounded-lg border-none bg-surface-container-low px-16 text-on-surface shadow-sm transition-all focus:bg-white focus:shadow-md focus:outline-none"
            >
              <option value="">Selecione…</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome} — {cliente.cidade}/{cliente.estado}
                </option>
              ))}
            </select>
          </div>

          {rascunho.ambientes.map((ambiente, indiceAmbiente) => (
            <section
              key={indiceAmbiente}
              className="space-y-16 rounded-lg bg-surface-container-low p-16"
            >
              <div className="flex items-end gap-12">
                <div className="flex-1">
                  <CampoTexto
                    rotulo={`Ambiente ${indiceAmbiente + 1}`}
                    placeholder="Cozinha"
                    valor={ambiente.nome}
                    aoAlterar={(valor) => alterarAmbiente(indiceAmbiente, valor)}
                    obrigatorio
                  />
                </div>
                {rascunho.ambientes.length > 1 && (
                  <Botao
                    variante="icone"
                    tamanho={40}
                    forma="retangular"
                    icone="close"
                    rotuloAcessivel={`Remover ambiente ${indiceAmbiente + 1}`}
                    aoPressionar={() => removerAmbiente(indiceAmbiente)}
                  />
                )}
              </div>

              {ambiente.itens.map((item, indiceItem) => (
                <div key={indiceItem} className="flex items-end gap-12">
                  <div className="flex-1">
                    <CampoTexto
                      rotulo={`Peça ${indiceItem + 1}`}
                      placeholder="Porta 90cm"
                      valor={item.descricao}
                      aoAlterar={(valor) =>
                        alterarItem(indiceAmbiente, indiceItem, 'descricao', valor)
                      }
                      obrigatorio
                    />
                  </div>
                  <div className="w-96">
                    <CampoTexto
                      rotulo="Qtd."
                      tipo="numero"
                      valor={item.quantidade}
                      aoAlterar={(valor) =>
                        alterarItem(indiceAmbiente, indiceItem, 'quantidade', valor)
                      }
                      obrigatorio
                    />
                  </div>
                  {ambiente.itens.length > 1 && (
                    <Botao
                      variante="icone"
                      tamanho={40}
                      forma="retangular"
                      icone="close"
                      rotuloAcessivel={`Remover peça ${indiceItem + 1} do ambiente ${indiceAmbiente + 1}`}
                      aoPressionar={() => removerItem(indiceAmbiente, indiceItem)}
                    />
                  )}
                </div>
              ))}

              <Botao
                variante="fantasma"
                tamanho={40}
                forma="retangular"
                icone="add"
                texto="Adicionar peça"
                aoPressionar={() => adicionarItem(indiceAmbiente)}
              />
            </section>
          ))}

          <Botao
            variante="tonal"
            tamanho={40}
            forma="retangular"
            icone="add"
            texto="Adicionar ambiente"
            aoPressionar={adicionarAmbiente}
          />
        </div>
      }
    />
  )
}
