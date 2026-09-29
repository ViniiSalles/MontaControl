/** Remove tudo que não for dígito (máscara, espaços). */
export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

function digitoVerificador(base: string): number {
  const pesoInicial = base.length + 1;
  const soma = [...base].reduce((total, digito, indice) => total + Number(digito) * (pesoInicial - indice), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

/** CPF com 11 dígitos, não repetidos, e os dois dígitos verificadores corretos. */
export function cpfValido(valor: string): boolean {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const primeiro = digitoVerificador(cpf.slice(0, 9));
  const segundo = digitoVerificador(cpf.slice(0, 10));
  return primeiro === Number(cpf[9]) && segundo === Number(cpf[10]);
}

/** `52998224725` → `529.982.247-25`. */
export function formatarCpf(digitos: string): string {
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9, 11)}`;
}

/** LGPD: só os 3 primeiros e os 2 últimos dígitos ficam à vista. Ausente → `—`. */
export function mascararCpf(cpf: string | null | undefined): string {
  if (!cpf) return '—';
  const digitos = somenteDigitos(cpf);
  return `${digitos.slice(0, 3)}.***.***-${digitos.slice(9, 11)}`;
}
