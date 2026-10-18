/**
 * Limpeza dos dados criados pela suíte e2e da Web (apps/web/e2e) no banco/Supabase de dev.
 *
 * Uso (a partir de Codigo/):
 *   pnpm --filter @montacontrol/api e2e:limpar --desde 2026-09-26T12:00:00Z [--escopos atestados,jornadas,usuarios-e2e] [--dry-run]
 *
 * Só remove o que o e2e poderia ter criado: atestados/jornadas do montador seed e usuários
 * `e2e-montador-*@teste.montacontrol.local`, sempre com `createdAt >= desde`.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env' });

import {
  filtroAtestadosSeed,
  filtroJornadasSeed,
  filtroUsuariosE2e,
  lerArgumentos,
  type Opcoes,
} from '../src/common/e2e-limpeza';

const ids = (linhas: Array<{ id: number }>): string => linhas.map((l) => l.id).join(',') || '-';

async function limparAtestados(
  prisma: PrismaClient,
  supabase: SupabaseClient,
  { desde, dryRun }: Opcoes,
): Promise<string> {
  const atestados = await prisma.atestado.findMany({
    where: filtroAtestadosSeed(desde),
    select: { id: true },
  });
  const idsAtestados = atestados.map((a) => a.id);
  const fotos = await prisma.atestadoFoto.findMany({
    where: { atestadoId: { in: idsAtestados } },
    select: { storagePath: true },
  });
  const caminhos = fotos.map((f) => f.storagePath);
  if (dryRun) {
    return `atestados: ${atestados.length} (ids ${ids(atestados)}); fotos: ${fotos.length}; arquivos a remover: ${caminhos.length}`;
  }
  console.log(`Removendo ${atestados.length} atestados (ids ${ids(atestados)}), ${fotos.length} fotos.`);
  const [, { count }] = await prisma.$transaction([
    prisma.atestadoFoto.deleteMany({ where: { atestadoId: { in: idsAtestados } } }),
    prisma.atestado.deleteMany({ where: { id: { in: idsAtestados } } }),
  ]);
  const removidos = await removerArquivos(supabase, caminhos);
  return `atestados removidos: ${count}; fotos removidas: ${fotos.length}; arquivos removidos do bucket: ${removidos}/${caminhos.length}`;
}

async function removerArquivos(supabase: SupabaseClient, caminhos: string[]): Promise<number> {
  const bucket = process.env.SUPABASE_BUCKET_ATESTADOS;
  if (caminhos.length === 0) return 0;
  if (!bucket) {
    console.warn('AVISO: SUPABASE_BUCKET_ATESTADOS ausente; arquivos não removidos.');
    return 0;
  }
  let removidos = 0;
  for (let i = 0; i < caminhos.length; i += 100) {
    const lote = caminhos.slice(i, i + 100);
    const { data, error } = await supabase.storage.from(bucket).remove(lote);
    if (error) console.warn(`AVISO: falha ao remover arquivos do bucket: ${error.message}`);
    else removidos += data?.length ?? 0;
  }
  return removidos;
}

async function limparJornadas(prisma: PrismaClient, { desde, dryRun }: Opcoes): Promise<string> {
  const where = filtroJornadasSeed(desde);
  const jornadas = await prisma.jornada.findMany({ where, select: { id: true } });
  const idsJornadas = jornadas.map((j) => j.id);
  if (dryRun) return `jornadas: ${jornadas.length} (ids ${ids(jornadas)})`;
  console.log(`Removendo ${jornadas.length} jornadas (ids ${ids(jornadas)}).`);
  const [, { count }] = await prisma.$transaction([
    prisma.marcacaoPonto.deleteMany({ where: { jornadaId: { in: idsJornadas } } }),
    prisma.jornada.deleteMany({ where: { id: { in: idsJornadas } } }),
  ]);
  return `jornadas removidas: ${count}`;
}

async function limparUsuariosE2e(
  prisma: PrismaClient,
  supabase: SupabaseClient,
  { desde, dryRun }: Opcoes,
): Promise<string> {
  const usuarios = await prisma.usuario.findMany({
    where: filtroUsuariosE2e(desde),
    select: { id: true, authUserId: true },
  });
  if (dryRun) return `usuários e2e: ${usuarios.length} (ids ${ids(usuarios)})`;

  console.log(`Removendo ${usuarios.length} usuários e2e (ids ${ids(usuarios)}).`);
  let removidos = 0;
  let authRemovidos = 0;
  for (const u of usuarios) {
    const porUsuario = { usuarioId: u.id };
    try {
      const atestados = await prisma.atestado.findMany({ where: porUsuario, select: { id: true } });
      const fotos = await prisma.atestadoFoto.findMany({
        where: { atestado: porUsuario },
        select: { storagePath: true },
      });
      await prisma.$transaction([
        prisma.atestadoFoto.deleteMany({ where: { atestado: porUsuario } }),
        prisma.atestado.deleteMany({ where: { id: { in: atestados.map((a) => a.id) } } }),
        prisma.solicitacaoPonto.deleteMany({ where: porUsuario }),
        prisma.marcacaoPonto.deleteMany({ where: porUsuario }),
        prisma.jornada.deleteMany({ where: porUsuario }),
        prisma.bancoHoras.deleteMany({ where: porUsuario }),
        prisma.pedidoMontador.deleteMany({ where: porUsuario }),
        prisma.syncExclusao.deleteMany({ where: porUsuario }),
        prisma.cautela.deleteMany({ where: porUsuario }),
        prisma.epi.deleteMany({ where: porUsuario }),
        prisma.usuario.delete({ where: { id: u.id } }),
      ]);
      removidos++;
      await removerArquivos(
        supabase,
        fotos.map((f) => f.storagePath),
      );
    } catch (erro) {
      console.warn(`AVISO: usuário ${u.id} não removido: ${(erro as Error).message}`);
      continue;
    }
    const { error } = await supabase.auth.admin.deleteUser(u.authUserId);
    if (error) console.warn(`AVISO: falha ao remover usuário ${u.id} do Auth: ${error.message}`);
    else authRemovidos++;
  }
  return `usuários e2e removidos: ${removidos}/${usuarios.length}; usuários Auth removidos: ${authRemovidos}`;
}

function host(url: string | undefined): string {
  try {
    return new URL(url ?? '').host;
  } catch {
    return '(indisponível)';
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('recusado: NODE_ENV=production. Este script só roda contra o banco de dev.');
  }
  const opcoes = lerArgumentos(process.argv.slice(2));
  console.log(
    `[limpar-dados-e2e] alvo: banco=${host(process.env.DATABASE_URL)} supabase=${host(process.env.SUPABASE_URL)}`,
  );
  console.log(
    `[limpar-dados-e2e] desde=${opcoes.desde.toISOString()} escopos=${opcoes.escopos.join(',')}${opcoes.dryRun ? ' (dry-run)' : ''}`,
  );

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    if (opcoes.escopos.includes('atestados')) {
      console.log(await limparAtestados(prisma, supabase, opcoes));
    }
    if (opcoes.escopos.includes('jornadas')) {
      console.log(await limparJornadas(prisma, opcoes));
    }
    if (opcoes.escopos.includes('usuarios-e2e')) {
      console.log(await limparUsuariosE2e(prisma, supabase, opcoes));
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((erro: Error) => {
    console.error(`[limpar-dados-e2e] erro: ${erro.message}`);
    process.exit(1);
  });
}
