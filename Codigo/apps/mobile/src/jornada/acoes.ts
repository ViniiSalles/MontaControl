import { randomUUID } from 'expo-crypto';
import type { Database } from '@nozbe/watermelondb';
import type { CheckinRequest, CheckoutRequest, JornadaDTO } from '@montacontrol/shared';
import { capturarLocalizacao } from '../localizacao/localizacao';
import type { ResultadoLocalizacao } from '../localizacao/localizacao';
import { resolverEndereco } from '../localizacao/nominatim';
import { executarAcaoJornada } from '../sincronizacao/outbox';

/**
 * Desfechos de uma tentativa de bater ponto. `sem_rede` não existe mais — a
 * ação é sempre gravada localmente antes de qualquer chamada de rede, então
 * do ponto de vista do montador ela sempre dá certo (`ok`, possivelmente com
 * `jornada.id === -1` enquanto não sincroniza). Quem comunica a pendência de
 * sincronização é o badge da UI, não o resultado da ação.
 */
export type ResultadoAcao =
  | { tipo: 'ok'; jornada: JornadaDTO }
  | { tipo: 'sem_localizacao'; motivo: Exclude<ResultadoLocalizacao['tipo'], 'ok'> }
  | { tipo: 'recusado'; codigo: string };

async function baterPonto(
  tipo: 'checkin' | 'checkout',
  token: string,
  database: Database,
): Promise<ResultadoAcao> {
  const posicao = await capturarLocalizacao();
  if (posicao.tipo !== 'ok') return { tipo: 'sem_localizacao', motivo: posicao.tipo };

  // O endereço é enfeite: se o Nominatim não responder, o ponto vai sem ele.
  const endereco = await resolverEndereco(posicao.latitude, posicao.longitude);

  const payload: CheckinRequest | CheckoutRequest = {
    idCliente: randomUUID(),
    latitude: posicao.latitude,
    longitude: posicao.longitude,
    // Horário do aparelho no instante do toque, não o de chegada na API.
    registradoEm: new Date().toISOString(),
    endereco: endereco ?? undefined,
  };

  const resultado = await executarAcaoJornada(database, tipo, token, payload);
  if (resultado.tipo === 'recusado') return resultado;
  return { tipo: 'ok', jornada: resultado.dado };
}

export async function registrarCheckin(token: string, database: Database): Promise<ResultadoAcao> {
  return baterPonto('checkin', token, database);
}

export async function registrarCheckout(token: string, database: Database): Promise<ResultadoAcao> {
  return baterPonto('checkout', token, database);
}
