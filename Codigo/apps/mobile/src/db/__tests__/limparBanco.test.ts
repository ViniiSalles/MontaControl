import { File, Paths } from 'expo-file-system';
import { apagarTodasAsFotos, salvarFoto } from '../../fotos/armazenamentoFotos';
import { existeFoto } from '../../fotos/__tests__/apoio';
import { criarAcaoPendente, criarBancoDeTeste } from './apoio';
import { limparBancoCompleto } from '../limparBanco';

async function fotoGuardada(): Promise<string> {
  const origem = new File(Paths.cache, `picker-${Math.random()}.jpg`);
  origem.create({ intermediates: true });
  origem.write('foto');
  return salvarFoto(origem.uri, 'image/jpeg');
}

afterEach(async () => {
  await apagarTodasAsFotos();
});

describe('limparBancoCompleto (logout e troca de usuário)', () => {
  it('apaga a fila e as fotos que ela guardava', async () => {
    const database = criarBancoDeTeste();
    const caminho = await fotoGuardada();
    await criarAcaoPendente(database, {
      tipo: 'atestado',
      idCliente: 'atestado-1',
      payload: { fotosCaminhos: [caminho] },
    });

    await limparBancoCompleto(database);

    expect(await database.get('acoes_pendentes').query().fetchCount()).toBe(0);
    expect(existeFoto(caminho)).toBe(false);
  });

  it('apaga também a foto de rascunho que nenhuma ação referencia', async () => {
    const database = criarBancoDeTeste();
    const caminho = await fotoGuardada();

    await limparBancoCompleto(database);

    expect(existeFoto(caminho)).toBe(false);
  });

  it('se o banco não deixa apagar, as fotos ficam (a fila ainda as referencia)', async () => {
    const database = criarBancoDeTeste();
    const caminho = await fotoGuardada();
    jest.spyOn(database, 'unsafeResetDatabase').mockRejectedValue(new Error('banco travado'));

    await expect(limparBancoCompleto(database)).rejects.toThrow('banco travado');

    expect(existeFoto(caminho)).toBe(true);
  });
});
