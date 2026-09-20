import { paraFotoBase64 } from '../fotoParaBase64';

describe('paraFotoBase64', () => {
  it('converte um asset JPEG do picker', () => {
    const foto = paraFotoBase64({ base64: 'abc123', mimeType: 'image/jpeg' });

    expect(foto).toEqual({ conteudoBase64: 'abc123', mimeType: 'image/jpeg' });
  });

  it('converte um asset PNG do picker', () => {
    const foto = paraFotoBase64({ base64: 'xyz789', mimeType: 'image/png' });

    expect(foto).toEqual({ conteudoBase64: 'xyz789', mimeType: 'image/png' });
  });

  it('sem base64 (picker sem a opção) devolve null', () => {
    expect(paraFotoBase64({ mimeType: 'image/jpeg' })).toBeNull();
  });

  it('formato fora de JPEG/PNG (ex.: HEIC) devolve null', () => {
    expect(paraFotoBase64({ base64: 'abc123', mimeType: 'image/heic' })).toBeNull();
  });
});
