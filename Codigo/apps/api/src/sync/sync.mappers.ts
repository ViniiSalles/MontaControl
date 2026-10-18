import type {
  SyncAmbienteRow,
  SyncAtestadoRow,
  SyncAvariaRow,
  SyncBancoHorasRow,
  SyncJornadaRow,
  SyncPecaRow,
  SyncPedidoRow,
  SyncTipoAvariaRow,
} from '@montacontrol/shared';
import type { AmbienteParaSync } from '../ambientes/ambientes.repository';
import type { AtestadoParaSync } from '../atestados/atestados.repository';
import type { AvariaParaSync } from '../avarias/avarias.repository';
import type { TipoAvariaParaSync } from '../avarias/tipos-avaria.repository';
import type { BancoHorasParaSync } from '../banco-horas/banco-horas.repository';
import type { JornadaParaSync } from '../jornadas/jornadas.repository';
import type { PecaParaSync } from '../pecas/pecas.repository';
import type { PedidoParaSync } from '../pedidos/pedidos.repository';

// Contrato de `@montacontrol/shared/sync`: colunas em snake_case, ids como
// string, instantes em ISO 8601, datas civis em YYYY-MM-DD.

const paraId = (id: number): string => String(id);
const paraIso = (data: Date): string => data.toISOString();
const paraIsoOuNulo = (data: Date | null): string | null => (data ? paraIso(data) : null);
/** Coluna `DATE` volta como meia-noite UTC do dia civil. */
const paraDiaCivil = (data: Date): string => data.toISOString().slice(0, 10);

export function paraLinhaJornada(jornada: JornadaParaSync): SyncJornadaRow {
  return {
    id: paraId(jornada.id),
    usuario_id: jornada.usuarioId,
    pedido_id: jornada.pedidoId === null ? null : paraId(jornada.pedidoId),
    status: jornada.status,
    checkin_at: paraIsoOuNulo(jornada.checkinAt),
    checkin_latitude: jornada.checkinLatitude,
    checkin_longitude: jornada.checkinLongitude,
    checkin_endereco: jornada.checkinEndereco,
    checkin_id_cliente: jornada.checkinIdCliente,
    checkout_at: paraIsoOuNulo(jornada.checkoutAt),
    checkout_latitude: jornada.checkoutLatitude,
    checkout_longitude: jornada.checkoutLongitude,
    checkout_endereco: jornada.checkoutEndereco,
    checkout_id_cliente: jornada.checkoutIdCliente,
    lancado_em_atraso: jornada.lancadoEmAtraso,
    criado_em: paraIso(jornada.criadoEm),
  };
}

export function paraLinhaBancoHoras(banco: BancoHorasParaSync): SyncBancoHorasRow {
  return {
    id: paraId(banco.id),
    mes: banco.mes,
    ano: banco.ano,
    horas_trabalhadas: banco.horasTrabalhadas,
    horas_previstas: banco.horasPrevistas,
    saldo: banco.saldo,
  };
}

export function paraLinhaPedido(pedido: PedidoParaSync): SyncPedidoRow {
  return {
    id: paraId(pedido.id),
    numero_pedido: pedido.numeroPedido,
    status: pedido.status,
    cliente_id: paraId(pedido.clienteId),
    cliente_nome: pedido.clienteNome,
    cliente_endereco: pedido.clienteEndereco,
    cliente_cidade: pedido.clienteCidade,
    cliente_estado: pedido.clienteEstado,
    cliente_latitude: pedido.clienteLatitude,
    cliente_longitude: pedido.clienteLongitude,
  };
}

export function paraLinhaAmbiente(ambiente: AmbienteParaSync): SyncAmbienteRow {
  return {
    id: paraId(ambiente.id),
    pedido_id: paraId(ambiente.pedidoId),
    nome: ambiente.nome,
    status: ambiente.status,
  };
}

export function paraLinhaPeca(peca: PecaParaSync): SyncPecaRow {
  return {
    id: paraId(peca.id),
    ambiente_id: paraId(peca.ambienteId),
    codigo_barras: peca.codigoBarras,
    descricao: peca.descricao,
    quantidade: peca.quantidade,
    status: peca.status,
  };
}

export function paraLinhaTipoAvaria(tipo: TipoAvariaParaSync): SyncTipoAvariaRow {
  return { id: paraId(tipo.id), nome: tipo.nome, descricao: tipo.descricao };
}

export function paraLinhaAvaria(avaria: AvariaParaSync): SyncAvariaRow {
  return {
    id: paraId(avaria.id),
    id_cliente: avaria.idCliente,
    peca_id: paraId(avaria.pecaId),
    peca_descricao: avaria.pecaDescricao,
    ambiente_nome: avaria.ambienteNome,
    numero_pedido: avaria.numeroPedido,
    tipo_avaria_id: paraId(avaria.tipoAvariaId),
    descricao: avaria.descricao,
    status: avaria.status,
    analisada_em: paraIsoOuNulo(avaria.analisadaEm),
    parecer: avaria.parecer,
    criado_em: paraIso(avaria.criadoEm),
  };
}

export function paraLinhaAtestado(atestado: AtestadoParaSync): SyncAtestadoRow {
  return {
    id: paraId(atestado.id),
    id_cliente: atestado.idCliente,
    data_inicio: paraDiaCivil(atestado.dataInicio),
    data_fim: paraDiaCivil(atestado.dataFim),
    observacao: atestado.observacao,
    status: atestado.status,
    motivo_rejeicao: atestado.motivoRejeicao,
    validado_em: paraIsoOuNulo(atestado.validadoEm),
    criado_em: paraIso(atestado.criadoEm),
  };
}
