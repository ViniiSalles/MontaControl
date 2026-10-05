import type {
  ClienteDTO,
  ClienteResumoDTO,
  CoordenadasEncontradasDTO,
  GeocodificarEnderecoRequest,
  SalvarClienteRequest,
} from '@montacontrol/shared'
import { requisitar } from './clienteHttp'

export function listarClientes(token: string, busca?: string): Promise<ClienteResumoDTO[]> {
  const parametros = busca ? `?busca=${encodeURIComponent(busca)}` : ''
  return requisitar<ClienteResumoDTO[]>(`/api/clientes${parametros}`, { token })
}

export function detalharCliente(token: string, id: number): Promise<ClienteDTO> {
  return requisitar<ClienteDTO>(`/api/clientes/${id}`, { token })
}

export function criarCliente(token: string, dados: SalvarClienteRequest): Promise<ClienteDTO> {
  return requisitar<ClienteDTO>('/api/clientes', { token, metodo: 'POST', corpo: dados })
}

export function atualizarCliente(token: string, id: number, dados: SalvarClienteRequest): Promise<ClienteDTO> {
  return requisitar<ClienteDTO>(`/api/clientes/${id}`, { token, metodo: 'PUT', corpo: dados })
}

/** Sugere coordenadas para o endereço (Nominatim, via API). */
export function geocodificarEndereco(
  token: string,
  endereco: GeocodificarEnderecoRequest,
): Promise<CoordenadasEncontradasDTO> {
  return requisitar<CoordenadasEncontradasDTO>('/api/clientes/geocodificar', {
    token,
    metodo: 'POST',
    corpo: endereco,
  })
}
