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

export const EMAIL_MONTADOR_SEED = 'montador@montacontrol.local';
export const PREFIXO_EMAIL_E2E = 'e2e-montador-';
export const SUFIXO_EMAIL_E2E = '@teste.montacontrol.local';
export const ESCOPOS = ['atestados', 'jornadas', 'usuarios-e2e'] as const;
export type Escopo = (typeof ESCOPOS)[number];

export interface Opcoes {
  desde: Date;
  escopos: Escopo[];
  dryRun: boolean;
}

/** Interpreta os argumentos de linha de comando. Lança Error se inválidos. */
export function lerArgumentos(argv: string[]): Opcoes {
  let desdeBruto: string | undefined;
  let escoposBrutos: string | undefined;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--desde') desdeBruto = argv[++i];
    else if (arg === '--escopos') escoposBrutos = argv[++i];
    else if (arg.startsWith('--desde=')) desdeBruto = arg.slice('--desde='.length);
    else if (arg.startsWith('--escopos=')) escoposBrutos = arg.slice('--escopos='.length);
    else throw new Error(`Argumento desconhecido: ${arg}`);
  }
  if (!desdeBruto) throw new Error('--desde <ISO datetime> é obrigatório');
  const desde = new Date(desdeBruto);
  if (Number.isNaN(desde.getTime())) throw new Error(`--desde inválido: ${desdeBruto}`);

  const escopos = escoposBrutos
    ? escoposBrutos
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
    : [...ESCOPOS];
  for (const e of escopos) {
    if (!(ESCOPOS as readonly string[]).includes(e)) {
      throw new Error(`Escopo inválido: ${e} (válidos: ${ESCOPOS.join(', ')})`);
    }
  }
  return { desde, escopos: escopos as Escopo[], dryRun };
}

/** Filtro dos usuários e2e: prefixo + sufixo do e-mail e criados a partir de `desde`. */
export function filtroUsuariosE2e(desde: Date) {
  return {
    email: { startsWith: PREFIXO_EMAIL_E2E, endsWith: SUFIXO_EMAIL_E2E },
    createdAt: { gte: desde },
  };
}

/** Filtro de atestados do montador seed criados a partir de `desde`. */
export function filtroAtestadosSeed(desde: Date) {
  return { usuario: { email: EMAIL_MONTADOR_SEED }, createdAt: { gte: desde } };
}

/** Filtro de jornadas do montador seed criadas a partir de `desde` (sem solicitação de ponto ligada). */
export function filtroJornadasSeed(desde: Date) {
  return { usuario: { email: EMAIL_MONTADOR_SEED }, createdAt: { gte: desde }, solicitacaoPonto: null };
}

const ids = (linhas: Array<{ id: number }>): string => linhas.map((l) => l.id).join(',') || '-';

async function limparAtestados(
  prisma: PrismaClient,
  supabase: SupabaseClient,
  { desde, dryRun }: Opcoes,
): Promise<string> {
  const where = filtroAtestadosSeed(desde);
  const atestados = await prisma.atestado.findMany({ where, select: { id: true } });
  const fotos = await prisma.atestadoFoto.findMany({
    where: { atestado: where },
    select: { id: true, storagePath: true },
  });
  const caminhos = fotos.map((f) => f.storagePath);
  if (dryRun) {
    return `atestados: ${atestados.length} (ids ${ids(atestados)}); fotos: ${fotos.length}; arquivos a remover: ${caminhos.length}`;
  }
  await prisma.atestadoFoto.deleteMany({ where: { atestado: where } });
  const { count } = await prisma.atestado.deleteMany({ where });
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
  if (dryRun) return `jornadas: ${jornadas.length} (ids ${ids(jornadas)})`;
  const { count } = await prisma.jornada.deleteMany({ where });
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
        prisma.jornada.deleteMany({ where: porUsuario }),
        prisma.bancoHoras.deleteMany({ where: porUsuario }),
        prisma.pedidoMontador.deleteMany({ where: porUsuario }),
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

async function main(): Promise<void> {
  const opcoes = lerArgumentos(process.argv.slice(2));
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
