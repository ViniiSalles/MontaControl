import { Perfil } from '../../generated/prisma';

/** Projeção de `usuario` para listagem — sem `authUserId`, que é detalhe de autenticação. */
export interface UsuarioListado {
  id: number;
  nome: string;
  email: string;
  telefone: string | null;
  perfil: Perfil;
  ativo: boolean;
  cpf: string | null;
  /** Caminho no bucket privado — vira URL assinada antes de sair da API. */
  fotoPath: string | null;
  createdAt: Date;
}

/** Listado com a foto já trocada por URL assinada — o que sai pela API. */
export type UsuarioComFoto = UsuarioListado & { fotoUrl: string | null };
