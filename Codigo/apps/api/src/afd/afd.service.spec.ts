import { ConfigService } from '@nestjs/config';
import { AfdService } from './afd.service';
import { MarcacoesRepository } from './marcacoes.repository';
import { MontadoresSemCpfException } from './exceptions/montadores-sem-cpf.exception';

const EMPRESA_ENV: Record<string, string> = {
  EMPRESA_CNPJ: '12345678000199',
  EMPRESA_RAZAO_SOCIAL: 'MontaControl Montagens Planejadas Ltda',
  REP_P_REGISTRO_INPI: '12345678901234567',
  DESENVOLVEDOR_CNPJ: '98765432000188',
};

function configFake(): ConfigService {
  return { getOrThrow: (chave: string) => EMPRESA_ENV[chave] } as unknown as ConfigService;
}

describe('AfdService', () => {
  let marcacoes: jest.Mocked<MarcacoesRepository>;
  let service: AfdService;

  beforeEach(() => {
    marcacoes = {
      selarPendentes: jest.fn(),
      listarNoPeriodo: jest.fn(),
    } as unknown as jest.Mocked<MarcacoesRepository>;
    service = new AfdService(marcacoes, configFake());
  });

  it('bloqueia a exportação (422) quando há montador sem CPF, sem consultar o período', async () => {
    marcacoes.selarPendentes.mockResolvedValue({ ok: false, montadoresSemCpf: ['Ana Souza'] });

    await expect(service.gerar(2026, 9)).rejects.toBeInstanceOf(MontadoresSemCpfException);
    expect(marcacoes.listarNoPeriodo).not.toHaveBeenCalled();
  });

  it('gera o arquivo com as marcações do período, em ISO-8859-1', async () => {
    marcacoes.selarPendentes.mockResolvedValue({ ok: true, montadoresSemCpf: [] });
    marcacoes.listarNoPeriodo.mockResolvedValue([
      {
        nsr: 1,
        cpf: '45212345601',
        marcadoEm: new Date('2026-09-01T11:00:00.000Z'),
        gravadoEm: new Date('2026-09-01T11:00:05.000Z'),
        coletor: '01',
        offline: false,
        hash: 'a'.repeat(64),
      },
    ]);

    const { conteudo, nomeArquivo } = await service.gerar(2026, 9);

    expect(nomeArquivo).toBe('AFD1234567890123456712345678000199REP_P.txt');
    const linhas = conteudo.toString('latin1').split('\r\n');
    expect(linhas[0]).toHaveLength(302);
    expect(linhas[1]).toHaveLength(137);
    expect(linhas[1].slice(73)).toBe('a'.repeat(64));
    expect(marcacoes.listarNoPeriodo).toHaveBeenCalledWith(
      '2026-09-01T03:00:00.000Z',
      '2026-10-01T02:59:59.999Z',
    );
  });

  it('mês vazio gera arquivo só com cabeçalho, trailer zerado e assinatura', async () => {
    marcacoes.selarPendentes.mockResolvedValue({ ok: true, montadoresSemCpf: [] });
    marcacoes.listarNoPeriodo.mockResolvedValue([]);

    const { conteudo } = await service.gerar(2026, 9);
    const linhas = conteudo.toString('latin1').split('\r\n');

    expect(linhas).toHaveLength(4);
    expect(linhas[1].slice(54, 63)).toBe('000000000');
  });
});
