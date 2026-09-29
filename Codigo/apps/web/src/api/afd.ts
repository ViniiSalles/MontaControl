import type { CorpoErroPadrao } from '@montacontrol/shared'
import { ErroApi } from './clienteHttp'

/** Extrai o nome do arquivo de `Content-Disposition: attachment; filename="..."`. */
function nomeDoArquivo(disposicao: string | null): string {
  const casamento = disposicao ? /filename="?([^";]+)"?/.exec(disposicao) : null
  return casamento?.[1] ?? 'afd.txt'
}

/**
 * Baixa o AFD do mês (Portaria 671/2021) e dispara o download no navegador.
 * Não usa `requisitar` (que assume corpo JSON) porque a resposta de sucesso
 * é texto puro (`text/plain; charset=ISO-8859-1`); o erro, sim, é JSON —
 * mesmo formato padrão de todo o resto da API.
 */
export async function baixarAfd(token: string, ano: number, mes: number): Promise<void> {
  const resposta = await fetch(`/api/afd?ano=${ano}&mes=${mes}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => null)) as CorpoErroPadrao | null
    throw new ErroApi(
      corpo?.codigo ?? 'ERRO_DESCONHECIDO',
      corpo?.message ?? 'Não foi possível exportar o AFD. Tente novamente.',
      resposta.status,
    )
  }

  const blob = await resposta.blob()
  const nomeArquivo = nomeDoArquivo(resposta.headers.get('Content-Disposition'))
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = nomeArquivo
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}
