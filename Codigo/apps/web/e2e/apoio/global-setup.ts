import { writeFileSync } from 'node:fs'
import { ARQUIVO_INICIO } from './inicio-execucao'

/** Registra o instante de início da execução, ANTES de qualquer teste, para a limpeza do teardown. */
export default function globalSetup(): void {
  writeFileSync(ARQUIVO_INICIO, new Date().toISOString(), 'utf8')
}
