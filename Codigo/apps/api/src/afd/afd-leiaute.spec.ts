import { createHash } from 'node:crypto';
import {
  calcularCrc16Kermit,
  calcularHashTipo7,
  formatarCampoAlfanumerico,
  formatarCampoNumerico,
  formatarDataHora,
  linhaAssinaturaDigital,
  montarArquivoAfd,
  montarLinhaTipo7,
  montarRegistroTipo1,
  montarRegistroTipo9,
  nomeArquivoAfd,
} from './afd-leiaute';

const FUSO = 'America/Sao_Paulo';

const EMPRESA = {
  cnpj: '12345678000199',
  razaoSocial: 'MontaControl Montagens Planejadas Ltda',
  registroInpi: '12345678901234567',
  cnpjDesenvolvedor: '98765432000188',
};

describe('formatarCampoNumerico', () => {
  it('preenche com zeros à esquerda', () => {
    expect(formatarCampoNumerico('7', 9)).toBe('000000007');
    expect(formatarCampoNumerico('45212345601', 12)).toBe('045212345601');
  });
});

describe('formatarCampoAlfanumerico', () => {
  it('preenche com espaços à direita', () => {
    expect(formatarCampoAlfanumerico('01', 2)).toBe('01');
    expect(formatarCampoAlfanumerico('', 14)).toBe(' '.repeat(14));
    expect(formatarCampoAlfanumerico('MontaControl', 20)).toBe('MontaControl        ');
  });
});

describe('calcularCrc16Kermit', () => {
  it('vetor de referência do Anexo V: "123456789" -> 2189', () => {
    expect(calcularCrc16Kermit('123456789')).toBe('2189');
  });
});

describe('formatarDataHora', () => {
  it('AAAA-MM-ddThh:mm:00ZZZZZ no fuso de operação', () => {
    expect(formatarDataHora('2026-08-26T11:30:00.000Z', FUSO)).toBe('2026-08-26T08:30:00-0300');
  });
});

describe('montarRegistroTipo1', () => {
  it('monta 302 posições, com os campos nas posições da tabela e CRC-16 correto', () => {
    const linha = montarRegistroTipo1(EMPRESA, '2026-09-01', '2026-09-30', '2026-10-01T12:00:00.000Z', FUSO);

    expect(linha).toHaveLength(302);
    expect(linha.slice(0, 9)).toBe('000000000');
    expect(linha[9]).toBe('1');
    expect(linha[10]).toBe('1');
    expect(linha.slice(11, 25)).toBe(EMPRESA.cnpj.padEnd(14, ' '));
    expect(linha.slice(25, 39)).toBe(' '.repeat(14));
    expect(linha.slice(39, 189)).toBe(EMPRESA.razaoSocial.padEnd(150, ' '));
    expect(linha.slice(189, 206)).toBe(EMPRESA.registroInpi.padEnd(17, ' '));
    expect(linha.slice(206, 216)).toBe('2026-09-01');
    expect(linha.slice(216, 226)).toBe('2026-09-30');
    expect(linha.slice(250, 253)).toBe('004');
    expect(linha[253]).toBe('1');
    expect(linha.slice(254, 268)).toBe(EMPRESA.cnpjDesenvolvedor.padEnd(14, ' '));
    expect(linha.slice(268, 298)).toBe(' '.repeat(30));

    const semCrc = linha.slice(0, 298);
    expect(linha.slice(298)).toBe(calcularCrc16Kermit(semCrc));
  });
});

describe('calcularHashTipo7 e montarLinhaTipo7', () => {
  const dados = {
    nsr: 1,
    cpf: '45212345601',
    marcadoEmIso: '2026-09-01T11:00:00.000Z',
    gravadoEmIso: '2026-09-01T11:00:05.000Z',
    coletor: '01',
    offline: false,
  };

  it('hash é o SHA-256 dos campos 1-7 concatenados, sem encadeamento anterior', () => {
    const hash = calcularHashTipo7(dados, null, FUSO);
    const base =
      '000000001' +
      '7' +
      formatarDataHora(dados.marcadoEmIso, FUSO) +
      formatarCampoNumerico(dados.cpf, 12) +
      formatarDataHora(dados.gravadoEmIso, FUSO) +
      '01' +
      '0';
    expect(base).toHaveLength(73);
    expect(hash).toBe(createHash('sha256').update(base, 'latin1').digest('hex'));
    expect(hash).toHaveLength(64);
  });

  it('encadeia o hash anterior quando existe (valor exato, não só "diferente")', () => {
    const hashAnterior = 'a'.repeat(64);
    const comAnterior = calcularHashTipo7(dados, hashAnterior, FUSO);

    // Reconstrói os campos 1-7 do jeito que o teste anterior já reconstrói,
    // e concatena o hash anterior — pinando o valor exato em vez de só
    // comparar com o caso sem encadeamento (que mudaria mesmo se
    // `hashAnterior` fosse ignorado, já que o NSR já basta para diferenciar
    // os hashes entre si).
    const camposBase =
      '000000001' +
      '7' +
      formatarDataHora(dados.marcadoEmIso, FUSO) +
      formatarCampoNumerico(dados.cpf, 12) +
      formatarDataHora(dados.gravadoEmIso, FUSO) +
      '01' +
      '0';
    const hashEsperado = createHash('sha256').update(camposBase + hashAnterior, 'latin1').digest('hex');

    expect(comAnterior).toBe(hashEsperado);
    expect(comAnterior).not.toBe(calcularHashTipo7(dados, null, FUSO));
  });

  it('a linha tem 137 posições e termina no hash informado', () => {
    const hash = calcularHashTipo7(dados, null, FUSO);
    const linha = montarLinhaTipo7(dados, hash, FUSO);
    expect(linha).toHaveLength(137);
    expect(linha.slice(73)).toBe(hash);
  });
});

describe('montarRegistroTipo9', () => {
  it('64 posições, com a quantidade de tipo 7 e as demais zeradas', () => {
    const linha = montarRegistroTipo9({ tipo2: 0, tipo3: 0, tipo4: 0, tipo5: 0, tipo6: 0, tipo7: 3 });
    expect(linha).toHaveLength(64);
    expect(linha.slice(0, 9)).toBe('999999999');
    expect(linha.slice(54, 63)).toBe('000000003');
    expect(linha[63]).toBe('9');
  });
});

describe('linhaAssinaturaDigital', () => {
  it('100 posições com o texto literal exigido para REP-P', () => {
    const linha = linhaAssinaturaDigital();
    expect(linha).toHaveLength(100);
    expect(linha.trimEnd()).toBe('ASSINATURA_DIGITAL_EM_ARQUIVO_P7S');
  });
});

describe('nomeArquivoAfd', () => {
  it('AFD + INPI + CNPJ + REP_P.txt', () => {
    expect(nomeArquivoAfd('12345678901234567', '12345678000199')).toBe(
      'AFD1234567890123456712345678000199REP_P.txt',
    );
  });
});

describe('montarArquivoAfd', () => {
  it('mês sem marcação gera cabeçalho + trailer zerado + assinatura, sem linha em branco', () => {
    const { conteudo, nomeArquivo } = montarArquivoAfd({
      empresa: EMPRESA,
      dataInicial: '2026-09-01',
      dataFinal: '2026-09-30',
      geradoEmIso: '2026-10-01T12:00:00.000Z',
      fuso: FUSO,
      marcacoes: [],
    });
    const linhas = conteudo.split('\r\n');
    expect(linhas).toHaveLength(4); // tipo1, tipo9, assinatura, '' (do CRLF final)
    expect(linhas[3]).toBe('');
    expect(linhas[0]).toHaveLength(302);
    expect(linhas[1].slice(54, 63)).toBe('000000000');
    expect(linhas[2]).toHaveLength(100);
    expect(nomeArquivo).toBe('AFD1234567890123456712345678000199REP_P.txt');
  });

  it('marcações em ordem de NSR, cada uma com o hash já calculado antes', () => {
    const base = {
      cpf: '45212345601',
      marcadoEmIso: '2026-09-01T11:00:00.000Z',
      gravadoEmIso: '2026-09-01T11:00:05.000Z',
      coletor: '01',
      offline: false,
    };
    const hash1 = calcularHashTipo7({ ...base, nsr: 1 }, null, FUSO);
    const hash2 = calcularHashTipo7({ ...base, nsr: 2 }, hash1, FUSO);

    const { conteudo } = montarArquivoAfd({
      empresa: EMPRESA,
      dataInicial: '2026-09-01',
      dataFinal: '2026-09-30',
      geradoEmIso: '2026-10-01T12:00:00.000Z',
      fuso: FUSO,
      marcacoes: [
        { ...base, nsr: 1, hash: hash1 },
        { ...base, nsr: 2, hash: hash2 },
      ],
    });
    const linhas = conteudo.split('\r\n');
    // tipo1 + 2x tipo7 + tipo9 + assinatura = 5 linhas de conteúdo, mais a
    // string vazia final do split('\r\n') sobre um texto terminado em '\r\n' = 6.
    // (o brief original tinha toHaveLength(5) aqui de propósito, como bug
    // deliberado a ser detectado no RED — corrigido para 6 antes de rodar.)
    expect(linhas).toHaveLength(6);
    expect(linhas[1].slice(73)).toBe(hash1);
    expect(linhas[2].slice(73)).toBe(hash2);
    expect(linhas[3].slice(54, 63)).toBe('000000002');
  });
});
