import { ConflictException } from '@nestjs/common';
import { Perfil } from '../../generated/prisma';
import { SupabaseAuthGateway } from '../supabase/supabase-auth.gateway';
import { CpfJaCadastradoException } from './exceptions/cpf-ja-cadastrado.exception';
import { CpfJaInformadoException } from './exceptions/cpf-ja-informado.exception';
import { CpfObrigatorioException } from './exceptions/cpf-obrigatorio.exception';
import { InativacaoDoProprioUsuarioException } from './exceptions/inativacao-do-proprio-usuario.exception';
import { UsuarioNaoEncontradoException } from './exceptions/usuario-nao-encontrado.exception';
import { UsuariosRepository } from './usuarios.repository';
import { UsuariosService } from './usuarios.service';

const dadosCadastro = {
  nome: 'Nova Montadora',
  email: 'nova@montacontrol.local',
  senha: 'senha-longa-123',
  perfil: Perfil.MONTADOR,
  cpf: '52998224725',
};

const authUserId = '22222222-2222-2222-2222-222222222222';

describe('UsuariosService', () => {
  let repository: {
    listar: jest.Mock;
    criar: jest.Mock;
    alterarAtivo: jest.Mock;
    definirCpf: jest.Mock;
    buscarPorId: jest.Mock;
  };
  let supabase: { criarUsuario: jest.Mock; excluirUsuario: jest.Mock };
  let service: UsuariosService;

  beforeEach(() => {
    repository = {
      listar: jest.fn(),
      criar: jest.fn(),
      alterarAtivo: jest.fn(),
      definirCpf: jest.fn(),
      buscarPorId: jest.fn(),
    };
    supabase = { criarUsuario: jest.fn(), excluirUsuario: jest.fn() };
    service = new UsuariosService(
      repository as unknown as UsuariosRepository,
      supabase as unknown as SupabaseAuthGateway,
    );
  });

  describe('listar', () => {
    it('delega ao repositório', async () => {
      const usuarios = [
        { id: 1, nome: 'Ana RH', email: 'ana@montacontrol.local', perfil: Perfil.RH, ativo: true },
      ];
      repository.listar.mockResolvedValue(usuarios);

      const resultado = await service.listar();

      expect(resultado).toEqual(usuarios);
      expect(repository.listar).toHaveBeenCalled();
    });
  });

  describe('cadastrar', () => {
    it('cria o usuário no Supabase e no Postgres, nessa ordem', async () => {
      supabase.criarUsuario.mockResolvedValue(authUserId);
      repository.criar.mockResolvedValue({
        id: 9,
        nome: dadosCadastro.nome,
        email: dadosCadastro.email,
        telefone: null,
        perfil: dadosCadastro.perfil,
        ativo: true,
      });

      const usuario = await service.cadastrar(dadosCadastro);

      expect(usuario).toEqual({
        id: 9,
        nome: dadosCadastro.nome,
        email: dadosCadastro.email,
        telefone: null,
        perfil: dadosCadastro.perfil,
        ativo: true,
      });
      expect(supabase.criarUsuario).toHaveBeenCalledWith(dadosCadastro.email, dadosCadastro.senha);
      expect(repository.criar).toHaveBeenCalledWith({
        nome: dadosCadastro.nome,
        email: dadosCadastro.email,
        telefone: null,
        perfil: dadosCadastro.perfil,
        cpf: '52998224725',
        authUserId,
      });
      expect(supabase.excluirUsuario).not.toHaveBeenCalled();
    });

    it('repassa o telefone informado para o repositório', async () => {
      supabase.criarUsuario.mockResolvedValue(authUserId);
      repository.criar.mockResolvedValue({
        id: 9,
        nome: dadosCadastro.nome,
        email: dadosCadastro.email,
        telefone: '(11) 91234-5678',
        perfil: dadosCadastro.perfil,
        ativo: true,
      });

      await service.cadastrar({ ...dadosCadastro, telefone: '(11) 91234-5678' });

      expect(repository.criar).toHaveBeenCalledWith(
        expect.objectContaining({ telefone: '(11) 91234-5678' }),
      );
    });

    it('rejeita com 409 quando o e-mail já existe no Supabase Auth', async () => {
      supabase.criarUsuario.mockResolvedValue(null);

      await expect(service.cadastrar(dadosCadastro)).rejects.toThrow(ConflictException);
      expect(repository.criar).not.toHaveBeenCalled();
    });

    it('desfaz a criação no Supabase quando o Postgres rejeita por conflito tardio', async () => {
      supabase.criarUsuario.mockResolvedValue(authUserId);
      repository.criar.mockResolvedValue(null);

      await expect(service.cadastrar(dadosCadastro)).rejects.toThrow(ConflictException);
      expect(supabase.excluirUsuario).toHaveBeenCalledWith(authUserId);
    });
  });

  describe('cadastrar com CPF', () => {
    const cpfValidoTeste = '52998224725';

    it('exige CPF para MONTADOR', async () => {
      await expect(service.cadastrar({ ...dadosCadastro, cpf: undefined, perfil: Perfil.MONTADOR })).rejects.toBeInstanceOf(
        CpfObrigatorioException,
      );
      expect(supabase.criarUsuario).not.toHaveBeenCalled();
    });

    it('não exige CPF para os demais perfis', async () => {
      supabase.criarUsuario.mockResolvedValue(authUserId);
      repository.criar.mockResolvedValue({ id: 3 });

      await service.cadastrar({ ...dadosCadastro, cpf: undefined, perfil: Perfil.RH });

      expect(repository.criar).toHaveBeenCalledWith(expect.objectContaining({ cpf: null }));
    });

    it('grava só os dígitos do CPF', async () => {
      supabase.criarUsuario.mockResolvedValue(authUserId);
      repository.criar.mockResolvedValue({ id: 9 });

      await service.cadastrar({ ...dadosCadastro, cpf: '529.982.247-25' });

      expect(repository.criar).toHaveBeenCalledWith(expect.objectContaining({ cpf: cpfValidoTeste }));
    });

    it('CPF duplicado → 409 genérico e desfaz o Supabase', async () => {
      supabase.criarUsuario.mockResolvedValue(authUserId);
      repository.criar.mockResolvedValue('CPF_DUPLICADO');

      await expect(service.cadastrar({ ...dadosCadastro, cpf: cpfValidoTeste })).rejects.toBeInstanceOf(
        CpfJaCadastradoException,
      );
      expect(supabase.excluirUsuario).toHaveBeenCalledWith(authUserId);
    });
  });

  describe('informarCpf', () => {
    it('grava os dígitos e devolve o usuário', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 4, cpf: null });
      repository.definirCpf.mockResolvedValue({ id: 4, cpf: '52998224725' });
      const usuario = await service.informarCpf(4, '529.982.247-25');
      expect(repository.definirCpf).toHaveBeenCalledWith(4, '52998224725');
      expect(usuario).toEqual({ id: 4, cpf: '52998224725' });
    });

    it('usuário inexistente → UsuarioNaoEncontradoException', async () => {
      repository.buscarPorId.mockResolvedValue(null);
      await expect(service.informarCpf(99, '52998224725')).rejects.toBeInstanceOf(UsuarioNaoEncontradoException);
      expect(repository.definirCpf).not.toHaveBeenCalled();
    });

    it('CPF já usado por outro → CpfJaCadastradoException', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 4, cpf: null });
      repository.definirCpf.mockResolvedValue('CPF_DUPLICADO');
      await expect(service.informarCpf(4, '52998224725')).rejects.toBeInstanceOf(CpfJaCadastradoException);
    });

    it('usuário já tem CPF → CpfJaInformadoException, sem sobrescrever (rota é "definir uma vez")', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 4, cpf: '52998224725' });
      await expect(service.informarCpf(4, '11122233396')).rejects.toBeInstanceOf(CpfJaInformadoException);
      expect(repository.definirCpf).not.toHaveBeenCalled();
    });
  });

  describe('alterarAtivo', () => {
    const montador = {
      id: 7,
      nome: 'Montador Um',
      email: 'montador.um@montacontrol.local',
      perfil: Perfil.MONTADOR,
      ativo: false,
    };

    it('inativa o usuário e devolve o registro atualizado', async () => {
      repository.alterarAtivo.mockResolvedValue(montador);

      const resultado = await service.alterarAtivo(7, false, 1);

      expect(resultado).toEqual(montador);
      expect(repository.alterarAtivo).toHaveBeenCalledWith(7, false);
    });

    it('reativa o usuário pelo mesmo caminho', async () => {
      repository.alterarAtivo.mockResolvedValue({ ...montador, ativo: true });

      const resultado = await service.alterarAtivo(7, true, 1);

      expect(resultado.ativo).toBe(true);
      expect(repository.alterarAtivo).toHaveBeenCalledWith(7, true);
    });

    it('recusa inativar o próprio solicitante', async () => {
      await expect(service.alterarAtivo(1, false, 1)).rejects.toThrow(
        InativacaoDoProprioUsuarioException,
      );
      expect(repository.alterarAtivo).not.toHaveBeenCalled();
    });

    it('deixa o solicitante reativar a si mesmo (não é tiro no pé)', async () => {
      repository.alterarAtivo.mockResolvedValue({ ...montador, id: 1, ativo: true });

      await expect(service.alterarAtivo(1, true, 1)).resolves.toBeDefined();
    });

    it('devolve 404 quando o usuário não existe', async () => {
      repository.alterarAtivo.mockResolvedValue(null);

      await expect(service.alterarAtivo(999, false, 1)).rejects.toThrow(
        UsuarioNaoEncontradoException,
      );
    });
  });
});
