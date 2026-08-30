import { randomUUID } from 'expo-crypto';
import type { JornadaDTO } from '@montacontrol/shared';
import { capturarLocalizacao } from '../localizacao/localizacao';
import type { ResultadoLocalizacao } from '../localizacao/localizacao';
import { resolverEndereco } from '../localizacao/nominatim';
import { ErroApi, enviarCheckin, enviarCheckout } from './clienteJornadas';

/**
 * Desfechos de uma tentativa de bater ponto. São distintos porque a tela age
 * diferente em cada um: falta de localização manda o montador liberar a
 * permissão ou ligar o GPS, recusa da API é definitiva e precisa de correção,
 * e falha de rede é só tentar de novo.
 */
export type ResultadoAcao =
  | { tipo: 'ok'; jornada: JornadaDTO }
  | { tipo: 'sem_localizacao'; motivo: Exclude<ResultadoLocalizacao['tipo'], 'ok'> }
  | { tipo: 'recusado'; codigo: string }
  | { tipo: 'sem_rede' };

async function baterPonto(
  enviar: (payload: {
    idCliente: string;
    latitude: number;
    longitude: number;
    registradoEm: string;
    endereco?: string;
  }) => Promise<JornadaDTO>,
): Promise<ResultadoAcao> {
  const posicao = await capturarLocalizacao();
  if (posicao.tipo !== 'ok') return { tipo: 'sem_localizacao', motivo: posicao.tipo };

  // O endereço é enfeite: se o Nominatim não responder, o ponto vai sem ele.
  const endereco = await resolverEndereco(posicao.latitude, posicao.longitude);

  try {
    const jornada = await enviar({
      idCliente: randomUUID(),
      latitude: posicao.latitude,
      longitude: posicao.longitude,
      // Horário do aparelho no instante do toque, não o de chegada na API.
      registradoEm: new Date().toISOString(),
      endereco: endereco ?? undefined,
    });
    return { tipo: 'ok', jornada };
  } catch (erro) {
    // 4xx é recusa de regra: retentar não muda o desfecho.
    if (erro instanceof ErroApi && erro.status >= 400 && erro.status < 500) {
      return { tipo: 'recusado', codigo: erro.codigo };
    }
    return { tipo: 'sem_rede' };
  }
}

export async function registrarCheckin(token: string): Promise<ResultadoAcao> {
  return baterPonto((payload) => enviarCheckin(token, payload));
}

export async function registrarCheckout(token: string): Promise<ResultadoAcao> {
  return baterPonto((payload) => enviarCheckout(token, payload));
}
