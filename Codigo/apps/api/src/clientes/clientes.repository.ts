import { Injectable } from '@nestjs/common';
import type { ClienteDTO, ClienteResumoDTO, SalvarClienteRequest } from '@montacontrol/shared';
import { PrismaService } from '../prisma/prisma.service';

const CODIGO_PRISMA_NAO_ENCONTRADO = 'P2025';

const SELECAO_CLIENTE_RESUMO = {
  id: true,
  nome: true,
  endereco: true,
  cidade: true,
  estado: true,
} as const;

const SELECAO_CLIENTE = {
  ...SELECAO_CLIENTE_RESUMO,
  cep: true,
  telefone: true,
  latitude: true,
  longitude: true,
} as const;

interface LinhaCliente {
  id: number;
  nome: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  telefone: string;
  latitude: { toNumber(): number };
  longitude: { toNumber(): number };
}

/** Coluna `Decimal(10,7)` volta como `Decimal`; o contrato quer `number`. */
function paraClienteDTO(linha: LinhaCliente): ClienteDTO {
  return {
    ...linha,
    latitude: linha.latitude.toNumber(),
    longitude: linha.longitude.toNumber(),
  };
}

@Injectable()
export class ClientesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(busca?: string): Promise<ClienteResumoDTO[]> {
    return this.prisma.cliente.findMany({
      where: busca ? { nome: { contains: busca, mode: 'insensitive' } } : undefined,
      select: SELECAO_CLIENTE_RESUMO,
      orderBy: { nome: 'asc' },
    });
  }

  async existe(id: number): Promise<boolean> {
    const cliente = await this.prisma.cliente.findUnique({ where: { id }, select: { id: true } });
    return cliente !== null;
  }

  async buscarPorId(id: number): Promise<ClienteDTO | null> {
    const linha = await this.prisma.cliente.findUnique({ where: { id }, select: SELECAO_CLIENTE });
    return linha ? paraClienteDTO(linha) : null;
  }

  async criar(dados: SalvarClienteRequest): Promise<ClienteDTO> {
    const linha = await this.prisma.cliente.create({ data: dados, select: SELECAO_CLIENTE });
    return paraClienteDTO(linha);
  }

  /** `null` quando o cliente não existe. */
  async atualizar(id: number, dados: SalvarClienteRequest): Promise<ClienteDTO | null> {
    try {
      const linha = await this.prisma.cliente.update({
        where: { id },
        data: dados,
        select: SELECAO_CLIENTE,
      });
      return paraClienteDTO(linha);
    } catch (erro) {
      if (
        typeof erro === 'object' &&
        erro !== null &&
        'code' in erro &&
        (erro as { code?: unknown }).code === CODIGO_PRISMA_NAO_ENCONTRADO
      ) {
        return null;
      }
      throw erro;
    }
  }
}
