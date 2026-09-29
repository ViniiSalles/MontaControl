import { Injectable } from '@nestjs/common';
import type { ClienteResumoDTO } from '@montacontrol/shared';
import { PrismaService } from '../prisma/prisma.service';

const SELECAO_CLIENTE_RESUMO = {
  id: true,
  nome: true,
  endereco: true,
  cidade: true,
  estado: true,
} as const;

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
}
