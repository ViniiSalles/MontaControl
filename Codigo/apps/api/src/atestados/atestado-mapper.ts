import type { AtestadoDTO } from '@montacontrol/shared';
import type { StatusAtestado } from '../../generated/prisma';

export const SELECAO_ATESTADO = {
  id: true,
  usuarioId: true,
  dataInicio: true,
  dataFim: true,
  observacao: true,
  status: true,
  motivoRejeicao: true,
  validadoPor: true,
  validadoAt: true,
  createdAt: true,
  usuario: { select: { nome: true } },
} as const;

export const SELECAO_ATESTADO_COM_FOTOS = {
  ...SELECAO_ATESTADO,
  fotos: { select: { id: true, storagePath: true }, orderBy: { id: 'asc' } },
} as const;

interface LinhaAtestado {
  id: number;
  usuarioId: number;
  dataInicio: Date;
  dataFim: Date;
  observacao: string | null;
  status: StatusAtestado;
  motivoRejeicao: string | null;
  validadoPor: number | null;
  validadoAt: Date | null;
  createdAt: Date;
  usuario: { nome: string };
}

/** Coluna `DATE` volta como `Date` à meia-noite UTC; o contrato quer `YYYY-MM-DD`. */
function paraDiaCivil(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export function paraAtestadoDTO(linha: LinhaAtestado): AtestadoDTO {
  return {
    id: linha.id,
    usuarioId: linha.usuarioId,
    usuarioNome: linha.usuario.nome,
    dataInicio: paraDiaCivil(linha.dataInicio),
    dataFim: paraDiaCivil(linha.dataFim),
    observacao: linha.observacao,
    status: linha.status as unknown as AtestadoDTO['status'],
    motivoRejeicao: linha.motivoRejeicao,
    validadoPor: linha.validadoPor,
    validadoEm: linha.validadoAt?.toISOString() ?? null,
    criadoEm: linha.createdAt.toISOString(),
  };
}
