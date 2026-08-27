import { Perfil } from '../../generated/prisma';

/** Usuário resolvido a partir do JWT verificado e recarregado do banco por `authUserId`. */
export interface UsuarioAutenticado {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  authUserId: string;
}
