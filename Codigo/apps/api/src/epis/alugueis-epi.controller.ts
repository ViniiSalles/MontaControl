import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { AluguelEpiDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioAutenticado } from '../auth/usuario-autenticado';
import { AlugueisEpiService } from './alugueis-epi.service';
import { RegistrarAluguelEpiDto } from './dto/registrar-aluguel-epi.dto';
import { RegistrarDevolucaoEpiDto } from './dto/registrar-devolucao-epi.dto';

/** Aluguel de EPIs: o gestor registra a reserva, a devolução e cancela reservas futuras. */
@Controller('epis/alugueis')
export class AlugueisEpiController {
  constructor(private readonly alugueis: AlugueisEpiService) {}

  @Roles(Perfil.GESTOR)
  @Get()
  async listar(): Promise<AluguelEpiDTO[]> {
    return this.alugueis.listar();
  }

  @Roles(Perfil.GESTOR)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async registrar(
    @Body() dto: RegistrarAluguelEpiDto,
    @CurrentUser() gestor: UsuarioAutenticado,
  ): Promise<AluguelEpiDTO> {
    return this.alugueis.registrar(dto, gestor.id);
  }

  @Roles(Perfil.GESTOR)
  @Patch(':id/devolucao')
  async registrarDevolucao(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegistrarDevolucaoEpiDto,
    @CurrentUser() gestor: UsuarioAutenticado,
  ): Promise<AluguelEpiDTO> {
    return this.alugueis.registrarDevolucao(id, dto, gestor.id);
  }

  @Roles(Perfil.GESTOR)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelar(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.alugueis.cancelar(id);
  }
}
