import 'reflect-metadata';
import { validate } from '../env.validation';

const BASE_VALIDA: Record<string, string> = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  DIRECT_URL: 'postgresql://user:pass@localhost:5432/db',
  SUPABASE_URL: 'https://exemplo.supabase.co',
  SUPABASE_ANON_KEY: 'chave',
  SUPABASE_SERVICE_ROLE_KEY: 'chave',
  SUPABASE_JWT_ISSUER: 'https://exemplo.supabase.co/auth/v1',
  PASSWORD_RESET_REDIRECT_URL: 'https://app.montacontrol.local/redefinir-senha',
  SUPABASE_BUCKET_ATESTADOS: 'atestados',
  SUPABASE_BUCKET_AVARIAS: 'avarias',
  EMPRESA_CNPJ: '12345678000199',
  EMPRESA_RAZAO_SOCIAL: 'MontaControl Montagens Planejadas Ltda',
  REP_P_REGISTRO_INPI: '12345678901234567',
  DESENVOLVEDOR_CNPJ: '98765432000188',
};

describe('validate — variáveis do AFD', () => {
  it('aceita a configuração completa', () => {
    expect(() => validate({ ...BASE_VALIDA })).not.toThrow();
  });

  it('rejeita EMPRESA_CNPJ com menos de 14 dígitos', () => {
    expect(() => validate({ ...BASE_VALIDA, EMPRESA_CNPJ: '123' })).toThrow();
  });

  it('rejeita DESENVOLVEDOR_CNPJ com caractere não numérico', () => {
    expect(() => validate({ ...BASE_VALIDA, DESENVOLVEDOR_CNPJ: '1234567800019a' })).toThrow();
  });

  it('rejeita REP_P_REGISTRO_INPI com mais de 17 dígitos', () => {
    expect(() => validate({ ...BASE_VALIDA, REP_P_REGISTRO_INPI: '123456789012345678' })).toThrow();
  });

  it('rejeita EMPRESA_RAZAO_SOCIAL acima de 150 caracteres', () => {
    expect(() => validate({ ...BASE_VALIDA, EMPRESA_RAZAO_SOCIAL: 'a'.repeat(151) })).toThrow();
  });
});
