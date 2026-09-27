import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { ARQUIVO_INICIO } from './inicio-execucao'

/** Margem que absorve diferença de relógio entre esta máquina e o `createdAt` gravado pelo Postgres. */
const MARGEM_MS = 5_000

/**
 * Remove do banco/Supabase de dev tudo que a execução criou (atestados e jornadas do montador seed
 * e usuários `e2e-montador-*`). Nunca derruba a suíte: qualquer falha vira aviso.
 * Premissa: API e testes rodam na mesma máquina, então 5s de margem bastam.
 */
export default function globalTeardown(): void {
  try {
    if (!existsSync(ARQUIVO_INICIO)) {
      console.warn('[e2e] limpeza ignorada: início da execução não registrado.')
      return
    }
    const inicio = new Date(readFileSync(ARQUIVO_INICIO, 'utf8').trim())
    rmSync(ARQUIVO_INICIO, { force: true })
    if (Number.isNaN(inicio.getTime())) {
      console.warn('[e2e] limpeza ignorada: início da execução inválido.')
      return
    }
    const desde = new Date(inicio.getTime() - MARGEM_MS).toISOString()
    const raizCodigo = resolve(import.meta.dirname, '../../../..')
    const resultado = spawnSync(
      'pnpm',
      ['--filter', '@montacontrol/api', 'e2e:limpar', '--desde', desde],
      { cwd: raizCodigo, encoding: 'utf8' },
    )
    if (resultado.stdout) console.log(resultado.stdout.trim())
    if (resultado.error || resultado.status !== 0) {
      console.warn(
        `[e2e] AVISO: limpeza falhou (${resultado.error?.message ?? `status ${resultado.status}`}). ${resultado.stderr ?? ''}`,
      )
    }
  } catch (erro) {
    console.warn(`[e2e] AVISO: limpeza falhou: ${(erro as Error).message}`)
  }
}
