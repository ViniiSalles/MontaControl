import type { AvariaDTO } from '@montacontrol/shared';
import type { Perfil, StatusAvaria } from '../../generated/prisma';

export const SELECAO_AVARIA = {
  id: true,
  pecaId: true,
  tipoAvariaId: true,
  descricao: true,
  status: true,
  registradaPor: true,
  analisadaPor: true,
  analisadaAt: true,
  parecer: true,
  createdAt: true,
  peca: {
    select: {
      descricao: true,
      codigoBarras: true,
      ambiente: {
        select: { nome: true, pedido: { select: { id: true, numeroPedido: true } } },
      },
    },
  },
  tipoAvaria: { select: { nome: true } },
  registrador: { select: { nome: true, perfil: true } },
  _count: { select: { fotos: true } },
} as const;

export const SELECAO_AVARIA_DETALHADA = {
  ...SELECAO_AVARIA,
  analista: { select: { nome: true } },
  fotos: { select: { id: true, storagePath: true }, orderBy: { id: 'asc' } },
} as const;

interface LinhaAvaria {
  id: number;
  pecaId: number;
  tipoAvariaId: number;
  descricao: string;
  status: StatusAvaria;
  registradaPor: number;
  analisadaPor: number | null;
  analisadaAt: Date | null;
  parecer: string | null;
  createdAt: Date;
  peca: {
    descricao: string;
    codigoBarras: string | null;
    ambiente: { nome: string; pedido: { id: number; numeroPedido: string } };
  };
  tipoAvaria: { nome: string };
  registrador: { nome: string; perfil: Perfil };
  _count: { fotos: number };
}

export function paraAvariaDTO(linha: LinhaAvaria): AvariaDTO {
  return {
    id: linha.id,
    pecaId: linha.pecaId,
    descricaoPeca: linha.peca.descricao,
    codigoBarras: linha.peca.codigoBarras,
    pedidoId: linha.peca.ambiente.pedido.id,
    numeroPedido: linha.peca.ambiente.pedido.numeroPedido,
    ambiente: linha.peca.ambiente.nome,
    tipoAvariaId: linha.tipoAvariaId,
    tipoAvaria: linha.tipoAvaria.nome,
    descricao: linha.descricao,
    status: linha.status as unknown as AvariaDTO['status'],
    registradaPor: linha.registradaPor,
    registradaPorNome: linha.registrador.nome,
    registradaPorPerfil: linha.registrador.perfil as unknown as AvariaDTO['registradaPorPerfil'],
    analisadaPor: linha.analisadaPor,
    analisadaEm: linha.analisadaAt?.toISOString() ?? null,
    parecer: linha.parecer,
    quantidadeFotos: linha._count.fotos,
    criadoEm: linha.createdAt.toISOString(),
  };
}
