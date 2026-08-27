import { Controller, Get } from '@nestjs/common';
import { Perfil as PerfilCompartilhado, UsuarioDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioListado } from './usuario-listado';
import { UsuariosService } from './usuarios.service';

/** Alvo de N1T3: MONTADOR aqui deve receber 403. */
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Roles(Perfil.RH, Perfil.GESTOR)
  @Get()
  async listar(): Promise<UsuarioDTO[]> {
    const usuarios = await this.usuarios.listar();
    return usuarios.map((usuario) => this.mapear(usuario));
  }

  private mapear(usuario: UsuarioListado): UsuarioDTO {
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil as unknown as PerfilCompartilhado,
      ativo: usuario.ativo,
    };
  }
}
