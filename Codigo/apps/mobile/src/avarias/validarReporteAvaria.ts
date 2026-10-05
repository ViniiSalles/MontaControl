import type { FotoBase64, ReportarAvariaRequest } from '@montacontrol/shared';

export const LIMITE_DESCRICAO = 500;
export const MAXIMO_FOTOS = 3;

/** Formulário cru, do jeito que o montador preenche. */
export interface CamposReporteAvaria {
  pecaId: number | null;
  tipoAvariaId: number | null;
  descricao: string;
}

export type ErrosReporteAvaria = Partial<Record<'peca' | 'tipo' | 'descricao' | 'fotos', string>>;

export interface ResultadoValidacaoAvaria {
  erros: ErrosReporteAvaria;
  /** Corpo pronto para envio, sem o `idCliente` (é do aparelho). Nulo se inválido. */
  dados: Omit<ReportarAvariaRequest, 'idCliente'> | null;
}

/**
 * Valida na borda, antes de gastar rede e upload. Foto é opcional — peça
 * faltando não tem o que fotografar. Se o montador pode reportar aquela
 * peça é decisão do servidor.
 */
export function validarReporteAvaria(
  campos: CamposReporteAvaria,
  fotos: readonly FotoBase64[],
): ResultadoValidacaoAvaria {
  const erros: ErrosReporteAvaria = {};

  if (campos.pecaId === null) erros.peca = 'Selecione a peça com problema.';
  if (campos.tipoAvariaId === null) erros.tipo = 'Selecione o tipo de problema.';

  const descricao = campos.descricao.trim();
  if (descricao.length < 3) erros.descricao = 'Descreva o problema.';
  else if (descricao.length > LIMITE_DESCRICAO) {
    erros.descricao = `A descrição pode ter no máximo ${LIMITE_DESCRICAO} caracteres.`;
  }

  if (fotos.length > MAXIMO_FOTOS) erros.fotos = `Envie no máximo ${MAXIMO_FOTOS} fotos.`;

  if (Object.keys(erros).length > 0 || campos.pecaId === null || campos.tipoAvariaId === null) {
    return { erros, dados: null };
  }

  return {
    erros,
    dados: {
      pecaId: campos.pecaId,
      tipoAvariaId: campos.tipoAvariaId,
      descricao,
      ...(fotos.length > 0 ? { fotos: [...fotos] } : {}),
    },
  };
}
