/** Siglas das 27 unidades federativas — validação do cadastro de cliente e seletor da Web. */
export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export type Uf = (typeof UFS)[number];

/** `30130100` / `30130-100` → `30130-100`; `null` se não tiver 8 dígitos. */
export function formatarCep(cep: string): string | null {
  const digitos = cep.replace(/\D/g, '');
  return digitos.length === 8 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : null;
}
