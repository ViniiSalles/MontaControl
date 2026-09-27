import type { UsuarioDTO } from '@montacontrol/shared'
import { somenteDigitos } from '@montacontrol/shared'

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** Nome, e-mail ou CPF (comparado só por dígitos, quando o termo os tem). */
export function filtrarMontadores(montadores: UsuarioDTO[], termo: string): UsuarioDTO[] {
  const texto = termo.trim().toLowerCase()
  if (!texto) return montadores
  const digitos = somenteDigitos(texto)
  return montadores.filter(
    (montador) =>
      montador.nome.toLowerCase().includes(texto) ||
      montador.email.toLowerCase().includes(texto) ||
      (digitos.length > 0 && (montador.cpf ?? '').includes(digitos)),
  )
}

export function contarNovosNoMes(montadores: UsuarioDTO[], agora: Date): number {
  return montadores.filter((montador) => {
    if (!montador.criadoEm) return false
    const criado = new Date(montador.criadoEm)
    return criado.getFullYear() === agora.getFullYear() && criado.getMonth() === agora.getMonth()
  }).length
}

export function formatarDataCadastro(iso: string | undefined): string {
  if (!iso) return '—'
  const data = new Date(iso)
  return `${String(data.getDate()).padStart(2, '0')} ${MESES_CURTOS[data.getMonth()]} ${data.getFullYear()}`
}
