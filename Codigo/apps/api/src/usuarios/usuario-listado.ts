import { Perfil } from '../../generated/prisma';

/** Projeção de `usuario` para listagem — sem `authUserId`, que é detalhe de autenticação. */
export interface UsuarioListado {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
}
