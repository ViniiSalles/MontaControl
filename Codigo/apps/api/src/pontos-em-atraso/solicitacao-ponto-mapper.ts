import { Prisma } from '../../generated/prisma';
import type {
  SolicitacaoPontoDTO,
  StatusSolicitacaoPonto as StatusCompartilhado,
} from '@montacontrol/shared';

/**
 * Seleção mínima do `SolicitacaoPontoDTO`. O nome do usuário entra junto
 * porque a fila do gestor lista pessoas, não ids — buscá-lo depois seria
 * um N+1 garantido.
 */
export const SELECAO_SOLICITACAO = {
  id: true,
  usuarioId: true,
  data: true,
  inicio: true,
  fim: true,
  minutosSolicitados: true,
  justificativa: true,
  status: true,
  jornadaId: true,
  analisadoPor: true,
  analisadoEm: true,
  motivoRejeicao: true,
  createdAt: true,
  usuario: { select: { nome: true } },
} as const;

type LinhaSolicitacao = Prisma.SolicitacaoPontoGetPayload<{ select: typeof SELECAO_SOLICITACAO }>;

export function paraSolicitacaoPontoDTO(linha: LinhaSolicitacao): SolicitacaoPontoDTO {
  return {
    id: linha.id,
    usuarioId: linha.usuarioId,
    usuarioNome: linha.usuario.nome,
    // Coluna `DATE`: o Prisma devolve meia-noite UTC do dia civil, então o
    // recorte é o próprio dia — reformatar num fuso deslocaria a data.
    data: linha.data.toISOString().slice(0, 10),
    inicio: linha.inicio.toISOString(),
    fim: linha.fim.toISOString(),
    minutosSolicitados: linha.minutosSolicitados,
    justificativa: linha.justificativa,
    // Mesmo enum dos dois lados (Prisma e pacote compartilhado), tipos
    // nominalmente distintos — mesma razão do cast em `jornada-mapper.ts`.
    status: linha.status as unknown as StatusCompartilhado,
    jornadaId: linha.jornadaId,
    analisadoPor: linha.analisadoPor,
    analisadoEm: linha.analisadoEm?.toISOString() ?? null,
    motivoRejeicao: linha.motivoRejeicao,
    criadoEm: linha.createdAt.toISOString(),
  };
}
