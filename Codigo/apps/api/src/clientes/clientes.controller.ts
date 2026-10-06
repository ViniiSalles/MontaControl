import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { ClienteDTO, ClienteResumoDTO, CoordenadasEncontradasDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClientesService } from './clientes.service';
import { GeocodificarEnderecoDto } from './dto/geocodificar-endereco.dto';
import { ListarClientesQueryDto } from './dto/listar-clientes.query.dto';
import { SalvarClienteDto } from './dto/salvar-cliente.dto';

/** Cliente = local da obra. Cadastro exclusivo do gestor. */
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  /** Alimenta o seletor de local/obra do cadastro de pedido e a tela de clientes. */
  @Roles(Perfil.GESTOR)
  @Get()
  async listar(@Query() query: ListarClientesQueryDto): Promise<ClienteResumoDTO[]> {
    return this.clientes.listar(query.busca);
  }

  @Roles(Perfil.GESTOR)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async criar(@Body() dto: SalvarClienteDto): Promise<ClienteDTO> {
    return this.clientes.criar(dto);
  }

  /** Sugere latitude/longitude a partir do endereço; o gestor confere antes de salvar. */
  @Roles(Perfil.GESTOR)
  @Post('geocodificar')
  @HttpCode(HttpStatus.OK)
  async geocodificar(@Body() dto: GeocodificarEnderecoDto): Promise<CoordenadasEncontradasDTO> {
    return this.clientes.geocodificar(dto);
  }

  @Roles(Perfil.GESTOR)
  @Get(':id')
  async detalhar(@Param('id', ParseIntPipe) id: number): Promise<ClienteDTO> {
    return this.clientes.detalhar(id);
  }

  @Roles(Perfil.GESTOR)
  @Put(':id')
  async atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SalvarClienteDto,
  ): Promise<ClienteDTO> {
    return this.clientes.atualizar(id, dto);
  }
}
