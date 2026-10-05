import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ClientesRepository } from './clientes.repository';
import { ClientesService } from './clientes.service';
import { GeocodificacaoGateway } from './geocodificacao.gateway';

const dadosCliente = {
  nome: '  Maria Souza ',
  endereco: ' Rua das Flores, 100 ',
  cidade: ' Belo Horizonte ',
  estado: 'MG',
  cep: '30130100',
  telefone: '(31) 99999-8888',
  latitude: -19.9,
  longitude: -43.9,
};

describe('ClientesService', () => {
  let repository: {
    listar: jest.Mock;
    existe: jest.Mock;
    buscarPorId: jest.Mock;
    criar: jest.Mock;
    atualizar: jest.Mock;
  };
  let geocodificacao: { buscar: jest.Mock };
  let service: ClientesService;

  beforeEach(() => {
    repository = {
      listar: jest.fn(),
      existe: jest.fn(),
      buscarPorId: jest.fn(),
      criar: jest.fn((dados) => Promise.resolve({ id: 1, ...dados })),
      atualizar: jest.fn((id, dados) => Promise.resolve({ id, ...dados })),
    };
    geocodificacao = { buscar: jest.fn() };
    service = new ClientesService(
      repository as unknown as ClientesRepository,
      geocodificacao as unknown as GeocodificacaoGateway,
    );
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

  it('cria normalizando texto, CEP e telefone', async () => {
    await service.criar(dadosCliente);

    expect(repository.criar).toHaveBeenCalledWith({
      nome: 'Maria Souza',
      endereco: 'Rua das Flores, 100',
      cidade: 'Belo Horizonte',
      estado: 'MG',
      cep: '30130-100',
      telefone: '31999998888',
      latitude: -19.9,
      longitude: -43.9,
    });
  });

  it('atualizar ou detalhar cliente inexistente é 404', async () => {
    repository.atualizar.mockResolvedValue(null);
    repository.buscarPorId.mockResolvedValue(null);

    await expect(service.atualizar(9, dadosCliente)).rejects.toThrow(NotFoundException);
    await expect(service.detalhar(9)).rejects.toThrow(NotFoundException);
  });

  it('geocodificar devolve as coordenadas encontradas com o CEP formatado na busca', async () => {
    const encontrado = { latitude: -19.9, longitude: -43.9, enderecoEncontrado: 'Rua das Flores' };
    geocodificacao.buscar.mockResolvedValue(encontrado);

    const resultado = await service.geocodificar({
      endereco: 'Rua das Flores, 100',
      cidade: 'Belo Horizonte',
      estado: 'MG',
      cep: '30130100',
    });

    expect(resultado).toEqual(encontrado);
    expect(geocodificacao.buscar).toHaveBeenCalledWith(expect.objectContaining({ cep: '30130-100' }));
  });

  it('endereço não localizado é 422', async () => {
    geocodificacao.buscar.mockResolvedValue(null);

    await expect(
      service.geocodificar({ endereco: 'Rua X', cidade: 'Lugar', estado: 'MG' }),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});
