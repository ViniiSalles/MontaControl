import * as shared from '@montacontrol/shared';
import * as prisma from '../../generated/prisma';

/**
 * Guarda de drift: os enums de domínio existem em dois lugares —
 * `packages/shared` (contrato de fio com Web/Mobile) e `schema.prisma`
 * (fonte para o banco). Uma mudança num lado sem o outro quebraria a API
 * silenciosamente; este teste falha alto assim que os dois divergirem.
 */
const ENUMS_COMPARTILHADOS = [
  'Perfil',
  'StatusPedido',
  'StatusAmbiente',
  'StatusPeca',
  'StatusAvaria',
  'StatusJornada',
  'StatusAtestado',
] as const;

describe('Contrato de enums: @montacontrol/shared vs schema.prisma', () => {
  it.each(ENUMS_COMPARTILHADOS)('%s tem os mesmos valores nos dois lados', (nomeEnum) => {
    const enumCompartilhado = shared[nomeEnum] as Record<string, string>;
    const enumPrisma = prisma[nomeEnum] as Record<string, string>;

    expect(enumCompartilhado).toBeDefined();
    expect(enumPrisma).toBeDefined();
    expect(Object.values(enumCompartilhado).sort()).toEqual(Object.values(enumPrisma).sort());
  });
});
