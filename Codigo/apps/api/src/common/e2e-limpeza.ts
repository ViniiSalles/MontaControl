/**
 * Partes puras do script `scripts/limpar-dados-e2e.ts` (parse de argumentos e filtros de exclusão).
 * Ficam em `src/` para serem testadas com o jest do pacote.
 */
export const EMAIL_MONTADOR_SEED = 'montador@montacontrol.local';
export const PREFIXO_EMAIL_E2E = 'e2e-montador-';
export const SUFIXO_EMAIL_E2E = '@teste.montacontrol.local';
export const ESCOPOS = ['atestados', 'jornadas', 'usuarios-e2e'] as const;
export type Escopo = (typeof ESCOPOS)[number];

export const LIMITE_DESDE_MS = 24 * 60 * 60 * 1000;
const REGEX_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export interface Opcoes {
  desde: Date;
  escopos: Escopo[];
  dryRun: boolean;
  forcar: boolean;
}

/** Interpreta os argumentos de linha de comando. Lança Error se inválidos. */
export function lerArgumentos(argv: string[], agora: Date = new Date()): Opcoes {
  let desdeBruto: string | undefined;
  let escoposBrutos: string | undefined;
  let dryRun = false;
  let forcar = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--forcar') forcar = true;
    else if (arg === '--desde') desdeBruto = argv[++i];
    else if (arg === '--escopos') escoposBrutos = argv[++i];
    else if (arg.startsWith('--desde=')) desdeBruto = arg.slice('--desde='.length);
    else if (arg.startsWith('--escopos=')) escoposBrutos = arg.slice('--escopos='.length);
    else throw new Error(`Argumento desconhecido: ${arg}`);
  }
  if (!desdeBruto) throw new Error('--desde <ISO datetime> é obrigatório');
  if (!REGEX_ISO.test(desdeBruto)) {
    throw new Error(`--desde deve ser um datetime ISO-8601 completo (ex.: 2026-09-26T12:00:00Z): ${desdeBruto}`);
  }
  const desde = new Date(desdeBruto);
  if (Number.isNaN(desde.getTime())) throw new Error(`--desde inválido: ${desdeBruto}`);
  if (agora.getTime() - desde.getTime() > LIMITE_DESDE_MS && !forcar) {
    throw new Error(
      '--desde está a mais de 24h no passado; isso pode apagar dados manuais do montador seed. ' +
        'Se for intencional, repita com --forcar.',
    );
  }

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
  return { desde, escopos: escopos as Escopo[], dryRun, forcar };
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
