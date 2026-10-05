import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import type { EquipeDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { Roles } from '../auth/decorators/roles.decorator';
import { SalvarEquipeDto } from './dto/salvar-equipe.dto';
import { EquipesService } from './equipes.service';

/** Equipes de montadores — cadastro exclusivo do gestor, que direciona as obras. */
@Controller('equipes')
export class EquipesController {
  constructor(private readonly equipes: EquipesService) {}

  @Roles(Perfil.GESTOR)
  @Get()
  async listar(): Promise<EquipeDTO[]> {
    return this.equipes.listar();
  }

  @Roles(Perfil.GESTOR)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async criar(@Body() dto: SalvarEquipeDto): Promise<EquipeDTO> {
    return this.equipes.criar(dto);
  }

  @Roles(Perfil.GESTOR)
  @Put(':id')
  async atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SalvarEquipeDto,
  ): Promise<EquipeDTO> {
    return this.equipes.atualizar(id, dto);
  }

  @Roles(Perfil.GESTOR)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.equipes.remover(id);
  }
}
