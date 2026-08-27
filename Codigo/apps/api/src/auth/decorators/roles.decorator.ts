import { SetMetadata } from '@nestjs/common';
import { Perfil } from '../../../generated/prisma';

export const ROLES_KEY = 'perfis';

/** Restringe o endpoint aos perfis informados (RBAC). Caso de teste N1T3. */
export const Roles = (...perfis: Perfil[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, perfis);
