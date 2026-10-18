import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { limparBancoCompleto } from '../../db/limparBanco';
import { limparEspelhoLocal } from '../../db/limparEspelho';
import { armazenamentoDoBanco } from '../armazenamentoDoBanco';

jest.mock('../../fotos/armazenamentoFotos', () => ({
  apagarTodasAsFotos: jest.fn().mockResolvedValue(undefined),
}));

describe('armazenamentoDoBanco', () => {
  it('guarda e devolve o texto pelo localStorage do banco', async () => {
    const database = criarBancoDeTeste();
    const armazenamento = armazenamentoDoBanco(database);

    await armazenamento.setItem('chave', '{"a":1}');

    expect(await armazenamento.getItem('chave')).toBe('{"a":1}');
    // É mesmo o localStorage do WatermelonDB (o mesmo que o wipe do logout apaga).
    expect(await database.localStorage.get('chave')).toBe('{"a":1}');
  });

  it('chave inexistente devolve null', async () => {
    const armazenamento = armazenamentoDoBanco(criarBancoDeTeste());

    expect(await armazenamento.getItem('nao-existe')).toBeNull();
  });

  it('removeItem apaga a chave', async () => {
    const armazenamento = armazenamentoDoBanco(criarBancoDeTeste());
    await armazenamento.setItem('chave', 'x');

    await armazenamento.removeItem('chave');

    expect(await armazenamento.getItem('chave')).toBeNull();
  });

  it('é melhor esforço: falha do banco nunca rejeita (leitura vira null)', async () => {
    const database = criarBancoDeTeste();
    const armazenamento = armazenamentoDoBanco(database);
    jest.spyOn(database.localStorage, 'get').mockRejectedValue(new Error('disco'));
    jest.spyOn(database.localStorage, 'set').mockRejectedValue(new Error('disco'));
    jest.spyOn(database.localStorage, 'remove').mockRejectedValue(new Error('disco'));

    await expect(armazenamento.getItem('chave')).resolves.toBeNull();
    await expect(armazenamento.setItem('chave', 'x')).resolves.toBeUndefined();
    await expect(armazenamento.removeItem('chave')).resolves.toBeUndefined();
  });

  it('valor que não é texto (lixo gravado por outra versão) é lido como ausente', async () => {
    const database = criarBancoDeTeste();
    await database.localStorage.set('chave', { inesperado: true });

    expect(await armazenamentoDoBanco(database).getItem('chave')).toBeNull();
  });

  it('o wipe completo (logout) apaga a chave; a limpeza da réplica (expiração forçada) NÃO apaga', async () => {
    const database = criarBancoDeTeste();
    const armazenamento = armazenamentoDoBanco(database);
    await armazenamento.setItem('chave-da-ui', 'rascunho');

    await limparEspelhoLocal(database);
    expect(await armazenamento.getItem('chave-da-ui')).toBe('rascunho');

    await limparBancoCompleto(database);
    expect(await armazenamento.getItem('chave-da-ui')).toBeNull();
  });
});
