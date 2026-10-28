import { Perfil } from '@montacontrol/shared'
import type {
  AluguelEpiDTO,
  RegistrarAluguelEpiRequest,
  SalvarTipoEpiRequest,
  StatusAluguelEpi,
  TipoEpiDTO,
  UsuarioDTO,
} from '@montacontrol/shared'
import type { VarianteBadge } from '@montacontrol/ui-contracts/badge'

export const ROTULO_STATUS_ALUGUEL: Record<StatusAluguelEpi, string> = {
  RESERVADO: 'Reservado',
  EM_USO: 'Em uso',
  ATRASADO: 'Atrasado',
  DEVOLVIDO: 'Devolvido',
}

export const VARIANTE_STATUS_ALUGUEL: Record<StatusAluguelEpi, VarianteBadge> = {
  RESERVADO: 'info',
  EM_USO: 'aviso',
  ATRASADO: 'erro',
  DEVOLVIDO: 'sucesso',
}

export type FiltroAluguel = 'ABERTOS' | StatusAluguelEpi | 'TODOS'

/** "Abertos" = tudo que ainda não voltou ao almoxarifado. */
export function filtrarAlugueis(alugueis: AluguelEpiDTO[], filtro: FiltroAluguel): AluguelEpiDTO[] {
  if (filtro === 'TODOS') return alugueis
  if (filtro === 'ABERTOS') return alugueis.filter((aluguel) => aluguel.status !== 'DEVOLVIDO')
  return alugueis.filter((aluguel) => aluguel.status === filtro)
}

export function contarPorStatus(alugueis: AluguelEpiDTO[], status: StatusAluguelEpi): number {
  return alugueis.filter((aluguel) => aluguel.status === status).length
}

/** Quem trabalha em campo ou no depósito recebe EPI — só ativos, por nome. */
export function colaboradoresParaEpi(usuarios: UsuarioDTO[]): UsuarioDTO[] {
  return usuarios
    .filter((usuario) => usuario.ativo && (usuario.perfil === Perfil.MONTADOR || usuario.perfil === Perfil.DEPOSITO))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

const doisDigitos = (valor: number) => String(valor).padStart(2, '0')

/** `Date` → valor de `<input type="datetime-local">` no fuso do navegador. */
export function paraDataHoraLocal(data: Date): string {
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}T${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`
}

/** Valor de `<input type="datetime-local">` → instante ISO; `null` se vazio ou inválido. */
export function deDataHoraLocal(texto: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(texto)) return null
  const data = new Date(texto)
  return Number.isNaN(data.getTime()) ? null : data.toISOString()
}

const MINUTO_MS = 60 * 1000

/** Duração legível: `45min`, `5h 20min`, `2d 3h`. */
export function formatarDuracao(ms: number): string {
  const minutos = Math.max(0, Math.round(ms / MINUTO_MS))
  const dias = Math.floor(minutos / (24 * 60))
  const horas = Math.floor((minutos % (24 * 60)) / 60)
  const resto = minutos % 60
  if (dias > 0) return horas > 0 ? `${dias}d ${horas}h` : `${dias}d`
  if (horas > 0) return resto > 0 ? `${horas}h ${resto}min` : `${horas}h`
  return `${resto}min`
}

/** Tempo reservado: do início à devolução prevista. */
export function tempoReservado(aluguel: AluguelEpiDTO): string {
  return formatarDuracao(Date.parse(aluguel.fimPrevisto) - Date.parse(aluguel.inicio))
}

/** Tempo com o colaborador: até a devolução, ou até agora se ainda está fora. `null` antes de começar. */
export function tempoEmUso(aluguel: AluguelEpiDTO, agora: Date): string | null {
  if (aluguel.status === 'RESERVADO') return null
  const fim = aluguel.devolvidoEm ? Date.parse(aluguel.devolvidoEm) : agora.getTime()
  return formatarDuracao(fim - Date.parse(aluguel.inicio))
}

/** Quanto passou da devolução prevista — atrasado agora ou devolvido com atraso. `null` se no prazo. */
export function tempoDeAtraso(aluguel: AluguelEpiDTO, agora: Date): string | null {
  const fim = aluguel.devolvidoEm ? Date.parse(aluguel.devolvidoEm) : agora.getTime()
  const atraso = fim - Date.parse(aluguel.fimPrevisto)
  return atraso >= MINUTO_MS ? formatarDuracao(atraso) : null
}

export interface RascunhoAluguel {
  tipoEpiId: string
  usuarioId: string
  quantidade: string
  inicio: string
  fimPrevisto: string
  observacao: string
}

export type ErrosAluguel = Partial<Record<keyof RascunhoAluguel, string>>

/** Começa agora, devolução prevista no fim do dia — o caso comum (EPI para a obra do dia). */
export function rascunhoAluguelInicial(agora: Date): RascunhoAluguel {
  const fimDoDia = new Date(agora)
  fimDoDia.setHours(18, 0, 0, 0)
  if (fimDoDia <= agora) fimDoDia.setDate(fimDoDia.getDate() + 1)
  return {
    tipoEpiId: '',
    usuarioId: '',
    quantidade: '1',
    inicio: paraDataHoraLocal(agora),
    fimPrevisto: paraDataHoraLocal(fimDoDia),
    observacao: '',
  }
}

export function validarRascunhoAluguel(
  rascunho: RascunhoAluguel,
  tipos: TipoEpiDTO[],
): { erros: ErrosAluguel; dados: RegistrarAluguelEpiRequest | null } {
  const erros: ErrosAluguel = {}
  const tipo = tipos.find((item) => String(item.id) === rascunho.tipoEpiId)
  if (!tipo) erros.tipoEpiId = 'Selecione o EPI.'
  if (!rascunho.usuarioId) erros.usuarioId = 'Selecione o colaborador.'

  const quantidade = Number(rascunho.quantidade)
  if (!Number.isInteger(quantidade) || quantidade < 1) erros.quantidade = 'Informe uma quantidade inteira a partir de 1.'
  else if (tipo && quantidade > tipo.estoque) erros.quantidade = `O estoque desse EPI é de ${tipo.estoque} unidade(s).`

  const inicio = deDataHoraLocal(rascunho.inicio)
  const fimPrevisto = deDataHoraLocal(rascunho.fimPrevisto)
  if (!inicio) erros.inicio = 'Informe o início da reserva.'
  if (!fimPrevisto) erros.fimPrevisto = 'Informe a devolução prevista.'
  else if (inicio && Date.parse(fimPrevisto) <= Date.parse(inicio)) {
    erros.fimPrevisto = 'A devolução prevista deve ser depois do início.'
  }

  if (Object.keys(erros).length > 0 || !inicio || !fimPrevisto) return { erros, dados: null }
  const observacao = rascunho.observacao.trim()
  return {
    erros,
    dados: {
      tipoEpiId: Number(rascunho.tipoEpiId),
      usuarioId: Number(rascunho.usuarioId),
      quantidade,
      inicio,
      fimPrevisto,
      ...(observacao ? { observacao } : {}),
    },
  }
}

export interface RascunhoTipoEpi {
  nome: string
  descricao: string
  validadeMeses: string
  estoque: string
}

export type ErrosTipoEpi = Partial<Record<keyof RascunhoTipoEpi, string>>

export const RASCUNHO_TIPO_EPI_VAZIO: RascunhoTipoEpi = { nome: '', descricao: '', validadeMeses: '12', estoque: '0' }

export function rascunhoTipoEpiDe(tipo: TipoEpiDTO): RascunhoTipoEpi {
  return { nome: tipo.nome, descricao: tipo.descricao, validadeMeses: String(tipo.validadeMeses), estoque: String(tipo.estoque) }
}

export function validarRascunhoTipoEpi(
  rascunho: RascunhoTipoEpi,
  emUso: number,
): { erros: ErrosTipoEpi; dados: SalvarTipoEpiRequest | null } {
  const erros: ErrosTipoEpi = {}
  const nome = rascunho.nome.trim()
  if (nome.length < 2) erros.nome = 'Informe o nome do EPI.'
  const validadeMeses = Number(rascunho.validadeMeses)
  if (!Number.isInteger(validadeMeses) || validadeMeses < 1 || validadeMeses > 120) {
    erros.validadeMeses = 'Informe a validade em meses (1 a 120).'
  }
  const estoque = Number(rascunho.estoque)
  if (rascunho.estoque.trim() === '' || !Number.isInteger(estoque) || estoque < 0) erros.estoque = 'Informe um estoque inteiro (0 ou mais).'
  else if (estoque < emUso) erros.estoque = `Há ${emUso} unidade(s) alugada(s) agora; o estoque não pode ser menor.`

  if (Object.keys(erros).length > 0) return { erros, dados: null }
  return { erros, dados: { nome, descricao: rascunho.descricao.trim(), validadeMeses, estoque } }
}
