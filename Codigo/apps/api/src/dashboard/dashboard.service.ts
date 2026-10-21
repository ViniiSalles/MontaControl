import { Injectable } from '@nestjs/common';
import { comporInstante, diaNoFuso, somarDias } from '@montacontrol/shared';
import type {
  AcompanhamentoPedidoDTO,
  AlertaDashboardDTO,
  DashboardDTO,
  EtapaPedido,
  ProdutividadeDiaDTO,
} from '@montacontrol/shared';
import { StatusPeca } from '../../generated/prisma';
import { FUSO_OPERACAO } from '../common/fuso';
import { DashboardRepository } from './dashboard.repository';
import type {
  EventoDeBipagem,
  EventosRecentes,
  PedidoParaAcompanhamento,
} from './dashboard.repository';

const DIAS_DE_PRODUTIVIDADE = 7;
const LIMITE_DE_ALERTAS = 30;
const LIMITE_DE_BIPAGENS = 500;
/** Leituras do mesmo pedido com intervalo maior que este são outra leva (outro caminhão, outro dia). */
const INTERVALO_ENTRE_LEVAS_MS = 60 * 60 * 1000;
const DIAS_DE_ANTECEDENCIA_EPI = 30;

const NO_CLIENTE = new Set<StatusPeca>([StatusPeca.DESCARREGADA, StatusPeca.ENTREGUE]);

/** Ver `EtapaPedido`: o estoque conta antes do cliente, e pedido sem peça ainda aguarda a fábrica. */
export function etapaDoPedido(total: number, noEstoque: number, noCliente: number): EtapaPedido {
  if (total === 0 || noEstoque === 0) return 'AGUARDANDO_FABRICA';
  if (noCliente === total) return 'NO_CLIENTE';
  if (noCliente > 0) return 'EM_DESCARREGAMENTO';
  if (noEstoque === total) return 'NO_ESTOQUE';
  return 'EM_TRIAGEM';
}

function maisRecente(instantes: readonly (Date | null)[]): string | null {
  let maior: Date | null = null;
  for (const instante of instantes) {
    if (instante && (!maior || instante > maior)) maior = instante;
  }
  return maior?.toISOString() ?? null;
}

export function montarAcompanhamento(pedido: PedidoParaAcompanhamento): AcompanhamentoPedidoDTO {
  const { pecas } = pedido;
  const totalPecas = pecas.length;
  // Toda peça que saiu de PENDENTE passou pela triagem, mesmo que já tenha seguido adiante.
  const pecasNoEstoque = pecas.filter((peca) => peca.status !== StatusPeca.PENDENTE).length;
  const pecasNoCliente = pecas.filter((peca) => NO_CLIENTE.has(peca.status)).length;

  return {
    pedidoId: pedido.id,
    numeroPedido: pedido.numeroPedido,
    statusPedido: pedido.status,
    cliente: pedido.cliente,
    montadores: pedido.montadores,
    etapa: etapaDoPedido(totalPecas, pecasNoEstoque, pecasNoCliente),
    totalPecas,
    pecasNoEstoque,
    pecasNoCliente,
    pecasInconsistentes: pecas.filter((peca) => peca.status === StatusPeca.INCONSISTENTE).length,
    avariasAbertas: pecas.reduce((soma, peca) => soma + peca.avariasAbertas, 0),
    ultimaTriagemEm: maisRecente(pecas.map((peca) => peca.triadaAt)),
    ultimoDescarregamentoEm: maisRecente(pecas.map((peca) => peca.conferidaAt)),
  };
}

function pecasNoPlural(quantidade: number): string {
  return quantidade === 1 ? '1 peça' : `${quantidade} peças`;
}

interface Leva {
  numeroPedido: string;
  pedidoId: number;
  quantidade: number;
  responsaveis: Set<string>;
  inicio: Date;
  em: Date;
}

/**
 * Bipagens peça a peça viram um alerta por leva — 40 leituras do mesmo
 * caminhão são um evento para o gestor, não 40. Uma leva é uma sequência de
 * leituras do mesmo pedido sem pausa maior que `INTERVALO_ENTRE_LEVAS_MS`.
 */
function agruparBipagens(
  eventos: readonly EventoDeBipagem[],
): {
  numeroPedido: string;
  pedidoId: number;
  quantidade: number;
  responsaveis: string[];
  inicio: Date;
  em: Date;
}[] {
  const emOrdem = [...eventos].sort((a, b) => a.em.getTime() - b.em.getTime());
  const levaAberta = new Map<number, Leva>();
  const levas: Leva[] = [];
  for (const evento of emOrdem) {
    let leva = levaAberta.get(evento.pedidoId);
    if (!leva || evento.em.getTime() - leva.em.getTime() > INTERVALO_ENTRE_LEVAS_MS) {
      leva = {
        numeroPedido: evento.numeroPedido,
        pedidoId: evento.pedidoId,
        quantidade: 0,
        responsaveis: new Set<string>(),
        inicio: evento.em,
        em: evento.em,
      };
      levaAberta.set(evento.pedidoId, leva);
      levas.push(leva);
    }
    leva.quantidade += 1;
    if (evento.responsavel) leva.responsaveis.add(evento.responsavel);
    leva.em = evento.em;
  }
  return levas.map((leva) => ({ ...leva, responsaveis: [...leva.responsaveis].sort() }));
}

function porQuem(responsaveis: readonly string[]): string {
  return responsaveis.length > 0 ? ` por ${responsaveis.join(', ')}` : '';
}

function obra(numeroPedido: string | null): string {
  return numeroPedido ? ` na obra do pedido ${numeroPedido}` : '';
}

export function montarAlertas(eventos: EventosRecentes): AlertaDashboardDTO[] {
  const alertas: AlertaDashboardDTO[] = [
    ...eventos.inconsistencias.map((evento) => ({
      id: `inconsistencia-${evento.pecaId}`,
      tipo: 'INCONSISTENCIA' as const,
      titulo: 'Peça na obra errada',
      descricao: `${evento.pecaDescricao}${evento.codigoBarras ? ` (${evento.codigoBarras})` : ''}, do pedido ${evento.numeroPedido}, foi bipada no descarregamento de outro pedido.`,
      em: evento.em.toISOString(),
    })),
    ...eventos.avarias.map((evento) => ({
      id: `avaria-${evento.avariaId}`,
      tipo: 'AVARIA' as const,
      titulo: 'Avaria reportada',
      descricao: `${evento.tipo}: ${evento.pecaDescricao} (pedido ${evento.numeroPedido}), por ${evento.montador}.`,
      em: evento.em.toISOString(),
    })),
    ...agruparBipagens(eventos.descarregamentos).map((grupo) => ({
      id: `descarregamento-${grupo.pedidoId}-${grupo.inicio.getTime()}`,
      tipo: 'DESCARREGAMENTO' as const,
      titulo: 'Descarregamento no cliente',
      descricao: `Pedido ${grupo.numeroPedido}: ${pecasNoPlural(grupo.quantidade)} conferida(s) na obra${porQuem(grupo.responsaveis)}.`,
      em: grupo.em.toISOString(),
    })),
    ...agruparBipagens(eventos.triagens).map((grupo) => ({
      id: `triagem-${grupo.pedidoId}-${grupo.inicio.getTime()}`,
      tipo: 'TRIAGEM' as const,
      titulo: 'Chegada ao estoque',
      descricao: `Pedido ${grupo.numeroPedido}: ${pecasNoPlural(grupo.quantidade)} bipada(s) na triagem${porQuem(grupo.responsaveis)}.`,
      em: grupo.em.toISOString(),
    })),
    ...eventos.checkins.map((evento) => ({
      id: `checkin-${evento.jornadaId}`,
      tipo: 'CHECKIN' as const,
      titulo: 'Check-in',
      descricao: `${evento.montador} iniciou a jornada${obra(evento.numeroPedido)}.`,
      em: evento.em.toISOString(),
    })),
    ...eventos.checkouts.map((evento) => ({
      id: `checkout-${evento.jornadaId}`,
      tipo: 'CHECKOUT' as const,
      titulo: 'Check-out',
      descricao: `${evento.montador} encerrou a jornada${obra(evento.numeroPedido)}.`,
      em: evento.em.toISOString(),
    })),
  ];

  return alertas.sort((a, b) => b.em.localeCompare(a.em)).slice(0, LIMITE_DE_ALERTAS);
}

/** Últimos `DIAS_DE_PRODUTIVIDADE` dias civis (no fuso da operação) até `hoje`, inclusive. */
export function montarProdutividade(
  hoje: string,
  triagens: readonly Date[],
  descarregamentos: readonly Date[],
): ProdutividadeDiaDTO[] {
  const dias = Array.from({ length: DIAS_DE_PRODUTIVIDADE }, (_, indice) =>
    somarDias(hoje, indice - (DIAS_DE_PRODUTIVIDADE - 1)),
  );
  const contar = (instantes: readonly Date[]) => {
    const porDia = new Map<string, number>();
    for (const instante of instantes) {
      const dia = diaNoFuso(instante.toISOString(), FUSO_OPERACAO);
      porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
    }
    return porDia;
  };
  const triadasPorDia = contar(triagens);
  const descarregadasPorDia = contar(descarregamentos);

  return dias.map((dia) => ({
    dia,
    pecasTriadas: triadasPorDia.get(dia) ?? 0,
    pecasDescarregadas: descarregadasPorDia.get(dia) ?? 0,
  }));
}

@Injectable()
export class DashboardService {
  constructor(private readonly dashboard: DashboardRepository) {}

  /**
   * US08/US09 — visão da operação para o gestor. "Hoje" é o dia civil no fuso
   * da operação, nunca em UTC (o dia viraria às 21h em São Paulo).
   */
  async obter(agora: Date = new Date()): Promise<DashboardDTO> {
    const hoje = diaNoFuso(agora.toISOString(), FUSO_OPERACAO);
    const inicioDeHoje = new Date(comporInstante(hoje, '00:00', FUSO_OPERACAO));
    const inicioDaSemana = new Date(
      comporInstante(somarDias(hoje, -(DIAS_DE_PRODUTIVIDADE - 1)), '00:00', FUSO_OPERACAO),
    );
    const limiteEpi = new Date(agora.getTime() + DIAS_DE_ANTECEDENCIA_EPI * 24 * 60 * 60 * 1000);

    const [
      pedidos,
      montadoresEmCampo,
      avariasHoje,
      avariasAbertas,
      pecasInconsistentes,
      episVencendo,
      triagens,
      descarregamentos,
      eventos,
    ] = await Promise.all([
      this.dashboard.listarPedidosParaAcompanhamento(),
      this.dashboard.contarMontadoresEmCampo(inicioDeHoje),
      this.dashboard.contarAvariasDesde(inicioDeHoje),
      this.dashboard.contarAvariasAbertas(),
      this.dashboard.contarPecasInconsistentes(),
      this.dashboard.contarEpisVencendoAte(limiteEpi),
      this.dashboard.listarInstantesDeTriagemDesde(inicioDaSemana),
      this.dashboard.listarInstantesDeDescarregamentoDesde(inicioDaSemana),
      this.dashboard.listarEventosRecentes(LIMITE_DE_ALERTAS, LIMITE_DE_BIPAGENS),
    ]);

    const produtividade = montarProdutividade(hoje, triagens, descarregamentos);
    const deHoje = produtividade[produtividade.length - 1];

    return {
      geradoEm: agora.toISOString(),
      indicadores: {
        montadoresEmCampo,
        avariasHoje,
        avariasAbertas,
        pecasTriadasHoje: deHoje.pecasTriadas,
        pecasDescarregadasHoje: deHoje.pecasDescarregadas,
        pecasInconsistentes,
        episVencendo,
      },
      pedidos: pedidos.map(montarAcompanhamento),
      alertas: montarAlertas(eventos),
      produtividade,
    };
  }
}
