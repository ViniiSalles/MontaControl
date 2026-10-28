import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import type { TipoEpiDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { Roles } from '../auth/decorators/roles.decorator';
import { SalvarTipoEpiDto } from './dto/salvar-tipo-epi.dto';
import { TiposEpiService } from './tipos-epi.service';

/** Catálogo de EPIs do almoxarifado — cadastro exclusivo do gestor. */
@Controller('epis/tipos')
export class TiposEpiController {
  constructor(private readonly tipos: TiposEpiService) {}

  @Roles(Perfil.GESTOR)
  @Get()
  async listar(): Promise<TipoEpiDTO[]> {
    return this.tipos.listar();
  }

  @Roles(Perfil.GESTOR)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async criar(@Body() dto: SalvarTipoEpiDto): Promise<TipoEpiDTO> {
    return this.tipos.criar(dto);
  }

  @Roles(Perfil.GESTOR)
  @Put(':id')
  async atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: SalvarTipoEpiDto): Promise<TipoEpiDTO> {
    return this.tipos.atualizar(id, dto);
  }
}
