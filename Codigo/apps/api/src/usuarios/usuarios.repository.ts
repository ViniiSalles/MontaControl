import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsuarioAutenticado } from '../auth/usuario-autenticado';
import { UsuarioListado } from './usuario-listado';

const SELECAO_USUARIO_AUTENTICADO = {
  id: true,
  nome: true,
  email: true,
  perfil: true,
  ativo: true,
  authUserId: true,
} as const;

const SELECAO_USUARIO_LISTADO = {
  id: true,
  nome: true,
  email: true,
  perfil: true,
  ativo: true,
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

  async listar(): Promise<UsuarioListado[]> {
    return this.prisma.usuario.findMany({
      select: SELECAO_USUARIO_LISTADO,
      orderBy: { nome: 'asc' },
    });
  }
}
