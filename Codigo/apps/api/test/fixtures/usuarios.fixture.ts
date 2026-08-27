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
    const usuario = await prisma.usuario.create({
      data: { nome, email, authUserId: data.user.id, perfil, ativo },
    });
    usuarioId = usuario.id;
  }

  return { authUserId: data.user.id, usuarioId, nome, email, senha, perfil, ativo };
}

/**
 * Desfaz exatamente o que `criarUsuarioFixture` criou, na ordem inversa:
 * linha em `usuario` primeiro, depois o usuário no GoTrue. Falha de limpeza
 * não derruba a suíte — só avisa, para não mascarar o resultado dos testes.
 */
export async function apagarUsuarioFixture(app: INestApplication, fixture: UsuarioFixture): Promise<void> {
  const supabase = app.get<SupabaseClient>(SUPABASE_CLIENT);
  const prisma = app.get(PrismaService);

  if (fixture.usuarioId) {
    await prisma.usuario.delete({ where: { id: fixture.usuarioId } }).catch((erro: unknown) => {
      console.warn(`[fixture] falha ao apagar usuario id=${fixture.usuarioId}:`, erro);
    });
  }
  await supabase.auth.admin.deleteUser(fixture.authUserId).catch((erro: unknown) => {
    console.warn(`[fixture] falha ao apagar auth user id=${fixture.authUserId}:`, erro);
  });
}
