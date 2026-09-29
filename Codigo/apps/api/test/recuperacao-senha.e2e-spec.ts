import { INestApplication } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import request from 'supertest';
import { SUPABASE_CLIENT } from '../src/supabase/supabase-client.token';
import { criarApp } from './setup/criar-app';
import { apagarUsuariosFixture, criarUsuarioFixture, UsuarioFixture } from './fixtures/usuarios.fixture';

const CORPO_202_FIXO = {
  message: 'Se o e-mail informado existir em nossa base, um código de recuperação foi enviado.',
};

describe('Recuperação de senha (e2e)', () => {
  let app: INestApplication;
  const fixturesCriadas: UsuarioFixture[] = [];

  beforeAll(async () => {
    app = await criarApp();
  });

  afterAll(async () => {
    try {
      await apagarUsuariosFixture(app, fixturesCriadas);
    } finally {
      await app.close();
    }
  });

  describe('POST /api/auth/recuperar-senha', () => {
    it('e-mail existente → 202 com corpo fixo', async () => {
      const usuario = await criarUsuarioFixture(app);
      fixturesCriadas.push(usuario);

      const resposta = await request(app.getHttpServer())
        .post('/api/auth/recuperar-senha')
        .send({ email: usuario.email })
        .expect(202);
      expect(resposta.body).toEqual(CORPO_202_FIXO);
    });

    it('e-mail inexistente → mesmo 202 com o mesmo corpo fixo (sem enumeração de contas)', async () => {
      const resposta = await request(app.getHttpServer())
        .post('/api/auth/recuperar-senha')
        .send({ email: `e2e-inexistente-${Date.now()}@teste.montacontrol.local` })
        .expect(202);
      expect(resposta.body).toEqual(CORPO_202_FIXO);
    });
  });

  describe('POST /api/auth/redefinir-senha', () => {
    it('OTP de recuperação válido (gerado via Admin API) → 204, senha atualizada', async () => {
      const usuario = await criarUsuarioFixture(app);
      fixturesCriadas.push(usuario);

      const supabase = app.get<SupabaseClient>(SUPABASE_CLIENT);
      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: usuario.email,
      });
      if (error || !data.properties?.email_otp) {
        throw new Error(`Falha ao gerar link de recuperação: ${error?.message ?? 'sem email_otp'}`);
      }
      const novaSenha = 'Nova-Senha-e2e-456!';

      await request(app.getHttpServer())
        .post('/api/auth/redefinir-senha')
        .send({ email: usuario.email, token: data.properties.email_otp, novaSenha })
        .expect(204);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: usuario.email, senha: novaSenha })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: usuario.email, senha: usuario.senha })
        .expect(401);
    });

    it('reuso de um token já consumido → 400', async () => {
      const usuario = await criarUsuarioFixture(app);
      fixturesCriadas.push(usuario);

      const supabase = app.get<SupabaseClient>(SUPABASE_CLIENT);
      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: usuario.email,
      });
      if (error || !data.properties?.email_otp) {
        throw new Error(`Falha ao gerar link de recuperação: ${error?.message ?? 'sem email_otp'}`);
      }

      await request(app.getHttpServer())
        .post('/api/auth/redefinir-senha')
        .send({ email: usuario.email, token: data.properties.email_otp, novaSenha: 'Primeira-Troca-e2e-1!' })
        .expect(204);

      await request(app.getHttpServer())
        .post('/api/auth/redefinir-senha')
        .send({ email: usuario.email, token: data.properties.email_otp, novaSenha: 'Segunda-Troca-e2e-2!' })
        .expect(400);
    });

    it('token de recuperação inválido → 400', async () => {
      const usuario = await criarUsuarioFixture(app);
      fixturesCriadas.push(usuario);

      await request(app.getHttpServer())
        .post('/api/auth/redefinir-senha')
        .send({ email: usuario.email, token: '000000', novaSenha: 'Qualquer-Senha-789!' })
        .expect(400);
    });
  });
});
