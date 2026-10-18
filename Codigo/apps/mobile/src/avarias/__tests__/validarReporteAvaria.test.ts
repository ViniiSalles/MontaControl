import { validarReporteAvaria } from '../validarReporteAvaria';

const FOTO = 'file:///mock/document/fotos_pendentes/a.png';
const VALIDO = { pecaId: 10, tipoAvariaId: 2, descricao: '  Porta riscada  ' };

test('formulário completo vira o que vai para a fila, com descrição aparada e sem fotos quando não há', () => {
  expect(validarReporteAvaria(VALIDO, [])).toEqual({
    erros: {},
    dados: { pecaId: 10, tipoAvariaId: 2, descricao: 'Porta riscada' },
  });
});

test('as fotos anexadas vão como caminhos de arquivo, nunca como base64', () => {
  const { dados } = validarReporteAvaria(VALIDO, [FOTO]);

  expect(dados?.fotosCaminhos).toEqual([FOTO]);
  expect(dados).not.toHaveProperty('fotos');
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
