import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Perfil } from '../../generated/prisma';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SUPABASE_CLIENT } from '../../src/supabase/supabase-client.token';

const DOMINIO_FIXTURE = 'teste.montacontrol.local';
const SENHA_FIXTURE_PADRAO = 'Fixture-e2e-123!';

export interface UsuarioFixture {
  authUserId: string;
  usuarioId: number;
  nome: string;
  email: string;
  senha: string;
  perfil: Perfil;
  ativo: boolean;
}

export interface CriarUsuarioFixtureOpcoes {
  perfil?: Perfil;
  ativo?: boolean;
  senha?: string;
  nome?: string;
  /** Pula a linha em `usuario` — para simular usuário órfão no GoTrue (N1T2). */
  semLinhaUsuario?: boolean;
}

/**
 * Cria um usuário real no GoTrue (Admin API) + linha em `usuario`, com
 * e-mail prefixado `e2e-<uuid>@teste.montacontrol.local`. O prefixo é o que
 * permite isolamento por limpeza seletiva num banco compartilhado com o
 * desenvolvimento — nunca um `TRUNCATE`.
 */
export async function criarUsuarioFixture(
  app: INestApplication,
  opcoes: CriarUsuarioFixtureOpcoes = {},
): Promise<UsuarioFixture> {
  const supabase = app.get<SupabaseClient>(SUPABASE_CLIENT);
  const prisma = app.get(PrismaService);

  const perfil = opcoes.perfil ?? Perfil.MONTADOR;
  const ativo = opcoes.ativo ?? true;
  const senha = opcoes.senha ?? SENHA_FIXTURE_PADRAO;
  const nome = opcoes.nome ?? 'Usuário Fixture e2e';
  const email = `e2e-${randomUUID()}@${DOMINIO_FIXTURE}`;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Falha ao criar usuário fixture no GoTrue: ${error?.message ?? 'sem dados de usuário'}`);
  }

  let usuarioId = 0;
  if (!opcoes.semLinhaUsuario) {
    try {
      const usuario = await prisma.usuario.create({
        data: { nome, email, authUserId: data.user.id, perfil, ativo },
      });
      usuarioId = usuario.id;
    } catch (erro) {
      // Não deixa o usuário do GoTrue órfão se a linha em `usuario` falhar.
      await supabase.auth.admin.deleteUser(data.user.id).catch(() => undefined);
      throw erro;
    }
  }

  return { authUserId: data.user.id, usuarioId, nome, email, senha, perfil, ativo };
}

/**
 * Desfaz tudo que o usuário fixture criou, de dentro para fora (FK-safe):
 * fotos do bucket de atestados, dependentes em `usuario` (atestados, jornadas,
 * solicitações de ponto, banco de horas, avarias, cautelas, EPIs, pedidos),
 * a linha em `usuario` e por fim o usuário no GoTrue.
 *
 * Todas as etapas são tentadas mesmo se uma falhar; as falhas são acumuladas
 * e relançadas ao final — uma limpeza engolida seria lixo permanente no banco
 * compartilhado, então o `afterAll` deve falhar alto em vez de só avisar.
 */
export async function apagarUsuarioFixture(app: INestApplication, fixture: UsuarioFixture): Promise<void> {
  const supabase = app.get<SupabaseClient>(SUPABASE_CLIENT);
  const prisma = app.get(PrismaService);
  const falhas: string[] = [];
  const tentar = async (etapa: string, acao: () => Promise<unknown>): Promise<void> => {
    try {
      await acao();
    } catch (erro) {
      falhas.push(`${etapa}: ${erro instanceof Error ? erro.message : String(erro)}`);
    }
  };

  if (fixture.usuarioId) {
    const id = fixture.usuarioId;
    const porUsuario = { usuarioId: id };
    await tentar('arquivos do bucket de atestados', async () => {
      const fotos = await prisma.atestadoFoto.findMany({
        where: { atestado: porUsuario },
        select: { storagePath: true },
      });
      const bucket = process.env.SUPABASE_BUCKET_ATESTADOS;
      if (fotos.length === 0) return;
      if (!bucket) throw new Error('SUPABASE_BUCKET_ATESTADOS ausente');
      const { error } = await supabase.storage.from(bucket).remove(fotos.map((f) => f.storagePath));
      if (error) throw new Error(error.message);
    });
    await tentar(`dependentes e linha de usuario id=${id}`, () =>
      prisma.$transaction([
        // Referências de outros usuários (fixtures de RH/analista) a este id: só desvincula.
        prisma.atestado.updateMany({ where: { validadoPor: id }, data: { validadoPor: null, validadoAt: null } }),
        prisma.solicitacaoPonto.updateMany({ where: { analisadoPor: id }, data: { analisadoPor: null } }),
        prisma.peca.updateMany({ where: { triadaPor: id }, data: { triadaPor: null } }),
        prisma.peca.updateMany({ where: { conferidaPor: id }, data: { conferidaPor: null } }),
        prisma.atestadoFoto.deleteMany({ where: { atestado: porUsuario } }),
        prisma.atestado.deleteMany({ where: porUsuario }),
        prisma.solicitacaoPonto.deleteMany({ where: porUsuario }),
        prisma.jornada.deleteMany({ where: porUsuario }),
        prisma.bancoHoras.deleteMany({ where: porUsuario }),
        prisma.avariaFoto.deleteMany({ where: { avaria: { registradaPor: id } } }),
        prisma.avaria.deleteMany({ where: { registradaPor: id } }),
        prisma.pedidoMontador.deleteMany({ where: porUsuario }),
        prisma.cautela.deleteMany({ where: porUsuario }),
        prisma.epi.deleteMany({ where: porUsuario }),
        prisma.usuario.delete({ where: { id } }),
      ]),
    );
  }
  await tentar(`auth user id=${fixture.authUserId}`, async () => {
    const { error } = await supabase.auth.admin.deleteUser(fixture.authUserId);
    if (error) throw new Error(error.message);
  });

  if (falhas.length > 0) {
    throw new Error(`[fixture] limpeza incompleta (${fixture.email}): ${falhas.join(' | ')}`);
  }
}

/**
 * Apaga várias fixtures (da última para a primeira). Uma falha não interrompe
 * as demais — todas são tentadas e as falhas relançadas juntas ao final.
 */
export async function apagarUsuariosFixture(app: INestApplication, fixtures: UsuarioFixture[]): Promise<void> {
  const falhas: string[] = [];
  for (const fixture of [...fixtures].reverse()) {
    try {
      await apagarUsuarioFixture(app, fixture);
    } catch (erro) {
      falhas.push(erro instanceof Error ? erro.message : String(erro));
    }
  }
  if (falhas.length > 0) throw new Error(falhas.join('\n'));
}
