import { Q } from '@nozbe/watermelondb';
import type { Database } from '@nozbe/watermelondb';
import { StatusJornada } from '@montacontrol/shared';
import type {
  CheckinRequest,
  CheckoutRequest,
  JornadaDTO,
  SolicitarPontoEmAtrasoRequest,
} from '@montacontrol/shared';
import { AcaoPendente } from '../db/AcaoPendente';
import { Jornada } from '../db/Jornada';
import {
  ErroApi,
  enviarCheckin,
  enviarCheckout,
  enviarSolicitacaoPonto,
} from '../jornada/clienteJornadas';
import { paraJornadaDTO } from '../jornada/espelhoJornada';

export type ResultadoEnvio<T> = { tipo: 'ok'; dado: T } | { tipo: 'recusado'; codigo: string };
export type ResultadoPontoEmAtraso = { tipo: 'ok' } | { tipo: 'recusado'; codigo: string };

function ehRecusaDoServidor(erro: unknown): erro is ErroApi {
  return erro instanceof ErroApi && erro.status >= 400 && erro.status < 500;
}

async function enfileirar(
  database: Database,
  tipo: string,
  idCliente: string,
  payload: unknown,
): Promise<AcaoPendente> {
  const colecao = database.get<AcaoPendente>('acoes_pendentes');
  return database.write(() =>
    colecao.create((registro) => {
      registro.tipo = tipo;
      registro.idCliente = idCliente;
      registro.payload = JSON.stringify(payload);
      registro.criadoEm = new Date().toISOString();
      registro.status = 'pendente';
      registro.mensagemDescarte = null;
    }),
  );
}

type ResultadoJornadaOtimista = { registro: Jornada; criouRegistroNovo: boolean };

async function aplicarJornadaOtimista(
  database: Database,
  tipo: 'checkin' | 'checkout',
  payload: CheckinRequest | CheckoutRequest,
): Promise<ResultadoJornadaOtimista> {
  const colecao = database.get<Jornada>('jornadas');
  return database.write(async () => {
    if (tipo === 'checkin') {
      const registro = await colecao.create((registro) => {
        registro.remoteId = null;
        registro.usuarioId = -1;
        registro.status = StatusJornada.EM_ANDAMENTO;
        registro.checkinAt = payload.registradoEm;
        registro.checkinLatitude = payload.latitude;
        registro.checkinLongitude = payload.longitude;
        registro.checkinEndereco = payload.endereco ?? null;
        registro.checkoutAt = null;
        registro.checkoutLatitude = null;
        registro.checkoutLongitude = null;
        registro.checkoutEndereco = null;
        registro.lancadoEmAtraso = false;
        registro.criadoEm = payload.registradoEm;
        registro.idClienteCheckin = payload.idCliente;
        registro.idClienteCheckout = null;
      });
      return { registro, criouRegistroNovo: true };
    }

    const abertas = await colecao.query(Q.where('status', StatusJornada.EM_ANDAMENTO)).fetch();
    const aberta = abertas[0];
    if (!aberta) {
      // Sem jornada aberta conhecida localmente (ex.: o check-in original
      // aconteceu antes da primeira sincronização deste aparelho) — cria um
      // registro só de checkout; o servidor decide o desfecho quando a fila
      // for enviada.
      const registro = await colecao.create((registro) => {
        registro.remoteId = null;
        registro.usuarioId = -1;
        registro.status = StatusJornada.FINALIZADA;
        registro.checkinAt = null;
        registro.checkinLatitude = null;
        registro.checkinLongitude = null;
        registro.checkinEndereco = null;
        registro.checkoutAt = payload.registradoEm;
        registro.checkoutLatitude = payload.latitude;
        registro.checkoutLongitude = payload.longitude;
        registro.checkoutEndereco = payload.endereco ?? null;
        registro.lancadoEmAtraso = false;
        registro.criadoEm = payload.registradoEm;
        registro.idClienteCheckin = null;
        registro.idClienteCheckout = payload.idCliente;
      });
      return { registro, criouRegistroNovo: true };
    }

    await aberta.update((registro) => {
      registro.status = StatusJornada.FINALIZADA;
      registro.checkoutAt = payload.registradoEm;
      registro.checkoutLatitude = payload.latitude;
      registro.checkoutLongitude = payload.longitude;
      registro.checkoutEndereco = payload.endereco ?? null;
      registro.idClienteCheckout = payload.idCliente;
    });
    return { registro: aberta, criouRegistroNovo: false };
  });
}

/** Check-in ou check-out: grava localmente antes de tentar a rede — nunca perde a marcação. */
export async function executarAcaoJornada(
  database: Database,
  tipo: 'checkin' | 'checkout',
  token: string,
  payload: CheckinRequest | CheckoutRequest,
): Promise<ResultadoEnvio<JornadaDTO>> {
  const acao = await enfileirar(database, tipo, payload.idCliente, payload);
  const { registro: registroLocal, criouRegistroNovo } = await aplicarJornadaOtimista(
    database,
    tipo,
    payload,
  );

  try {
    const jornadaServidor =
      tipo === 'checkin'
        ? await enviarCheckin(token, payload as CheckinRequest)
        : await enviarCheckout(token, payload as CheckoutRequest);

    await database.write(async () => {
      await acao.destroyPermanently();
      await registroLocal.update((registro) => {
        registro.remoteId = jornadaServidor.id;
        registro.usuarioId = jornadaServidor.usuarioId;
        registro.status = jornadaServidor.status;
        registro.checkinAt = jornadaServidor.checkinAt;
        registro.checkinLatitude = jornadaServidor.checkinLatitude;
        registro.checkinLongitude = jornadaServidor.checkinLongitude;
        registro.checkinEndereco = jornadaServidor.checkinEndereco;
        registro.checkoutAt = jornadaServidor.checkoutAt;
        registro.checkoutLatitude = jornadaServidor.checkoutLatitude;
        registro.checkoutLongitude = jornadaServidor.checkoutLongitude;
        registro.checkoutEndereco = jornadaServidor.checkoutEndereco;
        registro.lancadoEmAtraso = jornadaServidor.lancadoEmAtraso;
        registro.criadoEm = jornadaServidor.criadoEm;
      });
    });
    return { tipo: 'ok', dado: jornadaServidor };
  } catch (erro) {
    if (ehRecusaDoServidor(erro)) {
      await database.write(async () => {
        await acao.destroyPermanently();
        if (criouRegistroNovo) {
          await registroLocal.destroyPermanently();
        } else {
          // Checkout recusado sobre uma jornada que já estava EM_ANDAMENTO
          // localmente: reverte só os campos de checkout, que só podiam
          // estar null antes (checkout só se aplica a jornada em andamento).
          await registroLocal.update((registro) => {
            registro.status = StatusJornada.EM_ANDAMENTO;
            registro.checkoutAt = null;
            registro.checkoutLatitude = null;
            registro.checkoutLongitude = null;
            registro.checkoutEndereco = null;
            registro.idClienteCheckout = null;
          });
        }
      });
      return { tipo: 'recusado', codigo: erro.codigo };
    }
    // Falha de rede: a linha da fila e o registro otimista ficam como estão
    // — a drenagem em segundo plano tenta de novo depois.
    return { tipo: 'ok', dado: paraJornadaDTO(registroLocal) };
  }
}

/** Ponto em atraso: mesma fila, sem espelho otimista (a tela já mostra "enviada" incondicionalmente). */
export async function executarAcaoPontoEmAtraso(
  database: Database,
  token: string,
  payload: SolicitarPontoEmAtrasoRequest,
): Promise<ResultadoPontoEmAtraso> {
  const acao = await enfileirar(database, 'ponto_em_atraso', payload.idCliente, payload);

  try {
    await enviarSolicitacaoPonto(token, payload);
    await database.write(() => acao.destroyPermanently());
    return { tipo: 'ok' };
  } catch (erro) {
    if (ehRecusaDoServidor(erro)) {
      await database.write(() => acao.destroyPermanently());
      return { tipo: 'recusado', codigo: erro.codigo };
    }
    return { tipo: 'ok' };
  }
}
