import { resolverUrlBaseApi } from '../api';

const vazio = { env: undefined, extra: undefined, hostUri: undefined };

describe('resolverUrlBaseApi', () => {
  test('usa o IP do servidor de desenvolvimento do Expo quando nada foi configurado', () => {
    expect(resolverUrlBaseApi({ ...vazio, hostUri: '192.168.1.42:8081', plataforma: 'android' })).toBe(
      'http://192.168.1.42:3000',
    );
  });

  test('EXPO_PUBLIC_API_URL tem prioridade sobre o IP detectado', () => {
    expect(
      resolverUrlBaseApi({
        ...vazio,
        env: 'http://10.0.0.5:4000',
        hostUri: '192.168.1.42:8081',
        plataforma: 'ios',
      }),
    ).toBe('http://10.0.0.5:4000');
  });

  test('expo.extra.apiUrl tem prioridade sobre o IP detectado', () => {
    expect(
      resolverUrlBaseApi({ ...vazio, extra: 'https://api.exemplo.com', hostUri: '192.168.1.42:8081', plataforma: 'ios' }),
    ).toBe('https://api.exemplo.com');
  });

  test('ignora hostUri de túnel (não é o IP da máquina da API)', () => {
    expect(resolverUrlBaseApi({ ...vazio, hostUri: 'abc-anonymous-8081.exp.direct', plataforma: 'android' })).toBe(
      'http://10.0.2.2:3000',
    );
  });

  test('sem hostUri cai no padrão de emulador por plataforma', () => {
    expect(resolverUrlBaseApi({ ...vazio, plataforma: 'android' })).toBe('http://10.0.2.2:3000');
    expect(resolverUrlBaseApi({ ...vazio, plataforma: 'ios' })).toBe('http://localhost:3000');
  });

  test('valores em branco são tratados como ausentes', () => {
    expect(resolverUrlBaseApi({ env: '  ', extra: '', hostUri: undefined, plataforma: 'ios' })).toBe(
      'http://localhost:3000',
    );
  });
});
