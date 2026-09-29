import { ClientesRepository } from './clientes.repository';
import { ClientesService } from './clientes.service';

describe('ClientesService', () => {
  let repository: { listar: jest.Mock; existe: jest.Mock };
  let service: ClientesService;

  beforeEach(() => {
    repository = { listar: jest.fn(), existe: jest.fn() };
    service = new ClientesService(repository as unknown as ClientesRepository);
  });

  it('repassa a busca ao repositório', async () => {
    const clientes = [
      { id: 1, nome: 'Cliente Um', endereco: 'Rua A, 1', cidade: 'BH', estado: 'MG' },
    ];
    repository.listar.mockResolvedValue(clientes);

    const resultado = await service.listar('clien');

    expect(resultado).toEqual(clientes);
    expect(repository.listar).toHaveBeenCalledWith('clien');
  });

  it('busca vazia lista todos', async () => {
    repository.listar.mockResolvedValue([]);

    await service.listar(undefined);

    expect(repository.listar).toHaveBeenCalledWith(undefined);
  });
});
