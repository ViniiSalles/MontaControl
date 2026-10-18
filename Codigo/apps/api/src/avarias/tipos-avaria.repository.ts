import { Injectable } from '@nestjs/common';
import type { TipoAvariaDTO } from '@montacontrol/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Tipo de avaria (catálogo global) como o pull de sincronização o consome. */
export interface TipoAvariaParaSync {
  id: number;
  nome: string;
  descricao: string;
}

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

  /** Catálogo inteiro no primeiro pull; depois só o que mudou depois de `alteradosDesde`. */
  async listarParaSync(alteradosDesde?: Date): Promise<TipoAvariaParaSync[]> {
    return this.prisma.tipoAvaria.findMany({
      where: { updatedAt: alteradosDesde ? { gt: alteradosDesde } : undefined },
      orderBy: { id: 'asc' },
      select: { id: true, nome: true, descricao: true },
    });
  }
}
