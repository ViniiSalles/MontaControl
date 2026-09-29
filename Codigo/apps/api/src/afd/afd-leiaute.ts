import { createHash } from 'node:crypto';
import { diaNoFuso, horaNoFuso, offsetFuso } from '@montacontrol/shared';

/** Campo N: preenchido com zeros à esquerda até `tamanho` (Anexo V, item 7). */
export function formatarCampoNumerico(valor: string, tamanho: number): string {
  return valor.padStart(tamanho, '0');
}

/** Campo A (ou D/DH já formatado): preenchido com espaços à direita até `tamanho`. */
export function formatarCampoAlfanumerico(valor: string, tamanho: number): string {
  return valor.padEnd(tamanho, ' ');
}

/**
 * CRC-16/KERMIT (= CRC-16/CCITT-TRUE), poli reflexo 0x8408, valor inicial 0.
 * Vetor de referência do Anexo V: `calcularCrc16Kermit('123456789') === '2189'`.
 */
export function calcularCrc16Kermit(texto: string): string {
  let crc = 0x0000;
  const bytes = Buffer.from(texto, 'latin1');
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x0001 ? (crc >> 1) ^ 0x8408 : crc >> 1;
    }
  }
  return crc.toString(16).padStart(4, '0').toUpperCase();
}

/** Tipo DH do leiaute: `AAAA-MM-ddThh:mm:00ZZZZZ` (segundos sempre "00"). */
export function formatarDataHora(instanteIso: string, fuso: string): string {
  return `${diaNoFuso(instanteIso, fuso)}T${horaNoFuso(instanteIso, fuso)}:00${offsetFuso(instanteIso, fuso)}`;
}

export interface DadosEmpresaAfd {
  /** 14 dígitos. */
  cnpj: string;
  razaoSocial: string;
  /** Número de registro no INPI do REP-P — até 17 dígitos. */
  registroInpi: string;
  /** CNPJ do fabricante/desenvolvedor do REP — 14 dígitos. */
  cnpjDesenvolvedor: string;
}

/** Registro tipo "1" — Cabeçalho (Anexo V, 302 posições). */
export function montarRegistroTipo1(
  empresa: DadosEmpresaAfd,
  dataInicial: string,
  dataFinal: string,
  geradoEmIso: string,
  fuso: string,
): string {
  const semCrc =
    '000000000' + // campo 1, fixo
    '1' + // campo 2 — tipo do registro
    '1' + // campo 3 — identificador do empregador: CNPJ
    formatarCampoAlfanumerico(empresa.cnpj, 14) + // campo 4
    formatarCampoAlfanumerico('', 14) + // campo 5 — CNO/CAEPF, não usado
    formatarCampoAlfanumerico(empresa.razaoSocial, 150) + // campo 6
    formatarCampoAlfanumerico(empresa.registroInpi, 17) + // campo 7
    dataInicial + // campo 8 (já YYYY-MM-DD, 10 posições)
    dataFinal + // campo 9
    formatarDataHora(geradoEmIso, fuso) + // campo 10
    '004' + // campo 11 — versão do leiaute
    '1' + // campo 12 — identificador do desenvolvedor: CNPJ
    formatarCampoAlfanumerico(empresa.cnpjDesenvolvedor, 14) + // campo 13
    formatarCampoAlfanumerico('', 30); // campo 14 — modelo, só REP-C

  return semCrc + calcularCrc16Kermit(semCrc);
}

export interface DadosMarcacaoAfd {
  nsr: number;
  /** 11 dígitos. */
  cpf: string;
  marcadoEmIso: string;
  gravadoEmIso: string;
  /** `"01"` = aplicativo mobile. */
  coletor: string;
  offline: boolean;
}

/** Campos 1-7 do registro tipo 7, exatamente como aparecem no registro (73 posições) — a base do hash. */
function camposTipo7(dados: DadosMarcacaoAfd, fuso: string): string {
  return (
    formatarCampoNumerico(String(dados.nsr), 9) +
    '7' +
    formatarDataHora(dados.marcadoEmIso, fuso) +
    formatarCampoNumerico(dados.cpf, 12) +
    formatarDataHora(dados.gravadoEmIso, fuso) +
    formatarCampoAlfanumerico(dados.coletor, 2) +
    (dados.offline ? '1' : '0')
  );
}

/** SHA-256 dos campos 1-7 + hash do registro tipo 7 anterior (`''` se não houver). Hex minúsculo. */
export function calcularHashTipo7(dados: DadosMarcacaoAfd, hashAnterior: string | null, fuso: string): string {
  const base = camposTipo7(dados, fuso) + (hashAnterior ?? '');
  return createHash('sha256').update(base, 'latin1').digest('hex');
}

/** Registro tipo "7" completo (137 posições), com o hash já calculado (por `calcularHashTipo7`). */
export function montarLinhaTipo7(dados: DadosMarcacaoAfd, hash: string, fuso: string): string {
  return camposTipo7(dados, fuso) + hash;
}

export interface QuantidadesPorTipo {
  tipo2: number;
  tipo3: number;
  tipo4: number;
  tipo5: number;
  tipo6: number;
  tipo7: number;
}

/** Registro tipo "9" — Trailer (64 posições). */
export function montarRegistroTipo9(quantidades: QuantidadesPorTipo): string {
  return (
    '999999999' +
    formatarCampoNumerico(String(quantidades.tipo2), 9) +
    formatarCampoNumerico(String(quantidades.tipo3), 9) +
    formatarCampoNumerico(String(quantidades.tipo4), 9) +
    formatarCampoNumerico(String(quantidades.tipo5), 9) +
    formatarCampoNumerico(String(quantidades.tipo6), 9) +
    formatarCampoNumerico(String(quantidades.tipo7), 9) +
    '9'
  );
}

/** Linha de assinatura digital (100 posições) — texto literal exigido para REP-A/REP-P, sem .p7s real. */
export function linhaAssinaturaDigital(): string {
  return formatarCampoAlfanumerico('ASSINATURA_DIGITAL_EM_ARQUIVO_P7S', 100);
}

/** `AFD` + nº de registro no INPI + CNPJ do empregador + `REP_P` + `.txt`. */
export function nomeArquivoAfd(registroInpi: string, cnpjEmpregador: string): string {
  return `AFD${registroInpi}${cnpjEmpregador}REP_P.txt`;
}

export interface DadosArquivoAfd {
  empresa: DadosEmpresaAfd;
  /** `YYYY-MM-DD`. */
  dataInicial: string;
  /** `YYYY-MM-DD`. */
  dataFinal: string;
  geradoEmIso: string;
  fuso: string;
  /** Já em ordem de NSR, já seladas (hash calculado). */
  marcacoes: Array<DadosMarcacaoAfd & { hash: string }>;
}

/** Monta o arquivo inteiro: cabeçalho, uma linha por marcação, trailer e assinatura. */
export function montarArquivoAfd(dados: DadosArquivoAfd): { conteudo: string; nomeArquivo: string } {
  const linhas = [
    montarRegistroTipo1(dados.empresa, dados.dataInicial, dados.dataFinal, dados.geradoEmIso, dados.fuso),
    ...dados.marcacoes.map((marcacao) => montarLinhaTipo7(marcacao, marcacao.hash, dados.fuso)),
    montarRegistroTipo9({ tipo2: 0, tipo3: 0, tipo4: 0, tipo5: 0, tipo6: 0, tipo7: dados.marcacoes.length }),
    linhaAssinaturaDigital(),
  ];

  return {
    conteudo: `${linhas.join('\r\n')}\r\n`,
    nomeArquivo: nomeArquivoAfd(dados.empresa.registroInpi, dados.empresa.cnpj),
  };
}
