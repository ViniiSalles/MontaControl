import { validarReporteAvaria } from '../validarReporteAvaria';

const FOTO = { conteudoBase64: 'abc', mimeType: 'image/png' as const };
const VALIDO = { pecaId: 10, tipoAvariaId: 2, descricao: '  Porta riscada  ' };

test('formulário completo vira corpo com descrição aparada e sem fotos quando não há', () => {
  expect(validarReporteAvaria(VALIDO, [])).toEqual({
    erros: {},
    dados: { pecaId: 10, tipoAvariaId: 2, descricao: 'Porta riscada' },
  });
});

test('fotos anexadas vão no corpo', () => {
  expect(validarReporteAvaria(VALIDO, [FOTO]).dados?.fotos).toEqual([FOTO]);
});

test('cobra peça, tipo e descrição', () => {
  const { erros, dados } = validarReporteAvaria({ pecaId: null, tipoAvariaId: null, descricao: ' ' }, []);
  expect(dados).toBeNull();
  expect(Object.keys(erros).sort()).toEqual(['descricao', 'peca', 'tipo']);
});

test('limita descrição e quantidade de fotos', () => {
  const { erros } = validarReporteAvaria({ ...VALIDO, descricao: 'x'.repeat(501) }, [FOTO, FOTO, FOTO, FOTO]);
  expect(erros.descricao).toMatch(/500/);
  expect(erros.fotos).toMatch(/3/);
});
