import { Injectable } from '@nestjs/common';
import { formatarCep } from '@montacontrol/shared';
import type {
  ClienteDTO,
  ClienteResumoDTO,
  CoordenadasEncontradasDTO,
  GeocodificarEnderecoRequest,
  SalvarClienteRequest,
} from '@montacontrol/shared';
import { ClientesRepository } from './clientes.repository';
import { ClienteNaoEncontradoException } from './exceptions/cliente-nao-encontrado.exception';
import { EnderecoNaoLocalizadoException } from './exceptions/endereco-nao-localizado.exception';
import { GeocodificacaoGateway } from './geocodificacao.gateway';

/** Grava sempre no mesmo formato: CEP `00000-000`, telefone só dígitos, texto aparado. */
function normalizar(dados: SalvarClienteRequest): SalvarClienteRequest {
  return {
    nome: dados.nome.trim(),
    endereco: dados.endereco.trim(),
    cidade: dados.cidade.trim(),
    estado: dados.estado,
    cep: formatarCep(dados.cep) ?? dados.cep,
    telefone: dados.telefone.replace(/\D/g, ''),
    latitude: dados.latitude,
    longitude: dados.longitude,
  };
}

@Injectable()
export class ClientesService {
  constructor(
    private readonly clientes: ClientesRepository,
    private readonly geocodificacao: GeocodificacaoGateway,
  ) {}

  async listar(busca?: string): Promise<ClienteResumoDTO[]> {
    return this.clientes.listar(busca);
  }

  async detalhar(id: number): Promise<ClienteDTO> {
    const cliente = await this.clientes.buscarPorId(id);
    if (!cliente) throw new ClienteNaoEncontradoException();
    return cliente;
  }

  async criar(dados: SalvarClienteRequest): Promise<ClienteDTO> {
    return this.clientes.criar(normalizar(dados));
  }

  /**
   * Mudar as coordenadas muda a referência do check-in dos montadores nas
   * obras desse cliente — é o comportamento esperado quando o endereço foi
   * corrigido.
   */
  async atualizar(id: number, dados: SalvarClienteRequest): Promise<ClienteDTO> {
    const cliente = await this.clientes.atualizar(id, normalizar(dados));
    if (!cliente) throw new ClienteNaoEncontradoException();
    return cliente;
  }

  async geocodificar(endereco: GeocodificarEnderecoRequest): Promise<CoordenadasEncontradasDTO> {
    const encontrado = await this.geocodificacao.buscar({
      ...endereco,
      cep: endereco.cep ? (formatarCep(endereco.cep) ?? undefined) : undefined,
    });
    if (!encontrado) throw new EnderecoNaoLocalizadoException();
    return encontrado;
  }
}
