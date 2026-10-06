import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AvariaDTO, AvariaDetalhadaDTO, TipoAvariaDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioAutenticado } from '../auth/usuario-autenticado';
import { AvariasService } from './avarias.service';
import { AtualizarStatusAvariaDto } from './dto/atualizar-status-avaria.dto';
import { ListarAvariasQueryDto } from './dto/listar-avarias.query.dto';
import { ReportarAvariaDto } from './dto/reportar-avaria.dto';

/**
 * Duas pontas: operador (DEPOSITO) e montador reportam problemas com a peça
 * e veem os seus; o gestor analisa os de todos. O `registradaPor` vem do
 * token, nunca do corpo. RH não acessa nenhuma rota daqui.
 */
@Controller('avarias')
export class AvariasController {
  constructor(private readonly avarias: AvariasService) {}

  @Roles(Perfil.DEPOSITO, Perfil.MONTADOR, Perfil.GESTOR)
  @Get('tipos')
  async tipos(): Promise<TipoAvariaDTO[]> {
    return this.avarias.listarTipos();
  }

  @Roles(Perfil.DEPOSITO, Perfil.MONTADOR)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async reportar(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Body() dto: ReportarAvariaDto,
  ): Promise<AvariaDTO> {
    return this.avarias.reportar(usuario, dto);
  }

  /** Antes de `:id`, senão "minhas" vira um id inválido. */
  @Roles(Perfil.DEPOSITO, Perfil.MONTADOR)
  @Get('minhas')
  async minhas(@CurrentUser() usuario: UsuarioAutenticado): Promise<AvariaDTO[]> {
    return this.avarias.listarDoUsuario(usuario.id);
  }

  @Roles(Perfil.GESTOR)
  @Get()
  async listar(@Query() query: ListarAvariasQueryDto): Promise<AvariaDTO[]> {
    return this.avarias.listar(query);
  }

  @Roles(Perfil.GESTOR)
  @Get(':id')
  async detalhar(@Param('id', ParseIntPipe) id: number): Promise<AvariaDetalhadaDTO> {
    return this.avarias.detalhar(id);
  }

  @Roles(Perfil.GESTOR)
  @Patch(':id/status')
  async atualizarStatus(
    @CurrentUser() analista: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarStatusAvariaDto,
  ): Promise<AvariaDTO> {
    return this.avarias.atualizarStatus(id, analista.id, dto.status, dto.parecer);
  }
}
