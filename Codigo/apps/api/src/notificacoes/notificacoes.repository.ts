import { Injectable } from '@nestjs/common';
import type { NotificacaoDTO, ReferenciaNotificacao, TipoNotificacao } from '@montacontrol/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface NovaNotificacao {
  usuarioId: number;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  referenciaTipo?: ReferenciaNotificacao;
  referenciaId?: number;
  chaveOrigem: string;
}

interface LinhaNotificacao {
  id: number;
  tipo: string;
  titulo: string;
  mensagem: string;
  referenciaTipo: string | null;
  referenciaId: number | null;
  lida: boolean;
  createdAt: Date;
}

function paraDTO(linha: LinhaNotificacao): NotificacaoDTO {
  return {
    id: linha.id,
    tipo: linha.tipo as TipoNotificacao,
    titulo: linha.titulo,
    mensagem: linha.mensagem,
    referenciaTipo: linha.referenciaTipo as ReferenciaNotificacao | null,
    referenciaId: linha.referenciaId,
    lida: linha.lida,
    criadaEm: linha.createdAt.toISOString(),
  };
}

@Injectable()
export class NotificacoesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Grava uma linha por destinatário. Conflito em `[usuarioId, chaveOrigem]` é
   * ignorado pelo banco, então o retorno traz só as notificações realmente
   * criadas (as que devem ser empurradas em tempo real).
   */
  async criarVarias(dados: NovaNotificacao[]): Promise<NotificacaoDTO[]> {
    if (dados.length === 0) return [];
    const criadas = await this.prisma.notificacao.createManyAndReturn({
      data: dados,
      skipDuplicates: true,
    });
    return criadas.map(paraDTO);
  }

  /** Mais recentes primeiro; `antesDe` é o cursor (id) da página anterior. */
  async listarDoUsuario(
    usuarioId: number,
    limite: number,
    antesDe?: number,
  ): Promise<NotificacaoDTO[]> {
    const linhas = await this.prisma.notificacao.findMany({
      where: { usuarioId, ...(antesDe !== undefined ? { id: { lt: antesDe } } : {}) },
      orderBy: { id: 'desc' },
      take: limite,
    });
    return linhas.map(paraDTO);
  }

  contarNaoLidas(usuarioId: number): Promise<number> {
    return this.prisma.notificacao.count({ where: { usuarioId, lida: false } });
  }

  /** Filtra por id E dono: `false` quando a notificação não é do usuário (ou não existe). */
  async marcarLida(id: number, usuarioId: number): Promise<boolean> {
    const { count } = await this.prisma.notificacao.updateMany({
      where: { id, usuarioId },
      data: { lida: true, lidaAt: new Date() },
    });
    return count > 0;
  }

  async marcarTodasLidas(usuarioId: number): Promise<number> {
    const { count } = await this.prisma.notificacao.updateMany({
      where: { usuarioId, lida: false },
      data: { lida: true, lidaAt: new Date() },
    });
    return count;
  }
}
