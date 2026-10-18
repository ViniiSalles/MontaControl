import type { LeituraDono } from '../../db/donoDaFila';
import { decidirDestinoDaFila } from '../destinoDaFila';

const AUSENTE: LeituraDono = { tipo: 'ausente' };
const ERRO: LeituraDono = { tipo: 'erro' };
const dono = (usuarioId: number): LeituraDono => ({ tipo: 'dono', usuarioId });

const USUARIO = 1;

function decidir(
  acoes: number | 'erro',
  donoBanco: LeituraDono,
  donoMarcador: LeituraDono,
  usuarioId = USUARIO,
) {
  return decidirDestinoDaFila({ acoes, donoBanco, donoMarcador, usuarioId });
}

// Fail-closed: a fila só é mantida quando há prova de que é do usuário que autentica.
describe('decidirDestinoDaFila', () => {
  test('fila vazia: nada a apagar, mesmo sem dono ou com dono ilegível', () => {
    expect(decidir(0, AUSENTE, AUSENTE)).toBe('manter');
    expect(decidir(0, ERRO, ERRO)).toBe('manter');
    expect(decidir(0, dono(99), AUSENTE)).toBe('manter');
  });

  test('fila não vazia e nenhuma fonte com dono (ex.: fila anterior a esta versão): apaga', () => {
    expect(decidir(3, AUSENTE, AUSENTE)).toBe('apagar');
  });

  test('erro de leitura em qualquer das fontes: dono desconhecido, apaga', () => {
    expect(decidir(3, ERRO, AUSENTE)).toBe('apagar');
    expect(decidir(3, AUSENTE, ERRO)).toBe('apagar');
    expect(decidir(3, dono(USUARIO), ERRO)).toBe('apagar');
    expect(decidir(3, ERRO, dono(USUARIO))).toBe('apagar');
  });

  test('erro ao contar a fila: trata como não vazia', () => {
    expect(decidir('erro', AUSENTE, AUSENTE)).toBe('apagar');
    expect(decidir('erro', dono(USUARIO), AUSENTE)).toBe('manter');
  });

  test('dono é o mesmo usuário (banco, marcador ou ambos): mantém', () => {
    expect(decidir(3, dono(USUARIO), AUSENTE)).toBe('manter');
    expect(decidir(3, AUSENTE, dono(USUARIO))).toBe('manter');
    expect(decidir(3, dono(USUARIO), dono(USUARIO))).toBe('manter');
  });

  test('dono é outro usuário: apaga', () => {
    expect(decidir(3, dono(2), AUSENTE)).toBe('apagar');
    expect(decidir(3, AUSENTE, dono(2))).toBe('apagar');
  });

  // Marcador do SecureStore que sobrou depois do wipe de outro usuário (a limpeza
  // dele falhou). O dono do banco é gravado a cada login, então ele vale mais.
  test('dono do banco e marcador divergentes: o marcador é velho, vale o dono do banco', () => {
    expect(decidir(3, dono(USUARIO), dono(2))).toBe('manter');
    expect(decidir(3, dono(2), dono(USUARIO))).toBe('apagar');
  });
});
