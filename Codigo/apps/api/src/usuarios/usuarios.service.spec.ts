import { BadGatewayException, ConflictException } from '@nestjs/common';
import { Perfil } from '../../generated/prisma';
import { SupabaseAuthGateway } from '../supabase/supabase-auth.gateway';
import { CpfJaCadastradoException } from './exceptions/cpf-ja-cadastrado.exception';
import { CpfJaInformadoException } from './exceptions/cpf-ja-informado.exception';
import { CpfObrigatorioException } from './exceptions/cpf-obrigatorio.exception';
import { InativacaoDoProprioUsuarioException } from './exceptions/inativacao-do-proprio-usuario.exception';
import { UsuarioNaoEncontradoException } from './exceptions/usuario-nao-encontrado.exception';
import { FotosUsuarios } from './fotos-usuarios';
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
    atualizar: jest.Mock;
  };
  let supabase: { criarUsuario: jest.Mock; excluirUsuario: jest.Mock };
  let fotos: { enviar: jest.Mock; remover: jest.Mock; comUrls: jest.Mock };
  let service: UsuariosService;

  beforeEach(() => {
    repository = {
      listar: jest.fn(),
      criar: jest.fn(),
      alterarAtivo: jest.fn(),
      definirCpf: jest.fn(),
      buscarPorId: jest.fn(),
      atualizar: jest.fn(),
    };
    supabase = { criarUsuario: jest.fn(), excluirUsuario: jest.fn() };
    // Sem foto, `comUrls` é transparente: os testes antigos comparam o listado puro.
    fotos = {
      enviar: jest.fn().mockResolvedValue('foto.jpg'),
      remover: jest.fn(),
      comUrls: jest.fn((itens: unknown[]) => Promise.resolve(itens)),
    };
    service = new UsuariosService(
      repository as unknown as UsuariosRepository,
      supabase as unknown as SupabaseAuthGateway,
      fotos as unknown as FotosUsuarios,
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
    const foto = { conteudoBase64: 'aGVsbG8=', mimeType: 'image/jpeg' as const };

    it('com foto: envia antes de criar a conta e grava o caminho', async () => {
      supabase.criarUsuario.mockResolvedValue(authUserId);
      repository.criar.mockResolvedValue({ id: 9, fotoPath: 'foto.jpg' });

      await service.cadastrar({ ...dadosCadastro, foto });

      expect(fotos.enviar).toHaveBeenCalledWith(foto);
      expect(fotos.enviar.mock.invocationCallOrder[0]).toBeLessThan(
        supabase.criarUsuario.mock.invocationCallOrder[0],
      );
      expect(repository.criar).toHaveBeenCalledWith(expect.objectContaining({ fotoPath: 'foto.jpg' }));
      expect(fotos.comUrls).toHaveBeenCalledWith([{ id: 9, fotoPath: 'foto.jpg' }]);
    });

    it('com foto: falha no Storage recusa o cadastro sem criar conta', async () => {
      fotos.enviar.mockRejectedValue(new BadGatewayException());

      await expect(service.cadastrar({ ...dadosCadastro, foto })).rejects.toThrow(BadGatewayException);
      expect(supabase.criarUsuario).not.toHaveBeenCalled();
    });

    it('com foto: e-mail duplicado remove a foto já enviada', async () => {
      supabase.criarUsuario.mockResolvedValue(null);

      await expect(service.cadastrar({ ...dadosCadastro, foto })).rejects.toThrow(ConflictException);
      expect(fotos.remover).toHaveBeenCalledWith('foto.jpg');
    });

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
        fotoPath: null,
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

  describe('atualizar', () => {
    const operador = {
      id: 4,
      nome: 'Operador',
      email: 'op@montacontrol.local',
      perfil: Perfil.DEPOSITO,
      ativo: true,
    };

    it('apara o nome e troca telefone em branco por null', async () => {
      repository.atualizar.mockResolvedValue({ ...operador, nome: 'Novo Nome', telefone: null });

      await service.atualizar(4, { nome: '  Novo Nome ', telefone: '   ' });

      expect(repository.atualizar).toHaveBeenCalledWith(4, { nome: 'Novo Nome', telefone: null });
    });

    it('não envia campos ausentes nem nome em branco', async () => {
      repository.atualizar.mockResolvedValue(operador);

      await service.atualizar(4, { nome: '   ' });

      expect(repository.atualizar).toHaveBeenCalledWith(4, {});
    });

    it('devolve 404 quando o usuário não existe', async () => {
      repository.atualizar.mockResolvedValue(null);

      await expect(service.atualizar(999, { nome: 'X' })).rejects.toThrow(
        UsuarioNaoEncontradoException,
      );
    });
  });
});
