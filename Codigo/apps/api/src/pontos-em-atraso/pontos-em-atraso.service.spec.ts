import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { StatusSolicitacaoPonto } from '../../generated/prisma';
import { JornadasRepository } from '../jornadas/jornadas.repository';
import { PontosEmAtrasoRepository } from './pontos-em-atraso.repository';
import { PontosEmAtrasoService } from './pontos-em-atraso.service';
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
    service = new PontosEmAtrasoService(
      solicitacoes as unknown as PontosEmAtrasoRepository,
      jornadas as unknown as JornadasRepository,
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
    });

    it('recusa rejeitar o que já foi analisado', async () => {
      solicitacoes.buscarPorId.mockResolvedValue({
        ...pendente,
        status: StatusSolicitacaoPonto.APROVADA,
      });

      await expect(service.rejeitar(3, 2, 'Motivo qualquer')).rejects.toThrow(ConflictException);
    });
  });
});
