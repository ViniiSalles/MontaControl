import { cpfValido, formatarCpf, mascararCpf, somenteDigitos } from '@montacontrol/shared';

describe('cpf', () => {
  it('aceita CPFs válidos com e sem máscara', () => {
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('529.982.247-25')).toBe(true);
  });

  it('rejeita dígito verificador errado, tamanho errado e sequências repetidas', () => {
    expect(cpfValido('52998224726')).toBe(false);
    expect(cpfValido('5299822472')).toBe(false);
    expect(cpfValido('11111111111')).toBe(false);
    expect(cpfValido('')).toBe(false);
  });

  it('limpa, formata e mascara', () => {
    expect(somenteDigitos('529.982.247-25')).toBe('52998224725');
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
    expect(mascararCpf('52998224725')).toBe('529.***.***-25');
    expect(mascararCpf(null)).toBe('—');
  });
});
