import { picoDeUso, unidadesEmUso, type Ocupacao } from './disponibilidade';

const h = (hora: number) => new Date(Date.UTC(2026, 9, 27, hora));

function ocupacao(inicio: number, fim: number, quantidade = 1, devolvidoEm: number | null = null): Ocupacao {
  return { inicio: h(inicio), fimPrevisto: h(fim), devolvidoEm: devolvidoEm === null ? null : h(devolvidoEm), quantidade };
}

describe('picoDeUso', () => {
  const agora = h(8);

  it('sem aluguéis o pico é zero', () => {
    expect(picoDeUso([], h(9), h(12), agora)).toBe(0);
  });

  it('aluguéis em sequência dentro da janela não se somam', () => {
    const ocupacoes = [ocupacao(9, 10, 2), ocupacao(10, 11, 2), ocupacao(11, 12, 1)];

    expect(picoDeUso(ocupacoes, h(9), h(12), agora)).toBe(2);
  });

  it('aluguéis sobrepostos se somam', () => {
    const ocupacoes = [ocupacao(9, 11, 2), ocupacao(10, 12, 3)];

    expect(picoDeUso(ocupacoes, h(9), h(12), agora)).toBe(5);
  });

  it('ignora o que está fora da janela', () => {
    const ocupacoes = [ocupacao(6, 9, 4), ocupacao(12, 14, 4)];

    expect(picoDeUso(ocupacoes, h(9), h(12), agora)).toBe(0);
  });

  it('devolução antecipada libera a unidade a partir da devolução', () => {
    const ocupacoes = [ocupacao(9, 12, 1, 10)];

    expect(picoDeUso(ocupacoes, h(10), h(11), agora)).toBe(0);
    expect(picoDeUso(ocupacoes, h(9), h(11), agora)).toBe(1);
  });

  it('aluguel atrasado segura a unidade indefinidamente', () => {
    const ocupacoes = [ocupacao(5, 7, 1)];

    expect(picoDeUso(ocupacoes, h(20), h(22), agora)).toBe(1);
  });
});

describe('unidadesEmUso', () => {
  it('conta em uso e atrasado; ignora reservado e devolvido', () => {
    const agora = h(10);
    const ocupacoes = [ocupacao(9, 11, 2), ocupacao(6, 8, 1), ocupacao(12, 14, 5), ocupacao(8, 12, 4, 9)];

    expect(unidadesEmUso(ocupacoes, agora)).toBe(3);
  });
});
