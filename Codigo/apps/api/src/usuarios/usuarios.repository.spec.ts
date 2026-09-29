import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { Perfil } from '../../generated/prisma';
import { UsuariosRepository, violacaoDeCpf } from './usuarios.repository';

function erroConflito(meta?: Record<string, unknown>): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '0.0.0',
    meta,
  });
}

/** Formato real com `@prisma/adapter-pg`: `meta.driverAdapterError.cause.constraint`. */
function erroConflitoAdapter(constraint: { index?: string; fields?: string[] }) {
  return erroConflito({
    driverAdapterError: { cause: { kind: 'UniqueConstraintViolation', constraint } },
    table: 'usuario',
  });
}

function erroNaoEncontrado(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: '0.0.0',
  });
}

const SELECAO_LISTADO = {
  id: true,
  nome: true,
  email: true,
  telefone: true,
  perfil: true,
  ativo: true,
  cpf: true,
  createdAt: true,
};

describe('UsuariosRepository', () => {
  let prisma: { usuario: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock } };
  let repository: UsuariosRepository;

  beforeEach(() => {
    prisma = {
      usuario: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    repository = new UsuariosRepository(prisma as unknown as PrismaService);
  });

  describe('buscarPorAuthUserId', () => {
    it('retorna o usuário mapeado quando encontrado', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        id: 7,
        nome: 'Maria Montadora',
        email: 'maria@montacontrol.local',
        perfil: Perfil.MONTADOR,
        ativo: true,
        authUserId: '11111111-1111-1111-1111-111111111111',
      });

      const usuario = await repository.buscarPorAuthUserId('11111111-1111-1111-1111-111111111111');

      expect(usuario).toEqual({
        id: 7,
        nome: 'Maria Montadora',
        email: 'maria@montacontrol.local',
        perfil: Perfil.MONTADOR,
        ativo: true,
        authUserId: '11111111-1111-1111-1111-111111111111',
      });
      expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
        where: { authUserId: '11111111-1111-1111-1111-111111111111' },
        select: { id: true, nome: true, email: true, perfil: true, ativo: true, authUserId: true },
      });
    });

    it('retorna null quando não há usuário com o authUserId informado', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      const usuario = await repository.buscarPorAuthUserId('inexistente');

      expect(usuario).toBeNull();
    });
  });

  describe('buscarPorId', () => {
    it('retorna o usuário mapeado quando encontrado', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        id: 7,
        nome: 'Maria Montadora',
        email: 'maria@montacontrol.local',
        telefone: '(11) 91234-5678',
        perfil: Perfil.MONTADOR,
        ativo: true,
        cpf: null,
        createdAt: new Date('2026-09-01T00:00:00Z'),
      });

      const usuario = await repository.buscarPorId(7);

      expect(usuario).toEqual({
        id: 7,
        nome: 'Maria Montadora',
        email: 'maria@montacontrol.local',
        telefone: '(11) 91234-5678',
        perfil: Perfil.MONTADOR,
        ativo: true,
        cpf: null,
        createdAt: new Date('2026-09-01T00:00:00Z'),
      });
      expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
        where: { id: 7 },
        select: SELECAO_LISTADO,
      });
    });

    it('retorna null quando não há usuário com o id informado', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      const usuario = await repository.buscarPorId(999);

      expect(usuario).toBeNull();
    });
  });

  describe('listar', () => {
    it('retorna os usuários ordenados por nome, sem o authUserId', async () => {
      const usuarios = [
        {
          id: 1,
          nome: 'Ana RH',
          email: 'ana@montacontrol.local',
          telefone: null,
          perfil: Perfil.RH,
          ativo: true,
          cpf: null,
          createdAt: new Date('2026-09-01T00:00:00Z'),
        },
      ];
      prisma.usuario.findMany.mockResolvedValue(usuarios);

      const resultado = await repository.listar();

      expect(resultado).toEqual(usuarios);
      expect(prisma.usuario.findMany).toHaveBeenCalledWith({
        select: SELECAO_LISTADO,
        orderBy: { nome: 'asc' },
      });
    });
  });

  describe('criar', () => {
    const dados = {
      nome: 'Nova Montadora',
      email: 'nova@montacontrol.local',
      telefone: '(11) 91234-5678',
      cpf: '52998224725',
      perfil: Perfil.MONTADOR,
      authUserId: '22222222-2222-2222-2222-222222222222',
    };

    it('cria o usuário e retorna a projeção sem authUserId', async () => {
      prisma.usuario.create.mockResolvedValue({
        id: 9,
        nome: dados.nome,
        email: dados.email,
        telefone: dados.telefone,
        perfil: dados.perfil,
        ativo: true,
        cpf: dados.cpf,
        createdAt: new Date('2026-09-01T00:00:00Z'),
      });

      const usuario = await repository.criar(dados);

      expect(usuario).toEqual({
        id: 9,
        nome: dados.nome,
        email: dados.email,
        telefone: dados.telefone,
        perfil: dados.perfil,
        ativo: true,
        cpf: dados.cpf,
        createdAt: new Date('2026-09-01T00:00:00Z'),
      });
      expect(prisma.usuario.create).toHaveBeenCalledWith({
        data: dados,
        select: SELECAO_LISTADO,
      });
    });

    it('retorna null quando o e-mail ou authUserId já existem (P2002)', async () => {
      prisma.usuario.create.mockRejectedValue(erroConflito());

      const usuario = await repository.criar(dados);

      expect(usuario).toBeNull();
    });

    it("retorna 'CPF_DUPLICADO' quando a violação é do índice de cpf", async () => {
      prisma.usuario.create.mockRejectedValue(erroConflito({ target: ['cpf'] }));

      await expect(repository.criar(dados)).resolves.toBe('CPF_DUPLICADO');
    });

    it.each([
      ['meta.target', () => erroConflito({ target: ['cpf'] })],
      ['driver adapter (index)', () => erroConflitoAdapter({ index: 'usuario_cpf_key' })],
      ['driver adapter (fields)', () => erroConflitoAdapter({ fields: ['cpf'] })],
    ])("CPF duplicado reconhecido via %s", async (_nome, fabricar) => {
      prisma.usuario.create.mockRejectedValue(fabricar());
      await expect(repository.criar(dados)).resolves.toBe('CPF_DUPLICADO');
    });

    it.each([
      ['meta.target', () => erroConflito({ target: ['email'] })],
      ['driver adapter (index e-mail)', () => erroConflitoAdapter({ index: 'usuario_email_key' })],
      ['driver adapter (index auth)', () => erroConflitoAdapter({ index: 'usuario_auth_user_id_key' })],
      ['driver adapter (fields)', () => erroConflitoAdapter({ fields: ['email'] })],
    ])('conflito que não é de CPF devolve null via %s', async (_nome, fabricar) => {
      prisma.usuario.create.mockRejectedValue(fabricar());
      await expect(repository.criar(dados)).resolves.toBeNull();
    });

    it('propaga outros erros do Postgres', async () => {
      prisma.usuario.create.mockRejectedValue(new Error('conexão perdida'));

      await expect(repository.criar(dados)).rejects.toThrow('conexão perdida');
    });
  });

  describe('definirCpf', () => {
    it('atualiza o CPF e devolve a projeção', async () => {
      const atualizado = { id: 4, cpf: '52998224725' };
      prisma.usuario.update.mockResolvedValue(atualizado);

      const resultado = await repository.definirCpf(4, '52998224725');

      expect(resultado).toEqual(atualizado);
      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: { cpf: '52998224725' },
        select: SELECAO_LISTADO,
      });
    });

    it('retorna null quando o usuário não existe (P2025)', async () => {
      prisma.usuario.update.mockRejectedValue(erroNaoEncontrado());

      await expect(repository.definirCpf(999, '52998224725')).resolves.toBeNull();
    });

    it("retorna 'CPF_DUPLICADO' em violação de unicidade (P2002)", async () => {
      prisma.usuario.update.mockRejectedValue(erroConflito({ target: ['cpf'] }));

      await expect(repository.definirCpf(4, '52998224725')).resolves.toBe('CPF_DUPLICADO');
    });

    it.each([
      ['index', { index: 'usuario_cpf_key' }],
      ['fields', { fields: ['cpf'] }],
    ])("CPF duplicado via driver adapter (%s)", async (_nome, constraint) => {
      prisma.usuario.update.mockRejectedValue(erroConflitoAdapter(constraint));
      await expect(repository.definirCpf(4, '52998224725')).resolves.toBe('CPF_DUPLICADO');
    });

    it('propaga outros erros', async () => {
      prisma.usuario.update.mockRejectedValue(new Error('conexão perdida'));

      await expect(repository.definirCpf(4, '52998224725')).rejects.toThrow('conexão perdida');
    });
  });
});

describe('violacaoDeCpf', () => {
  it('não casa por substring e cai no JSON como último recurso', () => {
    expect(violacaoDeCpf(erroConflito({ target: ['cpf_extra'] }))).toBe(false);
    expect(violacaoDeCpf(erroConflito({ algo: ['usuario_cpf_key'] }))).toBe(true);
    expect(violacaoDeCpf(erroConflito())).toBe(false);
  });
});
