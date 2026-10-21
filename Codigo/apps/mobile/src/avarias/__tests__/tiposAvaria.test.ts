import { ehTipoOutro, ordenarTiposComOutroPorUltimo } from '../tiposAvaria';

const tipo = (id: number, nome: string) => ({ id, nome, descricao: '' });

describe('ehTipoOutro', () => {
  it.each(['Outro', 'outro', 'OUTRO', ' Outro '])('"%s" é o tipo Outro', (nome) => {
    expect(ehTipoOutro({ nome })).toBe(true);
  });

  it('outros nomes não são', () => {
    expect(ehTipoOutro({ nome: 'Outros danos' })).toBe(false);
    expect(ehTipoOutro({ nome: 'Risco' })).toBe(false);
  });
});

describe('ordenarTiposComOutroPorUltimo', () => {
  it('leva "Outro" para o fim e mantém a ordem dos demais, sem mutar a entrada', () => {
    const entrada = [tipo(6, 'Outro'), tipo(1, 'Amassado'), tipo(2, 'Risco')];

    expect(ordenarTiposComOutroPorUltimo(entrada).map((t) => t.nome)).toEqual([
      'Amassado',
      'Risco',
      'Outro',
    ]);
    expect(entrada[0].nome).toBe('Outro');
  });
});
