/**
 * Aluguel de EPIs do almoxarifado (gestor). O status não é gravado: sai das
 * datas do aluguel comparadas com "agora", então nunca fica desatualizado.
 */
export type StatusAluguelEpi = 'RESERVADO' | 'EM_USO' | 'ATRASADO' | 'DEVOLVIDO';

export interface TipoEpiDTO {
  id: number;
  nome: string;
  descricao: string;
  validadeMeses: number;
  /** Unidades que podem estar alugadas ao mesmo tempo. */
  estoque: number;
  /** Unidades fora do almoxarifado agora (em uso ou atrasadas). */
  emUso: number;
}

export interface SalvarTipoEpiRequest {
  nome: string;
  descricao: string;
  validadeMeses: number;
  estoque: number;
}

export interface AluguelEpiDTO {
  id: number;
  tipoEpi: { id: number; nome: string };
  colaborador: { id: number; nome: string };
  quantidade: number;
  /** Instantes ISO. `inicio` → `fimPrevisto` é o período reservado. */
  inicio: string;
  fimPrevisto: string;
  devolvidoEm: string | null;
  observacao: string | null;
  registradoPor: { id: number; nome: string };
  devolucaoRegistradaPor: { id: number; nome: string } | null;
  status: StatusAluguelEpi;
}

export interface RegistrarAluguelEpiRequest {
  tipoEpiId: number;
  usuarioId: number;
  quantidade: number;
  inicio: string;
  fimPrevisto: string;
  observacao?: string;
}

export interface RegistrarDevolucaoEpiRequest {
  /** Omitido = agora. */
  devolvidoEm?: string;
}

/** Datas do aluguel → status, sempre relativo a `agora`. */
export function statusAluguelEpi(
  aluguel: { inicio: Date; fimPrevisto: Date; devolvidoEm: Date | null },
  agora: Date,
): StatusAluguelEpi {
  if (aluguel.devolvidoEm) return 'DEVOLVIDO';
  if (agora < aluguel.inicio) return 'RESERVADO';
  return agora > aluguel.fimPrevisto ? 'ATRASADO' : 'EM_USO';
}
