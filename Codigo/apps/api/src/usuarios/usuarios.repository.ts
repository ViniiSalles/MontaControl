import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsuarioAutenticado } from '../auth/usuario-autenticado';

const SELECAO_USUARIO_AUTENTICADO = {
  id: true,
  nome: true,
  email: true,
  perfil: true,
  ativo: true,
  authUserId: true,
} as const;

@Injectable()
export class UsuariosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorAuthUserId(authUserId: string): Promise<UsuarioAutenticado | null> {
    return this.prisma.usuario.findUnique({
      where: { authUserId },
      select: SELECAO_USUARIO_AUTENTICADO,
    });
  }
}
