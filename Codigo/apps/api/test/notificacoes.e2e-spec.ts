import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { WS_EVENTS, type NotificacaoDTO } from '@montacontrol/shared';
import request from 'supertest';
import { Perfil } from '../generated/prisma';
import { AppModule } from '../src/app.module';
import { UsuarioAutenticado } from '../src/auth/usuario-autenticado';
import { VerificadorTokenService } from '../src/auth/verificador-token.service';
import { TokenInvalidoException } from '../src/common/exceptions/token-invalido.exception';
import { configurarLimiteCorpo } from '../src/common/limite-corpo';
import { NotificacoesGateway } from '../src/notificacoes/notificacoes.gateway';
import { NotificacoesRepository } from '../src/notificacoes/notificacoes.repository';
import { PrismaService } from '../src/prisma/prisma.service';

const MONTADOR: UsuarioAutenticado = {
  id: 101,
  nome: 'Montador e2e',
  email: 'montador-e2e@teste.montacontrol.local',
  perfil: Perfil.MONTADOR,
  ativo: true,
  authUserId: '10101010-1010-1010-1010-101010101010',
};

const GESTOR: UsuarioAutenticado = {
  id: 202,
  nome: 'Gestor e2e',
  email: 'gestor-e2e@teste.montacontrol.local',
  perfil: Perfil.GESTOR,
  ativo: true,
  authUserId: '20202020-2020-2020-2020-202020202020',
};

const TOKENS: Record<string, UsuarioAutenticado> = {
  'token-montador': MONTADOR,
  'token-gestor': GESTOR,
};

type LinhaEmMemoria = NotificacaoDTO & { usuarioId: number };

function linha(id: number, usuarioId: number, lida = false): LinhaEmMemoria {
  return {
    id,
    usuarioId,
    tipo: 'AVARIA_ATUALIZADA',
    titulo: `Notificação ${id}`,
    mensagem: `Mensagem ${id}`,
    referenciaTipo: 'AVARIA',
    referenciaId: id,
    lida,
    criadaEm: new Date(Date.UTC(2026, 9, 27, 12, id)).toISOString(),
  };
}

/** O DTO não carrega o dono, como o do repositório real. */
function paraDTO(l: LinhaEmMemoria): NotificacaoDTO {
  const { id, tipo, titulo, mensagem, referenciaTipo, referenciaId, lida, criadaEm } = l;
  return { id, tipo, titulo, mensagem, referenciaTipo, referenciaId, lida, criadaEm };
}

/**
 * Duplo do `NotificacoesRepository` com a mesma semântica de escopo por
 * `usuarioId` — a garantia de que a query filtra pelo dono está no spec do
 * repositório; aqui se verifica que a borda HTTP sempre usa o usuário do token.
 */
class NotificacoesRepositoryEmMemoria {
  linhas: LinhaEmMemoria[] = [];

  async criarVarias(): Promise<never[]> {
    return [];
  }

  async listarDoUsuario(
    usuarioId: number,
    limite: number,
    antesDe?: number,
  ): Promise<NotificacaoDTO[]> {
    return this.linhas
      .filter((l) => l.usuarioId === usuarioId && (antesDe === undefined || l.id < antesDe))
      .sort((a, b) => b.id - a.id)
      .slice(0, limite)
      .map(paraDTO);
  }

  async contarNaoLidas(usuarioId: number): Promise<number> {
    return this.linhas.filter((l) => l.usuarioId === usuarioId && !l.lida).length;
  }

  async marcarLida(id: number, usuarioId: number): Promise<boolean> {
    const alvo = this.linhas.find((l) => l.id === id && l.usuarioId === usuarioId);
    if (!alvo) return false;
    alvo.lida = true;
    return true;
  }

  async marcarTodasLidas(usuarioId: number): Promise<number> {
    const alvos = this.linhas.filter((l) => l.usuarioId === usuarioId && !l.lida);
    alvos.forEach((l) => (l.lida = true));
    return alvos.length;
  }
}

/**
 * REST de notificações com a aplicação completa (guards, pipe e filtro
 * reais). Sem banco: Prisma, repositório e verificação do JWT são duplos —
 * o guard real continua decidindo 401 a partir do verificador.
 */
describe('/api/notificacoes (e2e)', () => {
  let app: INestApplication;
  const repositorio = new NotificacoesRepositoryEmMemoria();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(NotificacoesRepository)
      .useValue(repositorio)
      .overrideProvider(VerificadorTokenService)
      .useValue({
        verificar: async (token: string): Promise<UsuarioAutenticado> => {
          const usuario = TOKENS[token];
          if (!usuario) throw new TokenInvalidoException('Token inválido ou expirado');
          return usuario;
        },
      })
      .compile();

    const appExpress = moduleFixture.createNestApplication<NestExpressApplication>();
    configurarLimiteCorpo(appExpress);
    appExpress.setGlobalPrefix('api');
    // `listen` em vez de só `init`: o supertest fecharia o servidor HTTP a cada
    // requisição, e o Engine.IO encerra as sessões de polling quando ele fecha.
    await appExpress.listen(0, '127.0.0.1');
    app = appExpress;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repositorio.linhas = [
      linha(1, MONTADOR.id),
      linha(2, GESTOR.id),
      linha(3, MONTADOR.id),
      linha(4, GESTOR.id),
      linha(5, MONTADOR.id, true),
    ];
  });

  const doMontador = (): LinhaEmMemoria[] =>
    repositorio.linhas.filter((l) => l.usuarioId === MONTADOR.id);
  const doGestor = (): LinhaEmMemoria[] =>
    repositorio.linhas.filter((l) => l.usuarioId === GESTOR.id);

  it('sem token → 401', async () => {
    const http = app.getHttpServer();
    await request(http).get('/api/notificacoes').expect(401);
    await request(http).patch('/api/notificacoes/1/lida').expect(401);
    await request(http).post('/api/notificacoes/marcar-todas-lidas').expect(401);
    await request(http)
      .get('/api/notificacoes')
      .set('Authorization', 'Bearer token-desconhecido')
      .expect(401);
    expect(repositorio.linhas.every((l) => l.id === 5 || !l.lida)).toBe(true);
  });

  it('lista só as próprias notificações', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/api/notificacoes')
      .set('Authorization', 'Bearer token-montador')
      .expect(200);

    expect(resposta.body.itens.map((n: NotificacaoDTO) => n.id)).toEqual([5, 3, 1]);
    expect(resposta.body.naoLidas).toBe(2);
    expect(resposta.body.proximoCursor).toBeNull();

    const doOutro = await request(app.getHttpServer())
      .get('/api/notificacoes')
      .set('Authorization', 'Bearer token-gestor')
      .expect(200);
    expect(doOutro.body.itens.map((n: NotificacaoDTO) => n.id)).toEqual([4, 2]);
  });

  it('não aceita escolher o dono pela query string', async () => {
    await request(app.getHttpServer())
      .get(`/api/notificacoes?usuarioId=${GESTOR.id}`)
      .set('Authorization', 'Bearer token-montador')
      .expect(400);
  });

  it('pagina por cursor com limite e antesDe', async () => {
    const primeira = await request(app.getHttpServer())
      .get('/api/notificacoes?limite=2')
      .set('Authorization', 'Bearer token-montador')
      .expect(200);
    expect(primeira.body.itens.map((n: NotificacaoDTO) => n.id)).toEqual([5, 3]);
    expect(primeira.body.proximoCursor).toBe(3);

    const segunda = await request(app.getHttpServer())
      .get(`/api/notificacoes?limite=2&antesDe=${primeira.body.proximoCursor}`)
      .set('Authorization', 'Bearer token-montador')
      .expect(200);
    expect(segunda.body.itens.map((n: NotificacaoDTO) => n.id)).toEqual([1]);
    expect(segunda.body.proximoCursor).toBeNull();
  });

  it.each(['limite=0', 'limite=51', 'limite=abc', 'antesDe=0', 'antesDe=-1', 'antesDe=1.5'])(
    'rejeita query inválida (%s) → 400',
    async (query) => {
      await request(app.getHttpServer())
        .get(`/api/notificacoes?${query}`)
        .set('Authorization', 'Bearer token-montador')
        .expect(400);
    },
  );

  it('PATCH lida em notificação alheia → 404', async () => {
    await request(app.getHttpServer())
      .patch('/api/notificacoes/2/lida')
      .set('Authorization', 'Bearer token-montador')
      .expect(404);

    expect(repositorio.linhas.find((l) => l.id === 2)?.lida).toBe(false);
  });

  it('PATCH lida na própria notificação → 204', async () => {
    await request(app.getHttpServer())
      .patch('/api/notificacoes/1/lida')
      .set('Authorization', 'Bearer token-montador')
      .expect(204);

    expect(repositorio.linhas.find((l) => l.id === 1)?.lida).toBe(true);
  });

  it('PATCH lida com id não numérico → 400', async () => {
    await request(app.getHttpServer())
      .patch('/api/notificacoes/abc/lida')
      .set('Authorization', 'Bearer token-montador')
      .expect(400);
  });

  it('marcar-todas só altera as próprias', async () => {
    await request(app.getHttpServer())
      .post('/api/notificacoes/marcar-todas-lidas')
      .set('Authorization', 'Bearer token-montador')
      .expect(204);

    expect(doMontador().every((l) => l.lida)).toBe(true);
    expect(doGestor().every((l) => !l.lida)).toBe(true);
  });

  /**
   * Handshake real no path padrão `/socket.io`, falando o protocolo do
   * Engine.IO v4 por long-polling (sem `socket.io-client` na API): abre a
   * sessão, envia o pacote CONNECT (`40` + auth) e lê a resposta.
   */
  describe('gateway Socket.io', () => {
    const URL_POLLING = '/socket.io/?EIO=4&transport=polling';

    async function abrirSessao(): Promise<string> {
      const resposta = await request(app.getHttpServer()).get(URL_POLLING).expect(200);
      return (JSON.parse(resposta.text.slice(1)) as { sid: string }).sid;
    }

    async function enviar(sid: string, pacote: string): Promise<void> {
      await request(app.getHttpServer())
        .post(`${URL_POLLING}&sid=${sid}`)
        .set('Content-Type', 'text/plain;charset=UTF-8')
        .send(pacote)
        .expect(200);
    }

    async function receber(sid: string): Promise<string> {
      const resposta = await request(app.getHttpServer())
        .get(`${URL_POLLING}&sid=${sid}`)
        .expect(200);
      return resposta.text;
    }

    async function conectar(
      auth: Record<string, string>,
    ): Promise<{ sid: string; resposta: string }> {
      const sid = await abrirSessao();
      await enviar(sid, `40${JSON.stringify(auth)}`);
      return { sid, resposta: await receber(sid) };
    }

    it('CORS: só libera origem listada em WS_CORS_ORIGENS', async () => {
      const original = process.env.WS_CORS_ORIGENS;
      try {
        delete process.env.WS_CORS_ORIGENS;
        const semConfig = await request(app.getHttpServer())
          .get(URL_POLLING)
          .set('Origin', 'https://app.montacontrol.com.br')
          .expect(200);
        expect(semConfig.headers['access-control-allow-origin']).toBeUndefined();

        process.env.WS_CORS_ORIGENS = 'https://app.montacontrol.com.br';
        const listada = await request(app.getHttpServer())
          .get(URL_POLLING)
          .set('Origin', 'https://app.montacontrol.com.br')
          .expect(200);
        expect(listada.headers['access-control-allow-origin']).toBe(
          'https://app.montacontrol.com.br',
        );

        const outra = await request(app.getHttpServer())
          .get(URL_POLLING)
          .set('Origin', 'https://malicioso.example.com')
          .expect(200);
        expect(outra.headers['access-control-allow-origin']).toBeUndefined();
      } finally {
        if (original === undefined) delete process.env.WS_CORS_ORIGENS;
        else process.env.WS_CORS_ORIGENS = original;
      }
    });

    it('recusa handshake sem token com mensagem genérica', async () => {
      const { resposta } = await conectar({});
      expect(resposta).toBe('44{"message":"credenciais inválidas"}');
    });

    it('recusa handshake com token inválido com a mesma mensagem genérica', async () => {
      const { resposta } = await conectar({ token: 'token-desconhecido' });
      expect(resposta).toBe('44{"message":"credenciais inválidas"}');
    });

    it('aceita token válido e entrega notificacao:nova da sala do próprio usuário', async () => {
      const { sid, resposta } = await conectar({ token: 'token-montador' });
      expect(resposta.startsWith('40{"sid"')).toBe(true);

      const gateway = app.get(NotificacoesGateway);
      const dto = paraDTO(linha(99, MONTADOR.id));
      gateway.emitirParaUsuario(MONTADOR.id, dto);

      expect(await receber(sid)).toBe(`42${JSON.stringify([WS_EVENTS.NOTIFICACAO_NOVA, dto])}`);
    });
  });
});
