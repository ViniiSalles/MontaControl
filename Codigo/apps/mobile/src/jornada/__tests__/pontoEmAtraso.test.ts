import { mascararData, mascararHora, validarPontoEmAtraso } from '../pontoEmAtraso';
import type { CamposPontoEmAtraso } from '../pontoEmAtraso';

const HOJE = '2026-08-29';

function campos(parcial: Partial<CamposPontoEmAtraso> = {}): CamposPontoEmAtraso {
  return {
    data: '26/08/2026',
    horaInicio: '08:00',
    horaFim: '17:00',
    justificativa: 'Fiquei sem bateria no celular a manhã inteira.',
    ...parcial,
  };
}

describe('máscaras', () => {
  it('data ganha as barras conforme o montador digita', () => {
    expect(mascararData('2')).toBe('2');
    expect(mascararData('26')).toBe('26');
    expect(mascararData('268')).toBe('26/8');
    expect(mascararData('26082026')).toBe('26/08/2026');
  });

  it('máscara ignora o que não é dígito e não passa do formato', () => {
    expect(mascararData('26/08/2026999')).toBe('26/08/2026');
    expect(mascararHora('0800')).toBe('08:00');
    expect(mascararHora('08:00:59')).toBe('08:00');
  });
});

describe('validarPontoEmAtraso', () => {
  it('formulário completo produz o corpo da requisição em ISO', () => {
    const { erros, dados } = validarPontoEmAtraso(campos(), HOJE);

    expect(erros).toEqual({});
    expect(dados).toEqual({
      data: '2026-08-26',
      horaInicio: '08:00',
      horaFim: '17:00',
      justificativa: 'Fiquei sem bateria no celular a manhã inteira.',
    });
  });

  it('data incompleta ou inexistente é recusada antes da rede', () => {
    expect(validarPontoEmAtraso(campos({ data: '26/08' }), HOJE).erros.data).toBeDefined();
    // 31/02 existe como texto, não como dia — `Date` normalizaria em silêncio.
    expect(validarPontoEmAtraso(campos({ data: '31/02/2026' }), HOJE).erros.data).toBeDefined();
  });

  it('data futura é recusada', () => {
    const { erros, dados } = validarPontoEmAtraso(campos({ data: '30/08/2026' }), HOJE);

    expect(erros.data).toMatch(/futuro/i);
    expect(dados).toBeNull();
  });

  it('hoje é aceito — o limite é o futuro, não o dia corrente', () => {
    expect(validarPontoEmAtraso(campos({ data: '29/08/2026' }), HOJE).erros.data).toBeUndefined();
  });

  it('hora fora do relógio de 24h é recusada', () => {
    expect(validarPontoEmAtraso(campos({ horaInicio: '25:00' }), HOJE).erros.horaInicio).toBeDefined();
    expect(validarPontoEmAtraso(campos({ horaFim: '17:75' }), HOJE).erros.horaFim).toBeDefined();
  });

  it('saída anterior ou igual à entrada é recusada', () => {
    expect(validarPontoEmAtraso(campos({ horaFim: '07:00' }), HOJE).erros.horaFim).toMatch(
      /depois da entrada/i,
    );
    expect(validarPontoEmAtraso(campos({ horaFim: '08:00' }), HOJE).erros.horaFim).toBeDefined();
  });

  it('justificativa curta é recusada — é só com ela que o gestor decide', () => {
    const { erros, dados } = validarPontoEmAtraso(campos({ justificativa: 'esqueci' }), HOJE);

    expect(erros.justificativa).toBeDefined();
    expect(dados).toBeNull();
  });

  it('acumula os erros de todos os campos numa passada só', () => {
    const { erros } = validarPontoEmAtraso(
      { data: 'x', horaInicio: 'y', horaFim: 'z', justificativa: '' },
      HOJE,
    );

    expect(Object.keys(erros).sort()).toEqual(['data', 'horaFim', 'horaInicio', 'justificativa']);
  });
});
