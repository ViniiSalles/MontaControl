import 'reflect-metadata';
import { Controller, Get, INestApplication, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import request from 'supertest';
import { configurarProxyConfiavel, criarOpcoesThrottler, resolverIpCliente } from '../ip-cliente';

describe('resolverIpCliente', () => {
  it('sem cabeçalho configurado, usa req.ip e ignora cabeçalhos enviados pelo cliente', () => {
    const req = { ip: '10.0.0.1', headers: { 'true-client-ip': '203.0.113.7' } };
    expect(resolverIpCliente(req)).toBe('10.0.0.1');
  });

  it('com cabeçalho configurado e IP válido, usa o cabeçalho', () => {
    const req = { ip: '10.0.0.1', headers: { 'true-client-ip': ' 203.0.113.7 ' } };
    expect(resolverIpCliente(req, 'true-client-ip')).toBe('203.0.113.7');
  });

  it('aceita IPv6 no cabeçalho', () => {
    const req = { ip: '10.0.0.1', headers: { 'cf-connecting-ip': '2001:db8::1' } };
    expect(resolverIpCliente(req, 'cf-connecting-ip')).toBe('2001:db8::1');
  });

  it.each([
    ['ausente', {}],
    ['vazio', { 'true-client-ip': '' }],
    ['que não é IP', { 'true-client-ip': 'nao-sou-ip' }],
    ['com lista de IPs', { 'true-client-ip': '203.0.113.7, 198.51.100.9' }],
    ['duplicado', { 'true-client-ip': ['203.0.113.7', '198.51.100.9'] }],
  ])('com cabeçalho %s, cai para req.ip', (_caso, headers) => {
    expect(resolverIpCliente({ ip: '10.0.0.1', headers }, 'true-client-ip')).toBe('10.0.0.1');
  });
});

@Controller()
class IpController {
  @Get('ip')
  ip(@Req() req: Request): { ip: string | undefined } {
    return { ip: req.ip };
  }
}

/** App mínima com o mesmo `trust proxy` e o mesmo tracker do throttler da API real. */
async function criarAppTeste(env: Record<string, unknown>, limite = 100): Promise<INestApplication> {
  const config = new ConfigService(env);
  const opcoes = criarOpcoesThrottler(config);
  const moduleRef = await Test.createTestingModule({
    imports: [
      ThrottlerModule.forRoot({
        ...opcoes,
        throttlers: [{ name: 'default', ttl: 60_000, limit: limite }],
      }),
    ],
    controllers: [IpController],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configurarProxyConfiavel(app, config.get<number>('TRUST_PROXY_HOPS', 0));
  await app.init();
  return app;
}

describe('trust proxy (req.ip)', () => {
  let app: INestApplication;
  afterEach(() => app.close());

  it('com 0 hops (default), ignora X-Forwarded-For e usa o socket', async () => {
    app = await criarAppTeste({});
    const res = await request(app.getHttpServer()).get('/ip').set('X-Forwarded-For', '203.0.113.7');
    expect(res.body.ip).not.toBe('203.0.113.7');
    expect(res.body.ip).toMatch(/127\.0\.0\.1|::1/);
  });

  it('com N hops, pega a N-ésima entrada da direita — prefixo forjado pelo cliente é ignorado', async () => {
    app = await criarAppTeste({ TRUST_PROXY_HOPS: 2 });
    // Cliente forja 6.6.6.6; o 1º proxy acrescenta o IP real; o 2º, o do 1º proxy.
    const res = await request(app.getHttpServer())
      .get('/ip')
      .set('X-Forwarded-For', '6.6.6.6, 203.0.113.7, 172.71.0.1');
    expect(res.body.ip).toBe('203.0.113.7');
  });
});

describe('rate limit por IP de cliente', () => {
  let app: INestApplication;
  afterEach(() => app.close());

  it('sem proxy confiável, variar X-Forwarded-For não burla o limite', async () => {
    app = await criarAppTeste({}, 2);
    const servidor = app.getHttpServer();
    await request(servidor).get('/ip').set('X-Forwarded-For', '1.1.1.1').expect(200);
    await request(servidor).get('/ip').set('X-Forwarded-For', '2.2.2.2').expect(200);
    await request(servidor).get('/ip').set('X-Forwarded-For', '3.3.3.3').expect(429);
  });

  it('com CLIENT_IP_HEADER, cada cliente real tem o próprio limite', async () => {
    app = await criarAppTeste({ CLIENT_IP_HEADER: 'true-client-ip' }, 2);
    const servidor = app.getHttpServer();
    await request(servidor).get('/ip').set('True-Client-IP', '203.0.113.7').expect(200);
    await request(servidor).get('/ip').set('True-Client-IP', '203.0.113.7').expect(200);
    await request(servidor).get('/ip').set('True-Client-IP', '203.0.113.7').expect(429);
    await request(servidor).get('/ip').set('True-Client-IP', '198.51.100.9').expect(200);
  });
});
