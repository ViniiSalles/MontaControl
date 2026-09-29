import {
  filtroAtestadosSeed,
  filtroJornadasSeed,
  filtroUsuariosE2e,
  lerArgumentos,
} from '../e2e-limpeza';

const agora = new Date('2026-09-26T12:00:00Z');

describe('lerArgumentos', () => {
  it('aceita datetime ISO completo e assume todos os escopos', () => {
    const o = lerArgumentos(['--desde', '2026-09-26T11:30:00Z'], agora);
    expect(o.desde.toISOString()).toBe('2026-09-26T11:30:00.000Z');
    expect(o.escopos).toEqual(['atestados', 'jornadas', 'usuarios-e2e']);
    expect(o.dryRun).toBe(false);
  });

  it.each(['1', '2026-09-26', '2026-09-26 11:30:00', 'ontem', '2026-09-26T11:30:00'])(
    'rejeita --desde não ISO completo: %s',
    (valor) => {
      expect(() => lerArgumentos(['--desde', valor], agora)).toThrow('ISO-8601');
    },
  );

  it('exige --desde', () => {
    expect(() => lerArgumentos(['--dry-run'], agora)).toThrow('obrigatório');
  });

  it('rejeita --desde com mais de 24h sem --forcar e aceita com --forcar', () => {
    expect(() => lerArgumentos(['--desde', '2026-01-01T00:00:00Z'], agora)).toThrow('--forcar');
    expect(lerArgumentos(['--desde', '2026-01-01T00:00:00Z', '--forcar'], agora).forcar).toBe(true);
  });

  it('valida escopos e argumentos desconhecidos', () => {
    expect(() => lerArgumentos(['--desde', '2026-09-26T11:30:00Z', '--escopos', 'x'], agora)).toThrow(
      'Escopo inválido',
    );
    expect(() => lerArgumentos(['--desde', '2026-09-26T11:30:00Z', '--foo'], agora)).toThrow(
      'desconhecido',
    );
    const o = lerArgumentos(['--desde', '2026-09-26T11:30:00Z', '--escopos', 'atestados', '--dry-run'], agora);
    expect(o.escopos).toEqual(['atestados']);
    expect(o.dryRun).toBe(true);
  });
});

describe('filtros', () => {
  const desde = new Date('2026-09-26T11:30:00Z');

  it('usuários e2e: prefixo, sufixo e createdAt', () => {
    expect(filtroUsuariosE2e(desde)).toEqual({
      email: { startsWith: 'e2e-montador-', endsWith: '@teste.montacontrol.local' },
      createdAt: { gte: desde },
    });
  });

  it('atestados: só do montador seed e createdAt', () => {
    expect(filtroAtestadosSeed(desde)).toEqual({
      usuario: { email: 'montador@montacontrol.local' },
      createdAt: { gte: desde },
    });
  });

  it('jornadas: só do montador seed, createdAt e sem solicitação de ponto', () => {
    expect(filtroJornadasSeed(desde)).toEqual({
      usuario: { email: 'montador@montacontrol.local' },
      createdAt: { gte: desde },
      solicitacaoPonto: null,
    });
  });
});
