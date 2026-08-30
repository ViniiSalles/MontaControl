import type { SolicitarPontoEmAtrasoRequest } from '@montacontrol/shared';

/** Formulário cru, do jeito que o montador digita. */
export interface CamposPontoEmAtraso {
  /** `DD/MM/AAAA` — ordem brasileira, que é a que ele lê no calendário. */
  data: string;
  /** `HH:mm`. */
  horaInicio: string;
  /** `HH:mm`. */
  horaFim: string;
  justificativa: string;
}

export type ErrosPontoEmAtraso = Partial<Record<keyof CamposPontoEmAtraso, string>>;

export interface ResultadoValidacao {
  erros: ErrosPontoEmAtraso;
  /** Corpo pronto para `enviarSolicitacaoPonto`, sem o `idCliente` (é do aparelho). Nulo se inválido. */
  dados: Omit<SolicitarPontoEmAtrasoRequest, 'idCliente'> | null;
}

/** Curto demais não é justificativa: o gestor precisa decidir só com este texto. */
const MINIMO_JUSTIFICATIVA = 10;

/** Só dígitos, cortando no comprimento do formato — colar texto sujo não quebra a máscara. */
function digitos(texto: string, maximo: number): string {
  return texto.replace(/\D/g, '').slice(0, maximo);
}

/** Máscara progressiva `DD/MM/AAAA` aplicada a cada tecla. */
export function mascararData(texto: string): string {
  const numeros = digitos(texto, 8);
  const partes = [numeros.slice(0, 2), numeros.slice(2, 4), numeros.slice(4, 8)];
  return partes.filter((parte) => parte.length > 0).join('/');
}

/** Máscara progressiva `HH:mm`. */
export function mascararHora(texto: string): string {
  const numeros = digitos(texto, 4);
  if (numeros.length <= 2) return numeros;
  return `${numeros.slice(0, 2)}:${numeros.slice(2, 4)}`;
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

/** `HH:mm` válido vira minutos desde a meia-noite; o resto vira `null`. */
function paraMinutos(texto: string): number | null {
  const casou = /^(\d{2}):(\d{2})$/.exec(texto);
  if (!casou) return null;

  const horas = Number(casou[1]);
  const minutos = Number(casou[2]);
  if (horas > 23 || minutos > 59) return null;
  return horas * 60 + minutos;
}

/**
 * Valida o formulário na borda, antes de gastar rede. `hoje` é o dia civil
 * (`YYYY-MM-DD`) no fuso de operação e vem de fora de propósito: a regra de
 * "não pode ser no futuro" precisa do mesmo dia que o servidor usa, e um
 * teste precisa poder fixá-lo.
 */
export function validarPontoEmAtraso(
  campos: CamposPontoEmAtraso,
  hoje: string,
): ResultadoValidacao {
  const erros: ErrosPontoEmAtraso = {};

  const data = paraDataIso(campos.data.trim());
  if (!data) erros.data = 'Informe a data no formato DD/MM/AAAA.';
  else if (data > hoje) erros.data = 'A data não pode ser no futuro.';

  const inicio = paraMinutos(campos.horaInicio.trim());
  if (inicio === null) erros.horaInicio = 'Informe a hora no formato HH:mm.';

  const fim = paraMinutos(campos.horaFim.trim());
  if (fim === null) erros.horaFim = 'Informe a hora no formato HH:mm.';
  else if (inicio !== null && fim <= inicio) erros.horaFim = 'A saída precisa ser depois da entrada.';

  const justificativa = campos.justificativa.trim();
  if (justificativa.length < MINIMO_JUSTIFICATIVA) {
    erros.justificativa = `Explique o motivo em pelo menos ${MINIMO_JUSTIFICATIVA} caracteres.`;
  }

  if (Object.keys(erros).length > 0 || !data) return { erros, dados: null };

  return {
    erros,
    dados: {
      data,
      horaInicio: campos.horaInicio.trim(),
      horaFim: campos.horaFim.trim(),
      justificativa,
    },
  };
}
