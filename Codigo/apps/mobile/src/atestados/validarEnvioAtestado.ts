import type { EnviarAtestadoRequest, FotoBase64 } from '@montacontrol/shared';

export { mascararData } from '../jornada/pontoEmAtraso';

/** Formulário cru, do jeito que o montador digita. */
export interface CamposNovoAtestado {
  /** `DD/MM/AAAA`. */
  dataInicio: string;
  /** `DD/MM/AAAA`. */
  dataFim: string;
}

export type ErrosNovoAtestado = Partial<Record<'dataInicio' | 'dataFim' | 'fotos', string>>;

export interface ResultadoValidacaoAtestado {
  erros: ErrosNovoAtestado;
  /** Corpo pronto para `enviarAtestado`, sem o `idCliente` (é do aparelho). Nulo se inválido. */
  dados: Omit<EnviarAtestadoRequest, 'idCliente'> | null;
}

/** `"26/08/2026"` → `"2026-08-26"`, ou `null` se não for uma data de calendário real. */
function paraDataIso(texto: string): string | null {
  const casou = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!casou) return null;

  const [, dia, mes, ano] = casou;
  const iso = `${ano}-${mes}-${dia}`;
  // `Date.UTC` normaliza silenciosamente (31/02 vira 03/03), então a
  // comparação de volta é o que rejeita dia inexistente.
  const normalizada = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  return normalizada.toISOString().slice(0, 10) === iso ? iso : null;
}

/**
 * Valida o formulário na borda, antes de gastar rede e upload de foto. O
 * limite de "não pode ser no futuro" é decidido pelo servidor (contrato de
 * fuso do dia civil é dele) — aqui só formato, ordem das datas e ao menos
 * uma foto anexada.
 */
export function validarEnvioAtestado(
  campos: CamposNovoAtestado,
  fotos: readonly FotoBase64[],
): ResultadoValidacaoAtestado {
  const erros: ErrosNovoAtestado = {};

  const dataInicio = paraDataIso(campos.dataInicio.trim());
  if (!dataInicio) erros.dataInicio = 'Informe a data no formato DD/MM/AAAA.';

  const dataFim = paraDataIso(campos.dataFim.trim());
  if (!dataFim) erros.dataFim = 'Informe a data no formato DD/MM/AAAA.';
  else if (dataInicio && dataFim < dataInicio) {
    erros.dataFim = 'A data final não pode ser anterior à inicial.';
  }

  if (fotos.length === 0) erros.fotos = 'Anexe ao menos uma foto do atestado.';

  if (Object.keys(erros).length > 0 || !dataInicio || !dataFim) return { erros, dados: null };

  return { erros, dados: { dataInicio, dataFim, fotos: [...fotos] } };
}
