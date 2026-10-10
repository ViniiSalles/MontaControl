import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';

/** Cliente + pedido atribuído aos montadores — o mínimo para bater ponto. */
export interface ObraFixture {
  clienteId: number;
  pedidoId: number;
  latitude: number;
  longitude: number;
}

const LOCAL_PADRAO = { latitude: -19.9325, longitude: -43.9382 };

export async function criarObraFixture(app: INestApplication, montadorIds: number[]): Promise<ObraFixture> {
  const prisma = app.get(PrismaService);
  const cliente = await prisma.cliente.create({
    data: {
      nome: 'Cliente Fixture e2e',
      endereco: 'Rua Fixture, 123',
      cidade: 'Belo Horizonte',
      estado: 'MG',
      cep: '30000-000',
      ...LOCAL_PADRAO,
      telefone: '31999999999',
    },
  });
  const pedido = await prisma.pedido.create({
    data: {
      clienteId: cliente.id,
      numeroPedido: `PED-E2E-${randomUUID()}`,
      montadores: { create: montadorIds.map((usuarioId) => ({ usuarioId })) },
    },
  });
  return { clienteId: cliente.id, pedidoId: pedido.id, ...LOCAL_PADRAO };
}

/** Chamar depois de apagar os montadores — as jornadas deles apontam para o pedido. */
export async function apagarObraFixture(app: INestApplication, obra: ObraFixture): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.jornada.updateMany({ where: { pedidoId: obra.pedidoId }, data: { pedidoId: null } });
  await prisma.pedidoMontador.deleteMany({ where: { pedidoId: obra.pedidoId } });
  await prisma.pedido.delete({ where: { id: obra.pedidoId } });
  await prisma.cliente.delete({ where: { id: obra.clienteId } });
}
