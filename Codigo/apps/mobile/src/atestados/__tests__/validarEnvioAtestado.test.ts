import { validarEnvioAtestado } from '../validarEnvioAtestado';
import type { CamposNovoAtestado } from '../validarEnvioAtestado';

const UMA_FOTO = [{ conteudoBase64: 'abc123', mimeType: 'image/jpeg' as const }];

function campos(parcial: Partial<CamposNovoAtestado> = {}): CamposNovoAtestado {
  return { dataInicio: '01/09/2026', dataFim: '03/09/2026', ...parcial };
}

describe('validarEnvioAtestado', () => {
  it('aceita período válido com ao menos uma foto', () => {
    const { erros, dados } = validarEnvioAtestado(campos(), UMA_FOTO);

    expect(erros).toEqual({});
    expect(dados).toEqual({
      dataInicio: '2026-09-01',
      dataFim: '2026-09-03',
      fotos: UMA_FOTO,
    });
  });

  it('data de início em formato inválido aponta o campo', () => {
    const { erros, dados } = validarEnvioAtestado(campos({ dataInicio: '31/02/2026' }), UMA_FOTO);

    expect(erros.dataInicio).toMatch(/DD\/MM\/AAAA/);
    expect(dados).toBeNull();
  });

  it('data de fim em formato inválido aponta o campo', () => {
    const { erros, dados } = validarEnvioAtestado(campos({ dataFim: '' }), UMA_FOTO);

    expect(erros.dataFim).toMatch(/DD\/MM\/AAAA/);
    expect(dados).toBeNull();
  });

  it('data de fim anterior à de início é recusada', () => {
    const { erros, dados } = validarEnvioAtestado(
      campos({ dataInicio: '10/09/2026', dataFim: '05/09/2026' }),
      UMA_FOTO,
    );

    expect(erros.dataFim).toMatch(/anterior/);
    expect(dados).toBeNull();
  });

  it('atestado de um dia só (dataInicio === dataFim) é válido', () => {
    const { erros, dados } = validarEnvioAtestado(
      campos({ dataInicio: '01/09/2026', dataFim: '01/09/2026' }),
      UMA_FOTO,
    );

    expect(erros).toEqual({});
    expect(dados?.dataInicio).toBe(dados?.dataFim);
  });

  it('sem foto nenhuma é recusado', () => {
    const { erros, dados } = validarEnvioAtestado(campos(), []);

    expect(erros.fotos).toMatch(/foto/i);
    expect(dados).toBeNull();
  });
});
