import { Injectable } from '@nestjs/common';
import type { PecaDTO, TriarPecaRequest } from '@montacontrol/shared';
import { AmbientesRepository } from '../ambientes/ambientes.repository';
import { PedidoNaoEncontradoException } from '../pedidos/exceptions/pedido-nao-encontrado.exception';
import { PedidosRepository } from '../pedidos/pedidos.repository';
import { PecaDuplicadaException } from './exceptions/peca-duplicada.exception';
import { PecasRepository } from './pecas.repository';

@Injectable()
export class PecasService {
  constructor(
    private readonly pecas: PecasRepository,
    private readonly ambientes: AmbientesRepository,
    private readonly pedidos: PedidosRepository,
  ) {}

  /**
   * US07/UC09/UC10: ler o código de barras, confirmar pedido e ambiente,
   * salvar. A peça nasce direto em TRIADA — não existe linha intermediária
   * "aguardando triagem"; o cadastro É a triagem.
   */
  async triar(usuarioId: number, dados: TriarPecaRequest): Promise<PecaDTO> {
    const pedido = await this.pedidos.buscarPorNumero(dados.numeroPedido);
    if (!pedido) throw new PedidoNaoEncontradoException();

    const duplicada = await this.pecas.buscarPorCodigoBarras(dados.codigoBarras);
    if (duplicada) throw new PecaDuplicadaException();

    const ambiente = await this.ambientes.buscarOuCriar(pedido.id, dados.ambiente.trim());
    await this.pedidos.marcarEmTriagem(pedido.id);

    const peca = await this.pecas.criar({
      ambienteId: ambiente.id,
      codigoBarras: dados.codigoBarras,
      descricao: dados.descricao,
      triadaPor: usuarioId,
    });
    // Corrida rara: duas leituras do mesmo código de barras entre a checagem
    // acima e o `create`. O repositório devolve `null`, não estoura — vira o
    // mesmo 409 que a checagem antecipada.
    if (!peca) throw new PecaDuplicadaException();

    return peca;
  }
}
