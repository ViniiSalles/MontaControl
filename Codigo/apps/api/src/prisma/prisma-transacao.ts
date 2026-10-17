import type { PrismaService } from './prisma.service';

/**
 * Cliente do Prisma dentro de uma `$transaction` interativa. Os repositórios o
 * recebem como parâmetro opcional para participar da transação de quem chama;
 * o service só repassa o valor, sem nunca importar o Prisma.
 */
export type PrismaTransacao = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];
