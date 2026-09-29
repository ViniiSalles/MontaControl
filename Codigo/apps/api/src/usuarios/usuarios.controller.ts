import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { Perfil as PerfilCompartilhado, UsuarioDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioAutenticado } from '../auth/usuario-autenticado';
import { AlterarAtivoDto } from './dto/alterar-ativo.dto';
import { CadastrarUsuarioDto } from './dto/cadastrar-usuario.dto';
import { InformarCpfDto } from './dto/informar-cpf.dto';
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

  @Roles(Perfil.RH, Perfil.GESTOR)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async cadastrar(@Body() dto: CadastrarUsuarioDto): Promise<UsuarioDTO> {
    const usuario = await this.usuarios.cadastrar(dto);
    return this.mapear(usuario);
  }

  @Roles(Perfil.RH, Perfil.GESTOR)
  @Patch(':id/ativo')
  async alterarAtivo(
    @CurrentUser() solicitante: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AlterarAtivoDto,
  ): Promise<UsuarioDTO> {
    const usuario = await this.usuarios.alterarAtivo(id, dto.ativo, solicitante.id);
    return this.mapear(usuario);
  }

  @Roles(Perfil.RH, Perfil.GESTOR)
  @Patch(':id/cpf')
  async informarCpf(@Param('id', ParseIntPipe) id: number, @Body() dto: InformarCpfDto): Promise<UsuarioDTO> {
    return this.mapear(await this.usuarios.informarCpf(id, dto.cpf));
  }

  private mapear(usuario: UsuarioListado): UsuarioDTO {
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      telefone: usuario.telefone,
      perfil: usuario.perfil as unknown as PerfilCompartilhado,
      ativo: usuario.ativo,
      cpf: usuario.cpf,
      criadoEm: usuario.createdAt.toISOString(),
    };
  }
}
