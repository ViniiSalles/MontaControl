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
  SUPABASE_BUCKET_FOTOS_USUARIOS: 'fotos-usuarios',
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

describe('validate — IP do cliente atrás de proxy', () => {
  it('assume 0 hops e nenhum cabeçalho de IP por padrão', () => {
    const config = validate({ ...BASE_VALIDA });
    expect(config.TRUST_PROXY_HOPS).toBe(0);
    expect(config.CLIENT_IP_HEADER).toBeUndefined();
  });

  it('converte TRUST_PROXY_HOPS de string para número', () => {
    expect(validate({ ...BASE_VALIDA, TRUST_PROXY_HOPS: '3' }).TRUST_PROXY_HOPS).toBe(3);
  });

  it.each(['-1', '11', '1.5', 'true'])('rejeita TRUST_PROXY_HOPS=%s', (valor) => {
    expect(() => validate({ ...BASE_VALIDA, TRUST_PROXY_HOPS: valor })).toThrow();
  });

  it('aceita CLIENT_IP_HEADER=true-client-ip', () => {
    expect(validate({ ...BASE_VALIDA, CLIENT_IP_HEADER: 'true-client-ip' }).CLIENT_IP_HEADER).toBe(
      'true-client-ip',
    );
  });

  it('rejeita CLIENT_IP_HEADER=x-forwarded-for, que o cliente consegue forjar', () => {
    expect(() => validate({ ...BASE_VALIDA, CLIENT_IP_HEADER: 'x-forwarded-for' })).toThrow();
  });
});

describe('validate — CORS do gateway WebSocket', () => {
  it('WS_CORS_ORIGENS é opcional', () => {
    expect(validate({ ...BASE_VALIDA }).WS_CORS_ORIGENS).toBeUndefined();
  });

  it('aceita uma lista de origens separadas por vírgula', () => {
    const origens = 'https://app.montacontrol.com.br, http://localhost:5173';
    expect(validate({ ...BASE_VALIDA, WS_CORS_ORIGENS: origens }).WS_CORS_ORIGENS).toBe(origens);
  });

  it.each([
    '*',
    'app.montacontrol.com.br',
    'https://ok.com,,https://b.com',
    // Origem é esquema+host(+porta): barra final ou caminho nunca casam com o `Origin`.
    'https://ok.com/',
    'https://ok.com/app',
  ])('rejeita WS_CORS_ORIGENS=%s', (valor) => {
    expect(() => validate({ ...BASE_VALIDA, WS_CORS_ORIGENS: valor })).toThrow();
  });
});
