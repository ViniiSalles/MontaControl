import { randomUUID } from 'expo-crypto';
import type { Database } from '@nozbe/watermelondb';
import { calcularDistanciaMetros, RAIO_TOLERANCIA_PONTO_METROS } from '@montacontrol/shared';
import type { CheckinRequest, CheckoutRequest, JornadaDTO } from '@montacontrol/shared';
import { capturarLocalizacao } from '../localizacao/localizacao';
import type { ResultadoLocalizacao } from '../localizacao/localizacao';
import { resolverEndereco } from '../localizacao/nominatim';
import type { ObraDoPonto } from '../pedidos/obras';
import { executarAcaoJornada } from '../sincronizacao/outbox';

/**
 * Desfechos de uma tentativa de bater ponto. `sem_rede` não existe mais — a
 * ação é sempre gravada localmente antes de qualquer chamada de rede, então
 * do ponto de vista do montador ela sempre dá certo (`ok`, possivelmente com
 * `jornada.id === -1` enquanto não sincroniza). Quem comunica a pendência de
 * sincronização é o badge da UI, não o resultado da ação.
 *
 * `fora_do_raio` é decidido no aparelho, antes de gravar: sem isso, uma
 * marcação offline longe da obra entraria na fila só para ser recusada
 * pela API horas depois.
 */
export type ResultadoAcao =
  | { tipo: 'ok'; jornada: JornadaDTO }
  | { tipo: 'sem_localizacao'; motivo: Exclude<ResultadoLocalizacao['tipo'], 'ok'> }
  | { tipo: 'fora_do_raio'; distanciaMetros: number }
  | { tipo: 'recusado'; codigo: string };

async function baterPonto(
  tipo: 'checkin' | 'checkout',
  database: Database,
  obra: ObraDoPonto | null,
): Promise<ResultadoAcao> {
  const posicao = await capturarLocalizacao();
  if (posicao.tipo !== 'ok') return { tipo: 'sem_localizacao', motivo: posicao.tipo };

  if (obra) {
    const distancia = calcularDistanciaMetros(posicao, obra.cliente);
    if (distancia > RAIO_TOLERANCIA_PONTO_METROS) {
      return { tipo: 'fora_do_raio', distanciaMetros: Math.round(distancia) };
    }
  }

  // O endereço é enfeite: se o Nominatim não responder, o ponto vai sem ele.
  const endereco = await resolverEndereco(posicao.latitude, posicao.longitude);

  const base = {
    idCliente: randomUUID(),
    latitude: posicao.latitude,
    longitude: posicao.longitude,
    // Horário do aparelho no instante do toque, não o de chegada na API.
    registradoEm: new Date().toISOString(),
    endereco: endereco ?? undefined,
  };
  const payload: CheckinRequest | CheckoutRequest = obra ? { ...base, pedidoId: obra.id } : base;

  const resultado = await executarAcaoJornada(database, tipo, payload);
  if (resultado.tipo === 'recusado') return resultado;
  return { tipo: 'ok', jornada: resultado.dado };
}

/** A entrada é sempre numa obra: a API recusa check-in sem pedido. */
export async function registrarCheckin(database: Database, obra: ObraDoPonto): Promise<ResultadoAcao> {
  return baterPonto('checkin', database, obra);
}

/**
 * `obra` é a do check-in, quando o aparelho a conhece. Sem ela (check-in em
 * outro aparelho, por exemplo) a saída vai sem checagem local — a API valida
 * contra o pedido gravado na jornada.
 */
export async function registrarCheckout(
  database: Database,
  obra: ObraDoPonto | null,
): Promise<ResultadoAcao> {
  return baterPonto('checkout', database, obra);
}
