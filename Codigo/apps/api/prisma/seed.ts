import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Perfil, StatusPeca, StatusPedido } from '../generated/prisma';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env' });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const SENHA_SEED = 'MontaControl@Seed1';

const USUARIOS_SEED: Array<{ nome: string; email: string; perfil: Perfil; cpf: string }> = [
  { nome: 'Gestor Seed', email: 'gestor@montacontrol.local', perfil: Perfil.GESTOR, cpf: '52998224725' },
  { nome: 'RH Seed', email: 'rh@montacontrol.local', perfil: Perfil.RH, cpf: '11144477735' },
  { nome: 'Montador Seed', email: 'montador@montacontrol.local', perfil: Perfil.MONTADOR, cpf: '39053344705' },
  { nome: 'Deposito Seed', email: 'deposito@montacontrol.local', perfil: Perfil.DEPOSITO, cpf: '71428793860' },
];

/**
 * Cria o usuário no Auth (Admin API) e a linha em `usuario`, em duas etapas.
 * Se a segunda falhar, desfaz a primeira — senão sobra órfão em `auth.users`.
 * Idempotente: se já existir por e-mail, só garante a linha em `usuario`.
 */
async function seedUsuario(dados: { nome: string; email: string; perfil: Perfil; cpf: string }): Promise<void> {
  const existente = await prisma.usuario.findUnique({ where: { email: dados.email } });
  if (existente) {
    if (!existente.cpf) await prisma.usuario.update({ where: { email: dados.email }, data: { cpf: dados.cpf } });
    return;
  }

  const { data: usuariosExistentes } = await supabaseAdmin.auth.admin.listUsers();
  let authUserId = usuariosExistentes?.users.find((u) => u.email === dados.email)?.id;

  if (!authUserId) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: dados.email,
      password: SENHA_SEED,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(`Falha ao criar usuário no Auth (${dados.email}): ${error?.message}`);
    }
    authUserId = data.user.id;
  }

  try {
    await prisma.usuario.create({
      data: {
        nome: dados.nome,
        email: dados.email,
        authUserId,
        cpf: dados.cpf,
        perfil: dados.perfil,
        ativo: true,
      },
    });
  } catch (erro) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId);
    throw erro;
  }
}

async function seedTiposAvaria(): Promise<void> {
  if ((await prisma.tipoAvaria.count()) > 0) return;
  await prisma.tipoAvaria.createMany({
    data: [
      { nome: 'Amassado', descricao: 'Deformação superficial por impacto' },
      { nome: 'Risco', descricao: 'Marca superficial em acabamento' },
      { nome: 'Quebrado', descricao: 'Peça fraturada ou partida' },
      { nome: 'Manchado', descricao: 'Mancha ou descoloração no acabamento' },
    ],
  });
}

async function seedTiposFerramenta(): Promise<void> {
  if ((await prisma.tipoFerramenta.count()) > 0) return;
  await prisma.tipoFerramenta.createMany({
    data: [
      { nome: 'Furadeira', descricao: 'Furadeira/parafusadeira sem fio' },
      { nome: 'Nível a Laser', descricao: 'Nível a laser para alinhamento' },
      { nome: 'Trena Digital', descricao: 'Trena a laser para medição' },
    ],
  });
}

async function seedTiposEpi(): Promise<void> {
  if ((await prisma.tipoEpi.count()) > 0) return;
  await prisma.tipoEpi.createMany({
    data: [
      { nome: 'Luva de Proteção', descricao: 'Luva para manuseio de peças', validadeMeses: 6 },
      { nome: 'Óculos de Proteção', descricao: 'Óculos contra impacto', validadeMeses: 12 },
      { nome: 'Calçado de Segurança', descricao: 'Calçado com biqueira reforçada', validadeMeses: 12 },
    ],
  });
}

async function seedNorma(): Promise<void> {
  if ((await prisma.norma.count()) > 0) return;
  await prisma.norma.create({
    data: {
      titulo: 'Norma de Segurança na Montagem',
      conteudo: 'Uso obrigatório de EPI durante toda a montagem em ambiente do cliente.',
      ativo: true,
    },
  });
}

async function seedPedidoDemo(): Promise<void> {
  const cliente = await prisma.cliente.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nome: 'Cliente Demonstração',
      endereco: 'Rua das Demonstrações, 100',
      cidade: 'Belo Horizonte',
      estado: 'MG',
      cep: '30000-000',
      latitude: '-19.9227318',
      longitude: '-43.9450823',
      telefone: '31999990000',
    },
  });

  const pedido = await prisma.pedido.upsert({
    where: { numeroPedido: 'PED-SEED-0001' },
    update: {},
    create: {
      clienteId: cliente.id,
      numeroPedido: 'PED-SEED-0001',
      status: StatusPedido.AGUARDANDO,
    },
  });

  let ambiente = await prisma.ambiente.findFirst({
    where: { pedidoId: pedido.id, nome: 'Sala' },
  });
  if (!ambiente) {
    ambiente = await prisma.ambiente.create({
      data: { pedidoId: pedido.id, nome: 'Sala' },
    });
  }

  const pecasExistentes = await prisma.peca.count({ where: { ambienteId: ambiente.id } });
  if (pecasExistentes === 0) {
    // `itemId` é o id da própria peça quando o item tem uma unidade só — precisa
    // de dois passos porque o id só existe depois do insert.
    for (const dados of [
      { codigoBarras: 'PEC-SEED-0001', descricao: 'Painel lateral' },
      { codigoBarras: 'PEC-SEED-0002', descricao: 'Prateleira' },
    ]) {
      const peca = await prisma.peca.create({
        data: { ambienteId: ambiente.id, itemId: 0, status: StatusPeca.TRIADA, ...dados },
      });
      await prisma.peca.update({ where: { id: peca.id }, data: { itemId: peca.id } });
    }
  }
}

async function main(): Promise<void> {
  for (const usuario of USUARIOS_SEED) {
    await seedUsuario(usuario);
  }
  await seedTiposAvaria();
  await seedTiposFerramenta();
  await seedTiposEpi();
  await seedNorma();
  await seedPedidoDemo();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (erro) => {
    console.error(erro);
    await prisma.$disconnect();
    process.exit(1);
  });
