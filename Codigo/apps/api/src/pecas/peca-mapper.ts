import type { PecaDTO } from '@montacontrol/shared';
import type { StatusPeca } from '../../generated/prisma';

export const SELECAO_PECA = {
  id: true,
  codigoBarras: true,
  descricao: true,
  status: true,
  ambienteId: true,
} as const;

interface LinhaPeca {
  id: number;
  codigoBarras: string;
  descricao: string;
  status: StatusPeca;
  ambienteId: number;
}

export function paraPecaDTO(linha: LinhaPeca): PecaDTO {
  return {
    id: linha.id,
    codigoBarras: linha.codigoBarras,
    descricao: linha.descricao,
    status: linha.status as unknown as PecaDTO['status'],
    ambienteId: linha.ambienteId,
  };
}
