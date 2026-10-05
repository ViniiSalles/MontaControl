import { Perfil, StatusAvaria } from '@montacontrol/shared'
import type { AvariaDTO } from '@montacontrol/shared'

export const ROTULO_STATUS_AVARIA: Record<StatusAvaria, string> = {
  [StatusAvaria.REPORTADA]: 'Reportada',
  [StatusAvaria.EM_ANALISE]: 'Em análise',
  [StatusAvaria.REPOSICAO_SOLICITADA]: 'Reposição solicitada',
  [StatusAvaria.RESOLVIDA]: 'Resolvida',
}

export const VARIANTE_STATUS_AVARIA = {
  [StatusAvaria.REPORTADA]: 'erro',
  [StatusAvaria.EM_ANALISE]: 'aviso',
  [StatusAvaria.REPOSICAO_SOLICITADA]: 'info',
  [StatusAvaria.RESOLVIDA]: 'sucesso',
} as const

export const ROTULO_ORIGEM: Record<AvariaDTO['registradaPorPerfil'], string> = {
  [Perfil.DEPOSITO]: 'Operador',
  [Perfil.MONTADOR]: 'Montador',
}

export interface AcaoAvaria {
  status: StatusAvaria
  rotulo: string
  exigeParecer: boolean
}

/** Espelha a matriz de transição da API: o fluxo só anda para frente. */
const ACOES_POR_STATUS: Record<StatusAvaria, AcaoAvaria[]> = {
  [StatusAvaria.REPORTADA]: [
    { status: StatusAvaria.EM_ANALISE, rotulo: 'Iniciar análise', exigeParecer: false },
  ],
  [StatusAvaria.EM_ANALISE]: [
    { status: StatusAvaria.REPOSICAO_SOLICITADA, rotulo: 'Solicitar reposição', exigeParecer: true },
    { status: StatusAvaria.RESOLVIDA, rotulo: 'Resolver', exigeParecer: true },
  ],
  [StatusAvaria.REPOSICAO_SOLICITADA]: [
    { status: StatusAvaria.RESOLVIDA, rotulo: 'Marcar resolvida', exigeParecer: true },
  ],
  [StatusAvaria.RESOLVIDA]: [],
}

export function acoesDisponiveis(status: StatusAvaria): AcaoAvaria[] {
  return ACOES_POR_STATUS[status]
}

/** Avarias que ainda pedem ação do gestor. */
export function contarAbertas(avarias: Pick<AvariaDTO, 'status'>[]): number {
  return avarias.filter((avaria) => avaria.status !== StatusAvaria.RESOLVIDA).length
}

export function contarPorStatus(avarias: Pick<AvariaDTO, 'status'>[], status: StatusAvaria): number {
  return avarias.filter((avaria) => avaria.status === status).length
}

export interface FiltroTelaAvarias {
  status: StatusAvaria | ''
  origem: AvariaDTO['registradaPorPerfil'] | ''
  tipoAvariaId: number | null
  /** Busca livre por pedido, peça ou código de barras. */
  busca: string
}

export const FILTRO_VAZIO: FiltroTelaAvarias = { status: '', origem: '', tipoAvariaId: null, busca: '' }

export function filtrarAvarias(avarias: AvariaDTO[], filtro: FiltroTelaAvarias): AvariaDTO[] {
  const termo = filtro.busca.trim().toLowerCase()
  return avarias.filter(
    (avaria) =>
      (!filtro.status || avaria.status === filtro.status) &&
      (!filtro.origem || avaria.registradaPorPerfil === filtro.origem) &&
      (filtro.tipoAvariaId === null || avaria.tipoAvariaId === filtro.tipoAvariaId) &&
      (!termo ||
        avaria.numeroPedido.toLowerCase().includes(termo) ||
        avaria.descricaoPeca.toLowerCase().includes(termo) ||
        (avaria.codigoBarras ?? '').toLowerCase().includes(termo)),
  )
}
