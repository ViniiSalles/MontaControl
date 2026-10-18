jest.mock('../../avarias/clienteAvarias', () => ({ enviarAvaria: jest.fn() }));
jest.mock('../../atestados/clienteAtestados', () => ({ enviarAtestado: jest.fn() }));
jest.mock('../../jornada/clienteJornadas', () => ({
  buscarJornadaAtual: jest.fn(),
  buscarHistorico: jest.fn(),
  enviarCheckin: jest.fn(),
  enviarCheckout: jest.fn(),
  enviarSolicitacaoPonto: jest.fn(),
}));
jest.mock('../../banco-horas/clienteBancoHoras', () => ({ buscarBancoHoras: jest.fn() }));

import { Q } from '@nozbe/watermelondb';
import { File, Paths } from 'expo-file-system';
import { definirTokens } from '../../auth/tokenSessao';
import { enviarAtestado } from '../../atestados/clienteAtestados';
import { enviarAvaria } from '../../avarias/clienteAvarias';
import { criarAcaoPendente, criarBancoDeTeste } from '../../db/__tests__/apoio';
import { AcaoPendente } from '../../db/AcaoPendente';
import { apagarTodasAsFotos, salvarFoto } from '../../fotos/armazenamentoFotos';
import { base64DeTexto, existeFoto, sumirComFoto } from '../../fotos/__tests__/apoio';
import { ErroApi } from '../../http/erroApi';
import { ErroAoEnfileirar, executarAcaoAtestado, executarAcaoAvaria } from '../outbox';
import { drenarFila } from '../syncManager';

// #113: a foto é um arquivo no aparelho; a fila guarda só o caminho e o base64
// só nasce no envio. O arquivo some quando o servidor confirma ou recusa.

type Banco = ReturnType<typeof criarBancoDeTeste>;

const enviarAvariaMock = jest.mocked(enviarAvaria);
const enviarAtestadoMock = jest.mocked(enviarAtestado);

const BASE64_A = base64DeTexto('foto-a');
const BASE64_B = base64DeTexto('foto-b');

async function novaFoto(conteudo: string): Promise<string> {
  const origem = new File(Paths.cache, `picker-${Math.random()}.jpg`);
  origem.create({ intermediates: true });
  origem.write(conteudo);
  return salvarFoto(origem.uri, 'image/jpeg');
}

const existe = existeFoto;

async function duasFotos() {
  return [await novaFoto('foto-a'), await novaFoto('foto-b')];
}

async function acoes(database: Banco, status: string) {
  return database.get<AcaoPendente>('acoes_pendentes').query(Q.where('status', status)).fetch();
}

const AVARIA = { idCliente: 'avaria-1', pecaId: 10, tipoAvariaId: 2, descricao: 'Porta riscada' };
const ATESTADO = {
  idCliente: 'atestado-1',
  dataInicio: '2026-10-01',
  dataFim: '2026-10-03',
  observacao: 'Dor lombar',
};

beforeEach(() => {
  jest.clearAllMocks();
  definirTokens({ accessToken: 'token', refreshToken: 'refresh' });
});

afterEach(async () => {
  await apagarTodasAsFotos();
});

describe.each([
  {
    nome: 'avaria',
    tipo: 'avaria',
    enviar: enviarAvariaMock,
    base: AVARIA,
    executar: (database: Banco, fotosCaminhos: string[]) =>
      executarAcaoAvaria(database, { ...AVARIA, fotosCaminhos }),
  },
  {
    nome: 'atestado',
    tipo: 'atestado',
    enviar: enviarAtestadoMock,
    base: ATESTADO,
    executar: (database: Banco, fotosCaminhos: string[]) =>
      executarAcaoAtestado(database, { ...ATESTADO, fotosCaminhos }),
  },
])('$nome com fotos em arquivo', ({ tipo, enviar, base, executar }) => {
  it('sem rede: a fila guarda só os caminhos (nada de base64) e os arquivos ficam', async () => {
    const database = criarBancoDeTeste();
    const caminhos = await duasFotos();
    enviar.mockRejectedValue(new TypeError('Network request failed'));

    expect((await executar(database, caminhos)).tipo).toBe('pendente');

    const [pendente] = await acoes(database, 'pendente');
    expect(pendente.tipo).toBe(tipo);
    expect(JSON.parse(pendente.payload)).toEqual({ ...base, fotosCaminhos: caminhos });
    expect(pendente.payload).not.toContain(BASE64_A);
    expect(caminhos.every(existe)).toBe(true);
  });

  it('online: envia as fotos em base64, esvazia a fila e apaga os arquivos', async () => {
    const database = criarBancoDeTeste();
    const caminhos = await duasFotos();
    enviar.mockResolvedValue({} as never);

    const resultado = await executar(database, caminhos);

    expect(['enviada', 'enviado']).toContain(resultado.tipo);
    const corpo = enviar.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(corpo).toEqual({
      ...base,
      fotos: [
        { conteudoBase64: BASE64_A, mimeType: 'image/jpeg' },
        { conteudoBase64: BASE64_B, mimeType: 'image/jpeg' },
      ],
    });
    expect(corpo).not.toHaveProperty('fotosCaminhos');
    // Aceita: sai do "a enviar" e fica `enviada` até o pull trazer o registro.
    expect(await acoes(database, 'pendente')).toHaveLength(0);
    expect(await acoes(database, 'enviada')).toHaveLength(1);
    expect(caminhos.some(existe)).toBe(false);
  });

  it('recusa de regra (4xx): volta a mensagem, sai da fila e os arquivos são apagados', async () => {
    const database = criarBancoDeTeste();
    const caminhos = await duasFotos();
    enviar.mockRejectedValue(new ErroApi('REGRA', 'O servidor não aceitou', 422));

    expect(await executar(database, caminhos)).toEqual({
      tipo: 'recusado',
      codigo: 'REGRA',
      mensagem: 'O servidor não aceitou',
    });

    expect(await acoes(database, 'pendente')).toHaveLength(0);
    expect(caminhos.some(existe)).toBe(false);
  });

  it('se o próprio enfileiramento falhar, nenhuma linha referencia as fotos: os arquivos são apagados e o erro sobe', async () => {
    const database = criarBancoDeTeste();
    const caminhos = await duasFotos();
    jest.spyOn(database, 'write').mockRejectedValueOnce(new Error('disco cheio'));

    const erro = await executar(database, caminhos).catch((causa: unknown) => causa);

    expect(erro).toBeInstanceOf(ErroAoEnfileirar);
    expect((erro as Error).message).toBe('disco cheio');
    expect(enviar).not.toHaveBeenCalled();
    expect(caminhos.some(existe)).toBe(false);
  });

  it('falha ao marcar como enviada (a linha já existe): não é erro para a tela, fica pendente e com as fotos', async () => {
    const database = criarBancoDeTeste();
    const caminhos = await duasFotos();
    enviar.mockResolvedValue({} as never);
    const escrever = database.write.bind(database);
    // 1ª escrita (enfileirar) passa; a que marcaria como enviada falha.
    jest
      .spyOn(database, 'write')
      .mockImplementationOnce(escrever)
      .mockRejectedValueOnce(new Error('falha ao marcar'));

    expect((await executar(database, caminhos)).tipo).toBe('pendente');

    expect(await acoes(database, 'pendente')).toHaveLength(1);
    expect(caminhos.every(existe)).toBe(true);
  });

  it('401 não apaga nada: a ação e as fotos esperam a sessão renovar', async () => {
    const database = criarBancoDeTeste();
    const caminhos = await duasFotos();
    enviar.mockRejectedValue(new ErroApi('TOKEN_EXPIRADO', 'Sessão expirada', 401));

    expect((await executar(database, caminhos)).tipo).toBe('pendente');

    expect(await acoes(database, 'pendente')).toHaveLength(1);
    expect(caminhos.every(existe)).toBe(true);
  });

  it('drenagem: reenvia lendo os arquivos e os apaga depois do envio confirmado', async () => {
    const database = criarBancoDeTeste();
    const caminhos = await duasFotos();
    enviar.mockRejectedValueOnce(new TypeError('offline'));
    await executar(database, caminhos);
    enviar.mockResolvedValue({} as never);

    await drenarFila(database);

    expect(enviar).toHaveBeenLastCalledWith(
      expect.objectContaining({
        fotos: [
          { conteudoBase64: BASE64_A, mimeType: 'image/jpeg' },
          { conteudoBase64: BASE64_B, mimeType: 'image/jpeg' },
        ],
      }),
      { geracao: expect.any(Number) },
    );
    expect(await acoes(database, 'pendente')).toHaveLength(0);
    expect(caminhos.some(existe)).toBe(false);
  });

  it('drenagem: recusa de regra descarta a ação e apaga os arquivos', async () => {
    const database = criarBancoDeTeste();
    const caminhos = await duasFotos();
    await criarAcaoPendente(database, {
      tipo,
      idCliente: base.idCliente,
      payload: { ...base, fotosCaminhos: caminhos },
    });
    enviar.mockRejectedValue(new ErroApi('REGRA', 'Recusado', 409));

    await drenarFila(database);

    const [descartada] = await acoes(database, 'descartada');
    expect(descartada.mensagemDescarte).toBe('Ação recusada: REGRA.');
    expect(caminhos.some(existe)).toBe(false);
  });

  it('drenagem: sem rede ou 401 mantém os arquivos para a próxima rodada', async () => {
    const database = criarBancoDeTeste();
    const caminhos = await duasFotos();
    await criarAcaoPendente(database, {
      tipo,
      idCliente: base.idCliente,
      payload: { ...base, fotosCaminhos: caminhos },
    });

    enviar.mockRejectedValueOnce(new TypeError('offline'));
    await drenarFila(database);
    enviar.mockRejectedValueOnce(new ErroApi('TOKEN_EXPIRADO', 'Sessão expirada', 401));
    await drenarFila(database);

    expect(await acoes(database, 'pendente')).toHaveLength(1);
    expect(caminhos.every(existe)).toBe(true);
  });

  it('drenagem: se a sessão trocar durante o envio nada é apagado nem gravado', async () => {
    const database = criarBancoDeTeste();
    const caminhos = await duasFotos();
    await criarAcaoPendente(database, {
      tipo,
      idCliente: base.idCliente,
      payload: { ...base, fotosCaminhos: caminhos },
    });
    enviar.mockImplementation(async () => {
      definirTokens(null);
      definirTokens({ accessToken: 'token-de-B', refreshToken: 'refresh-de-B' });
      return {} as never;
    });

    await drenarFila(database);

    expect(await acoes(database, 'pendente')).toHaveLength(1);
    expect(caminhos.every(existe)).toBe(true);
  });
});

describe('fotos que sumiram do aparelho', () => {
  it('avaria: a foto é opcional, então sobe só com as que restam (a fila não trava)', async () => {
    const database = criarBancoDeTeste();
    const [a, b] = await duasFotos();
    await criarAcaoPendente(database, {
      tipo: 'avaria',
      idCliente: AVARIA.idCliente,
      payload: { ...AVARIA, fotosCaminhos: [a, b] },
    });
    sumirComFoto(a);
    enviarAvariaMock.mockResolvedValue({} as never);

    await drenarFila(database);

    expect(enviarAvariaMock.mock.calls[0][0]).toEqual({
      ...AVARIA,
      fotos: [{ conteudoBase64: BASE64_B, mimeType: 'image/jpeg' }],
    });
    expect(await acoes(database, 'pendente')).toHaveLength(0);
  });

  it('atestado sem nenhuma foto não é analisável: é descartado com aviso, sem ir ao servidor', async () => {
    const database = criarBancoDeTeste();
    const [a] = await duasFotos();
    await criarAcaoPendente(database, {
      tipo: 'atestado',
      idCliente: ATESTADO.idCliente,
      payload: { ...ATESTADO, fotosCaminhos: [a] },
    });
    sumirComFoto(a);

    await drenarFila(database);

    expect(enviarAtestadoMock).not.toHaveBeenCalled();
    const [descartada] = await acoes(database, 'descartada');
    expect(descartada.mensagemDescarte).toMatch(/atestado/i);
    expect(await acoes(database, 'pendente')).toHaveLength(0);
  });

  it('payload antigo com base64 dentro (versão anterior do app) ainda sobe como estava', async () => {
    const database = criarBancoDeTeste();
    const fotos = [{ conteudoBase64: 'legado', mimeType: 'image/png' as const }];
    await criarAcaoPendente(database, {
      tipo: 'avaria',
      idCliente: AVARIA.idCliente,
      payload: { ...AVARIA, fotos },
    });
    enviarAvariaMock.mockResolvedValue({} as never);

    await drenarFila(database);

    expect(enviarAvariaMock.mock.calls[0][0]).toEqual({ ...AVARIA, fotos });
  });
});
