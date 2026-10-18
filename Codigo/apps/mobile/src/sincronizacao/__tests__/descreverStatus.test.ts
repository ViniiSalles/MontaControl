import { descreverStatus, formatarHa } from '../descreverStatus';
import type { EntradaDoStatus } from '../descreverStatus';

const AGORA = Date.UTC(2026, 9, 18, 15, 0, 0);
const MINUTO = 60_000;
const HORA = 60 * MINUTO;

const OCIOSO: EntradaDoStatus = {
  online: true,
  sincronizando: false,
  pendentes: 0,
  ultimaSincronizacaoEm: AGORA - 5 * MINUTO,
  ultimoErro: null,
};

const descrever = (parcial: Partial<EntradaDoStatus>) =>
  descreverStatus({ ...OCIOSO, ...parcial }, AGORA);

describe('formatarHa', () => {
  it.each([
    [0, 'agora'],
    [30_000, 'agora'],
    [59_999, 'agora'],
    [MINUTO, 'há 1 min'],
    [5 * MINUTO, 'há 5 min'],
    [59 * MINUTO, 'há 59 min'],
    [HORA, 'há 1 h'],
    [3 * HORA + 40 * MINUTO, 'há 3 h'],
    [24 * HORA, 'há 1 dia'],
    [3 * 24 * HORA, 'há 3 dias'],
  ])('%i ms atrás → %s', (decorrido, esperado) => {
    expect(formatarHa(decorrido)).toBe(esperado);
  });

  it('relógio do aparelho voltou no tempo: nunca mostra duração negativa', () => {
    expect(formatarHa(-5 * MINUTO)).toBe('agora');
  });
});

describe('descreverStatus', () => {
  it('tudo em dia: sincronizado há X', () => {
    expect(descrever({})).toEqual({ variante: 'sucesso', texto: 'Sincronizado há 5 min' });
  });

  it('acabou de sincronizar: sincronizado agora', () => {
    expect(descrever({ ultimaSincronizacaoEm: AGORA })).toEqual({
      variante: 'sucesso',
      texto: 'Sincronizado agora',
    });
  });

  it('nunca sincronizou: aguardando', () => {
    expect(descrever({ ultimaSincronizacaoEm: null })).toEqual({
      variante: 'neutro',
      texto: 'Aguardando a primeira sincronização',
    });
  });

  it('sincronizando', () => {
    expect(descrever({ sincronizando: true })).toEqual({
      variante: 'info',
      texto: 'Sincronizando…',
    });
  });

  it('sincronizando com pendências: mostra quantas faltam', () => {
    expect(descrever({ sincronizando: true, pendentes: 2 }).texto).toBe(
      'Sincronizando… · 2 pendentes',
    );
  });

  it('sem conexão', () => {
    expect(descrever({ online: false })).toEqual({ variante: 'aviso', texto: 'Sem conexão' });
  });

  it('sem conexão e com ações na fila', () => {
    expect(descrever({ online: false, pendentes: 3 })).toEqual({
      variante: 'aviso',
      texto: 'Sem conexão · 3 pendentes',
    });
  });

  it('pendências com conexão: singular e plural', () => {
    expect(descrever({ pendentes: 1 })).toEqual({ variante: 'aviso', texto: '1 pendente' });
    expect(descrever({ pendentes: 4 })).toEqual({ variante: 'aviso', texto: '4 pendentes' });
  });

  it('com conexão mas o servidor não respondeu (sem_rede)', () => {
    expect(descrever({ ultimoErro: 'sem_rede' })).toEqual({
      variante: 'aviso',
      texto: 'Servidor sem resposta',
    });
    expect(descrever({ ultimoErro: 'sem_rede', pendentes: 2 }).texto).toBe(
      'Servidor sem resposta · 2 pendentes',
    );
  });

  it.each(['falha', 'sessao'] as const)('erro %s: falha ao sincronizar', (ultimoErro) => {
    expect(descrever({ ultimoErro })).toEqual({
      variante: 'erro',
      texto: 'Falha ao sincronizar',
    });
    expect(descrever({ ultimoErro, pendentes: 1 }).texto).toBe('Falha ao sincronizar · 1 pendente');
  });

  it('versão incompatível: pede para atualizar o app, acima de tudo', () => {
    expect(descrever({ ultimoErro: 'versao_incompativel', online: false, pendentes: 5 })).toEqual({
      variante: 'erro',
      texto: 'Atualize o aplicativo para sincronizar',
    });
  });

  it('sem conexão tem prioridade sobre o último erro (o erro é consequência)', () => {
    expect(descrever({ online: false, ultimoErro: 'sem_rede' }).texto).toBe('Sem conexão');
  });
});
