import { UFS, formatarCep } from '@montacontrol/shared'
import type { ClienteDTO, SalvarClienteRequest } from '@montacontrol/shared'

/** Formulário cru: coordenadas como texto, aceitando vírgula decimal. */
export interface RascunhoCliente {
  nome: string
  cep: string
  endereco: string
  cidade: string
  estado: string
  telefone: string
  latitude: string
  longitude: string
}

export const RASCUNHO_VAZIO: RascunhoCliente = {
  nome: '',
  cep: '',
  endereco: '',
  cidade: '',
  estado: '',
  telefone: '',
  latitude: '',
  longitude: '',
}

export function mascararCep(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 8)
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos
}

/** `(31) 3333-4444` ou `(31) 99999-8888`, conforme a quantidade de dígitos. */
export function mascararTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 11)
  if (digitos.length <= 2) return digitos
  const ddd = `(${digitos.slice(0, 2)}) `
  const resto = digitos.slice(2)
  const corte = resto.length > 8 ? 5 : 4
  return resto.length > corte ? `${ddd}${resto.slice(0, corte)}-${resto.slice(corte)}` : `${ddd}${resto}`
}

export function rascunhoDe(cliente: ClienteDTO): RascunhoCliente {
  return {
    nome: cliente.nome,
    cep: cliente.cep,
    endereco: cliente.endereco,
    cidade: cliente.cidade,
    estado: cliente.estado,
    telefone: mascararTelefone(cliente.telefone),
    latitude: String(cliente.latitude),
    longitude: String(cliente.longitude),
  }
}

function paraNumero(texto: string): number | null {
  const valor = Number(texto.trim().replace(',', '.'))
  return texto.trim() === '' || Number.isNaN(valor) ? null : valor
}

export type ErrosCliente = Partial<Record<keyof RascunhoCliente, string>>

export interface ResultadoValidacaoCliente {
  erros: ErrosCliente
  dados: SalvarClienteRequest | null
}

/** Mesmas regras do DTO da API, com mensagens para a tela. */
export function validarRascunhoCliente(rascunho: RascunhoCliente): ResultadoValidacaoCliente {
  const erros: ErrosCliente = {}
  if (rascunho.nome.trim().length < 2) erros.nome = 'Informe o nome do cliente.'
  const cep = formatarCep(rascunho.cep)
  if (!cep) erros.cep = 'CEP deve ter 8 dígitos.'
  if (rascunho.endereco.trim().length < 3) erros.endereco = 'Informe o endereço.'
  if (rascunho.cidade.trim().length < 2) erros.cidade = 'Informe a cidade.'
  if (!(UFS as readonly string[]).includes(rascunho.estado)) erros.estado = 'Selecione a UF.'
  const telefone = rascunho.telefone.replace(/\D/g, '')
  if (telefone.length < 10) erros.telefone = 'Telefone com DDD.'

  const latitude = paraNumero(rascunho.latitude)
  const longitude = paraNumero(rascunho.longitude)
  if (latitude === null || latitude < -90 || latitude > 90) erros.latitude = 'Latitude inválida.'
  if (longitude === null || longitude < -180 || longitude > 180) erros.longitude = 'Longitude inválida.'

  if (Object.keys(erros).length > 0 || !cep || latitude === null || longitude === null) {
    return { erros, dados: null }
  }
  return {
    erros,
    dados: {
      nome: rascunho.nome.trim(),
      cep,
      endereco: rascunho.endereco.trim(),
      cidade: rascunho.cidade.trim(),
      estado: rascunho.estado,
      telefone,
      latitude,
      longitude,
    },
  }
}

/** Link para o gestor conferir o ponto no mapa antes de salvar. */
export function linkMapa(latitude: string, longitude: string): string | null {
  const lat = paraNumero(latitude)
  const lon = paraNumero(longitude)
  if (lat === null || lon === null) return null
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`
}
