import { PrismaService } from '../prisma/prisma.service';
import { FUSO_OPERACAO } from '../common/fuso';
import { calcularHashTipo7 } from './afd-leiaute';
import { MarcacoesRepository, TAMANHO_LOTE_SELAGEM } from './marcacoes.repository';

interface RegistroFake {
  id: number;
  nsr: number;
  hash: string | null;
  usuario: { cpf: string | null; nome: string };
  marcadoEm: Date;
  gravadoEm: Date;
  coletor: string;
  offline: boolean;
}

function marcacaoPendente(parcial: Partial<RegistroFake> & { id: number; nsr: number }): RegistroFake {
  return {
    hash: null,
    marcadoEm: new Date('2026-09-01T11:00:00.000Z'),
    gravadoEm: new Date('2026-09-01T11:00:05.000Z'),
    coletor: '01',
    offline: false,
    usuario: { cpf: '45212345601', nome: 'Ana Souza' },
    ...parcial,
  };
}

function dadosHash(registro: RegistroFake) {
  return {
    nsr: registro.nsr,
    cpf: registro.usuario.cpf as string,
    marcadoEmIso: registro.marcadoEm.toISOString(),
    gravadoEmIso: registro.gravadoEm.toISOString(),
    coletor: registro.coletor,
    offline: registro.offline,
  };
}

/**
 * "Banco" fake em memória: cada `tx` devolvido opera sobre o MESMO array
 * `registros`, então uma escrita feita numa transação (lote) é enxergada
 * pela próxima — o mesmo que a leitura fresca que o código de produção faz
 * dentro de cada transação, depois do lock. Isso é o que permite um teste
 * pegar um hashAnterior carregado incorretamente em memória entre lotes.
 */
function criarTxFake(registros: RegistroFake[]) {
  return {
    $queryRaw: jest.fn().mockResolvedValue([]),
    marcacaoPonto: {
      findMany: jest.fn((args: { take?: number } = {}) => {
        let linhas = registros.filter((r) => r.hash === null).sort((a, b) => a.nsr - b.nsr);
        if (args.take) linhas = linhas.slice(0, args.take);
        return Promise.resolve(linhas.map((r) => ({ ...r, usuario: { ...r.usuario } })));
      }),
      findFirst: jest.fn(() => {
        const seladas = registros.filter((r) => r.hash !== null).sort((a, b) => b.nsr - a.nsr);
        return Promise.resolve(seladas[0] ? { hash: seladas[0].hash } : null);
      }),
      updateMany: jest.fn((args: { where: { id: number; hash: null | undefined }; data: { hash: string } }) => {
        const alvo = registros.find((r) => r.id === args.where.id && r.hash === null);
        if (!alvo) return Promise.resolve({ count: 0 });
        alvo.hash = args.data.hash;
        return Promise.resolve({ count: 1 });
      }),
    },
  };
}

function criarPrismaFake(registros: RegistroFake[]) {
  const transacao = jest.fn((fn: (tx: unknown) => unknown) => fn(criarTxFake(registros)));
  const prisma = { $transaction: transacao } as unknown as PrismaService;
  return { prisma, transacao };
}

describe('MarcacoesRepository.selarPendentes', () => {
  it('bloqueia (ok=false) quando alguma marcação pendente é de usuário sem CPF, sem gravar nada', async () => {
    const registros = [marcacaoPendente({ id: 1, nsr: 1, usuario: { cpf: null, nome: 'Beto Lima' } })];
    const { prisma } = criarPrismaFake(registros);
    const repository = new MarcacoesRepository(prisma);

    const resultado = await repository.selarPendentes();

    expect(resultado).toEqual({ ok: false, montadoresSemCpf: ['Beto Lima'] });
    expect(registros.every((r) => r.hash === null)).toBe(true);
  });

  it('não repete o mesmo nome duas vezes quando o usuário tem mais de uma marcação sem CPF', async () => {
    const registros = [
      marcacaoPendente({ id: 1, nsr: 1, usuario: { cpf: null, nome: 'Beto Lima' } }),
      marcacaoPendente({ id: 2, nsr: 2, usuario: { cpf: null, nome: 'Beto Lima' } }),
    ];
    const { prisma } = criarPrismaFake(registros);
    const repository = new MarcacoesRepository(prisma);

    const resultado = await repository.selarPendentes();

    expect(resultado.montadoresSemCpf).toEqual(['Beto Lima']);
  });

  it('sela em ordem de NSR, encadeando a partir do hash da última já selada (valores exatos, não só "diferentes entre si")', async () => {
    const primeira = marcacaoPendente({ id: 5, nsr: 3 });
    const segunda = marcacaoPendente({ id: 6, nsr: 4 });
    const registros = [
      marcacaoPendente({ id: 1, nsr: 2, hash: 'a'.repeat(64) }), // já selada
      primeira,
      segunda,
    ];
    const { prisma, transacao } = criarPrismaFake(registros);
    const repository = new MarcacoesRepository(prisma);

    const resultado = await repository.selarPendentes();

    expect(resultado.ok).toBe(true);
    const hashEsperado1 = calcularHashTipo7(dadosHash(primeira), 'a'.repeat(64), FUSO_OPERACAO);
    const hashEsperado2 = calcularHashTipo7(dadosHash(segunda), hashEsperado1, FUSO_OPERACAO);
    // Comparado ao código de produção por um caminho independente
    // (`calcularHashTipo7` chamado aqui no teste, com os dados esperados),
    // não pela mesma chamada que está sendo testada — isso é o que pega uma
    // cadeia quebrada (ex.: `hashAnterior` ignorado), que "hashes diferem
    // entre si" sozinho não pegaria, já que NSRs diferentes já bastam para
    // isso.
    expect(registros.find((r) => r.id === 5)?.hash).toBe(hashEsperado1);
    expect(registros.find((r) => r.id === 6)?.hash).toBe(hashEsperado2);
    expect(transacao).toHaveBeenCalled();
  });

  it('nenhuma pendente: sucesso sem tocar em nada', async () => {
    const registros: RegistroFake[] = [];
    const { prisma } = criarPrismaFake(registros);
    const repository = new MarcacoesRepository(prisma);

    const resultado = await repository.selarPendentes();

    expect(resultado).toEqual({ ok: true, montadoresSemCpf: [] });
    expect(registros).toHaveLength(0);
  });

  it('sela em múltiplos lotes (cada um sua própria transação), formando uma cadeia contígua e correta de ponta a ponta', async () => {
    const total = TAMANHO_LOTE_SELAGEM + 5; // força pelo menos 2 lotes de escrita + 1 de fechamento
    const registros: RegistroFake[] = Array.from({ length: total }, (_, indice) =>
      marcacaoPendente({ id: indice + 1, nsr: indice + 1 }),
    );
    const { prisma, transacao } = criarPrismaFake(registros);
    const repository = new MarcacoesRepository(prisma);

    const resultado = await repository.selarPendentes();

    expect(resultado).toEqual({ ok: true, montadoresSemCpf: [] });
    expect(registros.every((r) => r.hash !== null)).toBe(true);
    // 1 checagem prévia + lote cheio (200) + lote final (5) + lote vazio que fecha o laço.
    expect(transacao).toHaveBeenCalledTimes(4);

    // Cadeia recomputada de forma independente, nsr a nsr — inclusive na
    // fronteira entre o primeiro e o segundo lote (índice `TAMANHO_LOTE_SELAGEM - 1`
    // para `TAMANHO_LOTE_SELAGEM`), onde um `hashAnterior` carregado em
    // memória da aplicação (em vez de relido dentro da transação do lote
    // seguinte) quebraria a cadeia sem que nenhum outro teste percebesse.
    const emOrdem = [...registros].sort((a, b) => a.nsr - b.nsr);
    let hashAnterior: string | null = null;
    for (const registro of emOrdem) {
      const esperado = calcularHashTipo7(dadosHash(registro), hashAnterior, FUSO_OPERACAO);
      expect(registro.hash).toBe(esperado);
      hashAnterior = esperado;
    }
  });

  it('um pendente sem CPF surgido após a checagem inicial (concorrência) interrompe o lote em que aparece, sem desfazer lotes já selados', async () => {
    const registros: RegistroFake[] = [marcacaoPendente({ id: 1, nsr: 1 }), marcacaoPendente({ id: 2, nsr: 2 })];
    let chamadas = 0;
    const transacao = jest.fn((fn: (tx: unknown) => unknown) => {
      chamadas += 1;
      if (chamadas === 3) {
        // Entre o commit do 1º lote (chamada 2) e a leitura do 2º lote
        // (esta chamada), um check-in concorrente registrou uma marcação de
        // um montador ainda sem CPF — a checagem prévia (chamada 1) não
        // podia ter visto isso.
        registros.push(marcacaoPendente({ id: 99, nsr: 99, usuario: { cpf: null, nome: 'Novo Sem Cpf' } }));
      }
      return fn(criarTxFake(registros));
    });
    const prisma = { $transaction: transacao } as unknown as PrismaService;
    const repository = new MarcacoesRepository(prisma);

    const resultado = await repository.selarPendentes();

    expect(resultado).toEqual({ ok: false, montadoresSemCpf: ['Novo Sem Cpf'] });
    // O que já tinha sido selado no 1º lote continua selado — não foi desfeito.
    expect(registros.find((r) => r.id === 1)?.hash).not.toBeNull();
    expect(registros.find((r) => r.id === 2)?.hash).not.toBeNull();
    expect(registros.find((r) => r.id === 99)?.hash).toBeNull();
    expect(chamadas).toBe(3); // checagem prévia + lote 1 (seladas) + lote 2 (interrompido) — sem 4ª chamada
  });
});

describe('MarcacoesRepository.listarNoPeriodo', () => {
  it('devolve só as marcações já seladas no período, em ordem de NSR', async () => {
    const prisma = {
      marcacaoPonto: {
        findMany: jest.fn().mockResolvedValue([
          {
            nsr: 1,
            marcadoEm: new Date('2026-09-01T11:00:00.000Z'),
            gravadoEm: new Date('2026-09-01T11:00:05.000Z'),
            coletor: '01',
            offline: false,
            hash: 'a'.repeat(64),
            usuario: { cpf: '45212345601' },
          },
        ]),
      },
    } as unknown as PrismaService;
    const repository = new MarcacoesRepository(prisma);

    const linhas = await repository.listarNoPeriodo('2026-09-01T03:00:00.000Z', '2026-10-01T02:59:59.999Z');

    expect(linhas).toEqual([
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
  });

  it('lança se uma marcação já selada não tiver CPF — invariante violada', async () => {
    const prisma = {
      marcacaoPonto: {
        findMany: jest.fn().mockResolvedValue([
          {
            nsr: 1,
            marcadoEm: new Date(),
            gravadoEm: new Date(),
            coletor: '01',
            offline: false,
            hash: 'a'.repeat(64),
            usuario: { cpf: null },
          },
        ]),
      },
    } as unknown as PrismaService;
    const repository = new MarcacoesRepository(prisma);

    await expect(repository.listarNoPeriodo('2026-09-01', '2026-09-30')).rejects.toThrow(/invariante/i);
  });
});
