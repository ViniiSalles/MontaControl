import { ConflictException, Logger, UnprocessableEntityException } from '@nestjs/common';
import { diaNoFuso } from '@montacontrol/shared';
import { Perfil, StatusSolicitacaoPonto } from '../../generated/prisma';
import { FUSO_OPERACAO } from '../common/fuso';
import { JornadasRepository } from '../jornadas/jornadas.repository';
import { PontosEmAtrasoRepository } from './pontos-em-atraso.repository';
import { PontosEmAtrasoService } from './pontos-em-atraso.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { SolicitacaoJaAnalisadaException } from './exceptions/solicitacao-ja-analisada.exception';
import { PeriodoJaRegistradoException } from './exceptions/periodo-ja-registrado.exception';

const pendente = {
  id: 3,
  usuarioId: 7,
  usuarioNome: 'Montador Um',
  data: '2026-09-02',
  inicio: '2026-09-02T11:00:00.000Z',
  fim: '2026-09-02T20:00:00.000Z',
  minutosSolicitados: 540,
  justificativa: 'Celular sem bateria.',
  status: StatusSolicitacaoPonto.PENDENTE,
  jornadaId: null,
  analisadoPor: null,
  analisadoEm: null,
  motivoRejeicao: null,
  criadoEm: '2026-09-02T21:00:00.000Z',
};

describe('PontosEmAtrasoService — análise', () => {
  let solicitacoes: {
    buscarPorId: jest.Mock;
    buscarPorIdCliente: jest.Mock;
    existePendenteNoDia: jest.Mock;
    criar: jest.Mock;
    listarPendentes: jest.Mock;
    aprovar: jest.Mock;
    rejeitar: jest.Mock;
  };
  let jornadas: { existeSobreposicao: jest.Mock };
  let notificacoes: { notificar: jest.Mock };
  let service: PontosEmAtrasoService;

  beforeEach(() => {
    solicitacoes = {
      buscarPorId: jest.fn().mockResolvedValue(pendente),
      buscarPorIdCliente: jest.fn(),
      existePendenteNoDia: jest.fn(),
      criar: jest.fn(),
      listarPendentes: jest.fn(),
      aprovar: jest.fn(),
      rejeitar: jest.fn(),
    };
    jornadas = { existeSobreposicao: jest.fn().mockResolvedValue(false) };
    // As falhas simuladas de notificar são logadas pelo service; sem ruído no output.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    notificacoes = { notificar: jest.fn().mockResolvedValue(undefined) };
    service = new PontosEmAtrasoService(
      solicitacoes as unknown as PontosEmAtrasoRepository,
      jornadas as unknown as JornadasRepository,
      notificacoes as unknown as NotificacoesService,
    );
  });

  describe('aprovar', () => {
    it('cria a jornada e marca APROVADA', async () => {
      solicitacoes.aprovar.mockResolvedValue({
        ...pendente,
        status: StatusSolicitacaoPonto.APROVADA,
        jornadaId: 42,
        analisadoPor: 2,
      });

      const resultado = await service.aprovar(3, 2);

      expect(resultado.jornadaId).toBe(42);
      expect(solicitacoes.aprovar).toHaveBeenCalledWith(3, 2);
    });

    it('revalida a sobreposição no momento da aprovação', async () => {
      jornadas.existeSobreposicao.mockResolvedValue(true);

      await expect(service.aprovar(3, 2)).rejects.toThrow(PeriodoJaRegistradoException);
      expect(solicitacoes.aprovar).not.toHaveBeenCalled();
      expect(notificacoes.notificar).not.toHaveBeenCalled();
    });

    it('aprovar/rejeitar notifica o montador', async () => {
      solicitacoes.aprovar.mockResolvedValue({
        ...pendente,
        status: StatusSolicitacaoPonto.APROVADA,
        jornadaId: 42,
      });

      await service.aprovar(3, 2);

      expect(notificacoes.notificar).toHaveBeenLastCalledWith({
        usuarioIds: [7],
        tipo: 'PONTO_ATRASO_APROVADO',
        titulo: 'Ponto em atraso aprovado',
        mensagem: expect.stringContaining('02/09/2026'),
        referencia: { tipo: 'PONTO_ATRASO', id: 3 },
        chaveOrigem: 'ponto-atraso:3:aprovado',
      });

      solicitacoes.rejeitar.mockResolvedValue({
        ...pendente,
        status: StatusSolicitacaoPonto.REJEITADA,
        motivoRejeicao: 'Fora do turno contratado',
      });

      await service.rejeitar(3, 2, '  Fora do turno contratado  ');

      expect(notificacoes.notificar).toHaveBeenCalledTimes(2);
      expect(notificacoes.notificar).toHaveBeenLastCalledWith({
        usuarioIds: [7],
        tipo: 'PONTO_ATRASO_REJEITADO',
        titulo: 'Ponto em atraso rejeitado',
        mensagem: expect.stringContaining('Fora do turno contratado'),
        referencia: { tipo: 'PONTO_ATRASO', id: 3 },
        chaveOrigem: 'ponto-atraso:3:rejeitado',
      });
    });

    it('aprovar: falha de notificar não faz a operação lançar', async () => {
      const aprovada = { ...pendente, status: StatusSolicitacaoPonto.APROVADA, jornadaId: 42 };
      solicitacoes.aprovar.mockResolvedValue(aprovada);
      notificacoes.notificar.mockRejectedValue(new Error('socket fora'));

      await expect(service.aprovar(3, 2)).resolves.toEqual(aprovada);
    });

    it('recusa aprovar o que já foi analisado', async () => {
      solicitacoes.buscarPorId.mockResolvedValue({
        ...pendente,
        status: StatusSolicitacaoPonto.REJEITADA,
      });

      await expect(service.aprovar(3, 2)).rejects.toThrow(SolicitacaoJaAnalisadaException);
      expect(solicitacoes.aprovar).not.toHaveBeenCalled();
    });
  });

  describe('rejeitar', () => {
    it('grava o motivo aparado', async () => {
      solicitacoes.rejeitar.mockResolvedValue({
        ...pendente,
        status: StatusSolicitacaoPonto.REJEITADA,
        motivoRejeicao: 'Fora do turno contratado',
      });

      await service.rejeitar(3, 2, '  Fora do turno contratado  ');

      expect(solicitacoes.rejeitar).toHaveBeenCalledWith(3, 2, 'Fora do turno contratado');
    });

    it('recusa motivo em branco', async () => {
      await expect(service.rejeitar(3, 2, '   ')).rejects.toThrow(UnprocessableEntityException);
      expect(solicitacoes.rejeitar).not.toHaveBeenCalled();
      expect(notificacoes.notificar).not.toHaveBeenCalled();
    });

    it('recusa rejeitar o que já foi analisado', async () => {
      solicitacoes.buscarPorId.mockResolvedValue({
        ...pendente,
        status: StatusSolicitacaoPonto.APROVADA,
      });

      await expect(service.rejeitar(3, 2, 'Motivo qualquer')).rejects.toThrow(ConflictException);
    });
  });

  describe('solicitar', () => {
    function corpoSolicitacao() {
      const hoje = diaNoFuso(new Date().toISOString(), FUSO_OPERACAO);
      return {
        idCliente: '22222222-2222-2222-2222-222222222222',
        data: hoje,
        horaInicio: '08:00',
        horaFim: '17:00',
        justificativa: '  Celular sem bateria.  ',
      };
    }

    beforeEach(() => {
      solicitacoes.buscarPorIdCliente.mockResolvedValue(null);
      solicitacoes.existePendenteNoDia.mockResolvedValue(false);
      solicitacoes.criar.mockResolvedValue(pendente);
    });

    it('solicitar ponto notifica GESTORes e RHs', async () => {
      await service.solicitar(7, corpoSolicitacao());

      expect(notificacoes.notificar).toHaveBeenCalledTimes(1);
      expect(notificacoes.notificar).toHaveBeenCalledWith({
        perfis: [Perfil.GESTOR, Perfil.RH],
        tipo: 'PONTO_ATRASO_SOLICITADO',
        titulo: 'Ponto em atraso solicitado',
        mensagem: expect.stringContaining('Montador Um'),
        referencia: { tipo: 'PONTO_ATRASO', id: 3 },
        chaveOrigem: 'ponto-atraso:3:solicitado',
      });
    });

    it('solicitar idempotente (jaCriada) não notifica', async () => {
      solicitacoes.buscarPorIdCliente.mockResolvedValue(pendente);

      await service.solicitar(7, corpoSolicitacao());

      expect(solicitacoes.criar).not.toHaveBeenCalled();
      expect(notificacoes.notificar).not.toHaveBeenCalled();
    });

    it('falha de notificar não faz a operação lançar', async () => {
      notificacoes.notificar.mockRejectedValue(new Error('socket fora'));

      await expect(service.solicitar(7, corpoSolicitacao())).resolves.toEqual(pendente);
    });
  });
});
