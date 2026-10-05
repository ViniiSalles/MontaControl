import { Injectable } from '@nestjs/common';
import type { TipoAvariaDTO } from '@montacontrol/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TiposAvariaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(): Promise<TipoAvariaDTO[]> {
    return this.prisma.tipoAvaria.findMany({
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, descricao: true },
    });
  }

  async existe(id: number): Promise<boolean> {
    return (await this.prisma.tipoAvaria.count({ where: { id } })) > 0;
  }
}
