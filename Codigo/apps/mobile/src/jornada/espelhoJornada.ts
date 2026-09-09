import { Q } from '@nozbe/watermelondb';
import type { Database, Query } from '@nozbe/watermelondb';
import { agruparJornadasPorDia, comporInstante, diaNoFuso, somarDias } from '@montacontrol/shared';
import type { HistoricoJornadasDTO, JornadaDTO, PeriodoHistorico, StatusJornada } from '@montacontrol/shared';
import { Jornada } from '../db/Jornada';
import { FUSO_OPERACAO } from '../config/fuso';

function preencherJornada(registro: Jornada, dto: JornadaDTO): void {
  registro.remoteId = dto.id;
  registro.usuarioId = dto.usuarioId;
  registro.status = dto.status;
  registro.checkinAt = dto.checkinAt;
  registro.checkinLatitude = dto.checkinLatitude;
  registro.checkinLongitude = dto.checkinLongitude;
  registro.checkinEndereco = dto.checkinEndereco;
  registro.checkoutAt = dto.checkoutAt;
  registro.checkoutLatitude = dto.checkoutLatitude;
  registro.checkoutLongitude = dto.checkoutLongitude;
  registro.checkoutEndereco = dto.checkoutEndereco;
  registro.lancadoEmAtraso = dto.lancadoEmAtraso;
  registro.criadoEm = dto.criadoEm;
}

/** Upsert por `remoteId` — reenviar a mesma jornada não duplica a linha local. */
export async function upsertJornadas(database: Database, dtos: readonly JornadaDTO[]): Promise<void> {
  const colecao = database.get<Jornada>('jornadas');
  await database.write(async () => {
    for (const dto of dtos) {
      const existentes = await colecao.query(Q.where('remote_id', dto.id)).fetch();
      if (existentes.length > 0) {
        await existentes[0].update((registro) => preencherJornada(registro, dto));
      } else {
        await colecao.create((registro) => preencherJornada(registro, dto));
      }
    }
  });
}

/**
 * `remoteId` é `null` para uma jornada criada offline que ainda não
 * sincronizou — `-1` sinaliza isso no `id` do DTO. Nada no app hoje decide
 * comportamento a partir do valor de `id`, só o exibe/ignora.
 */
export function paraJornadaDTO(registro: Jornada): JornadaDTO {
  return {
    id: registro.remoteId ?? -1,
    usuarioId: registro.usuarioId,
    status: registro.status as StatusJornada,
    checkinAt: registro.checkinAt,
    checkinLatitude: registro.checkinLatitude,
    checkinLongitude: registro.checkinLongitude,
    checkinEndereco: registro.checkinEndereco,
    checkoutAt: registro.checkoutAt,
    checkoutLatitude: registro.checkoutLatitude,
    checkoutLongitude: registro.checkoutLongitude,
    checkoutEndereco: registro.checkoutEndereco,
    lancadoEmAtraso: registro.lancadoEmAtraso,
    criadoEm: registro.criadoEm,
  };
}

export function queryJornadaAtual(database: Database): Query<Jornada> {
  return database.get<Jornada>('jornadas').query(Q.where('status', 'EM_ANDAMENTO'));
}

export function queryJornadasNoPeriodo(
  database: Database,
  inicioIso: string,
  fimIso: string,
): Query<Jornada> {
  return database
    .get<Jornada>('jornadas')
    .query(
      Q.where('checkin_at', Q.notEq(null)),
      Q.where('checkin_at', Q.gte(inicioIso)),
      Q.where('checkin_at', Q.lte(fimIso)),
    );
}

/** Mesma janela usada pelo backend em `jornadas.service.ts#historico`. */
export function janelaDoPeriodo(
  dias: PeriodoHistorico,
  agoraIso: string,
): { inicioPeriodo: string; fimPeriodo: string; inicioIso: string; fimIso: string } {
  const fimPeriodo = diaNoFuso(agoraIso, FUSO_OPERACAO);
  const inicioPeriodo = somarDias(fimPeriodo, -(dias - 1));
  const inicioIso = comporInstante(inicioPeriodo, '00:00', FUSO_OPERACAO);
  const fimIso = new Date(
    new Date(comporInstante(somarDias(fimPeriodo, 1), '00:00', FUSO_OPERACAO)).getTime() - 1,
  ).toISOString();
  return { inicioPeriodo, fimPeriodo, inicioIso, fimIso };
}

export function construirHistoricoDTO(
  registros: readonly Jornada[],
  dias: PeriodoHistorico,
  agoraIso: string,
): HistoricoJornadasDTO {
  const { inicioPeriodo, fimPeriodo } = janelaDoPeriodo(dias, agoraIso);
  const dtos = registros.map(paraJornadaDTO);
  const diasAgrupados = agruparJornadasPorDia(dtos, FUSO_OPERACAO);
  return {
    periodoDias: dias,
    inicioPeriodo,
    fimPeriodo,
    dias: diasAgrupados,
    totalMinutos: diasAgrupados.reduce((soma, dia) => soma + dia.minutosTrabalhados, 0),
  };
}

/**
 * Casa um registro otimista (criado por `outbox.aplicarJornadaOtimista`
 * enquanto uma ação de check-in/check-out estava só na fila, com
 * `remoteId: null`) pelo `idCliente` — não pelo `remote_id`, que ainda não
 * existe nesse registro. Usado por `syncManager.drenarFila` (Task 8) depois
 * que a ação enfileirada offline finalmente sincroniza; sem isto, o próximo
 * `upsertJornadas` (que casa por `remote_id`) criaria uma segunda linha
 * local para a mesma jornada.
 */
export async function reconciliarJornadaOtimista(
  database: Database,
  idCliente: string,
  jornadaServidor: JornadaDTO,
): Promise<void> {
  const colecao = database.get<Jornada>('jornadas');
  const porCheckin = await colecao.query(Q.where('id_cliente_checkin', idCliente)).fetch();
  const porCheckout = await colecao.query(Q.where('id_cliente_checkout', idCliente)).fetch();
  const registro = porCheckin[0] ?? porCheckout[0];

  await database.write(async () => {
    if (registro) {
      await registro.update((r) => preencherJornada(r, jornadaServidor));
    } else {
      // Sem registro otimista correspondente (ex.: instalação nova que
      // nunca chegou a gravar essa ação localmente) — cria direto.
      await colecao.create((r) => preencherJornada(r, jornadaServidor));
    }
  });
}
