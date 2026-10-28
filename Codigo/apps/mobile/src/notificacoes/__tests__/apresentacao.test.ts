import { TIPOS_NOTIFICACAO } from '@montacontrol/shared';
import { ABAS } from '../../navegacao/abas';
import {
  abaDaNotificacao,
  iconeDaNotificacao,
  rotuloDoContador,
  subtituloDeNaoLidas,
  tomDaNotificacao,
} from '../apresentacao';

const TONS = ['primary', 'tertiary', 'error', 'success'];

describe('tomDaNotificacao', () => {
  it('é total: todo tipo de notificação tem um tom conhecido', () => {
    for (const tipo of TIPOS_NOTIFICACAO) {
      expect(TONS).toContain(tomDaNotificacao(tipo));
    }
  });

  it('aprovado/validado é sucesso, rejeitado é erro, avaria atualizada é primário', () => {
    expect(tomDaNotificacao('AVARIA_ATUALIZADA')).toBe('primary');
    expect(tomDaNotificacao('ATESTADO_VALIDADO')).toBe('success');
    expect(tomDaNotificacao('ATESTADO_REJEITADO')).toBe('error');
    expect(tomDaNotificacao('PONTO_ATRASO_APROVADO')).toBe('success');
    expect(tomDaNotificacao('PONTO_ATRASO_REJEITADO')).toBe('error');
  });
});

describe('abaDaNotificacao', () => {
  it('é total e só aponta para abas que existem e estão disponíveis', () => {
    const disponiveis = ABAS.filter((aba) => aba.disponivel).map((aba) => aba.id);
    for (const tipo of TIPOS_NOTIFICACAO) {
      const aba = abaDaNotificacao(tipo);
      if (aba !== null) expect(disponiveis).toContain(aba);
    }
  });

  it('leva cada tipo à aba certa e deixa os tipos do gestor sem destino', () => {
    expect(abaDaNotificacao('AVARIA_ATUALIZADA')).toBe('avarias');
    expect(abaDaNotificacao('ATESTADO_VALIDADO')).toBe('atestados');
    expect(abaDaNotificacao('ATESTADO_REJEITADO')).toBe('atestados');
    expect(abaDaNotificacao('PONTO_ATRASO_APROVADO')).toBe('jornada');
    expect(abaDaNotificacao('PONTO_ATRASO_REJEITADO')).toBe('jornada');
    expect(abaDaNotificacao('AVARIA_REPORTADA')).toBeNull();
    expect(abaDaNotificacao('ATESTADO_ENVIADO')).toBeNull();
    expect(abaDaNotificacao('PECA_INCONSISTENTE')).toBeNull();
    expect(abaDaNotificacao('PONTO_ATRASO_SOLICITADO')).toBeNull();
  });
});

describe('iconeDaNotificacao', () => {
  it('é total: todo tipo tem um ícone', () => {
    for (const tipo of TIPOS_NOTIFICACAO) {
      expect(typeof iconeDaNotificacao(tipo)).toBe('string');
    }
  });
});

describe('subtituloDeNaoLidas', () => {
  it('trata zero, singular e plural', () => {
    expect(subtituloDeNaoLidas(0)).toBe('Nenhuma mensagem nova');
    expect(subtituloDeNaoLidas(1)).toBe('Você tem 1 nova mensagem');
    expect(subtituloDeNaoLidas(3)).toBe('Você tem 3 novas mensagens');
  });
});

describe('rotuloDoContador', () => {
  it('limita o número do selo a 9+', () => {
    expect(rotuloDoContador(1)).toBe('1');
    expect(rotuloDoContador(9)).toBe('9');
    expect(rotuloDoContador(10)).toBe('9+');
    expect(rotuloDoContador(120)).toBe('9+');
  });
});
