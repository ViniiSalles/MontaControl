export interface EnderecoViaCep {
  logradouro: string
  bairro: string
  cidade: string
  estado: string
}

interface RespostaViaCep {
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean | string
}

/**
 * Autopreenchimento do endereço pelo CEP (ViaCEP, público e sem chave). É só
 * conveniência: `null` em qualquer falha e o gestor digita à mão.
 */
export async function buscarEnderecoPorCep(cep: string): Promise<EnderecoViaCep | null> {
  const digitos = cep.replace(/\D/g, '')
  if (digitos.length !== 8) return null
  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!resposta.ok) return null
    const corpo = (await resposta.json()) as RespostaViaCep
    if (corpo.erro) return null
    return {
      logradouro: corpo.logradouro ?? '',
      bairro: corpo.bairro ?? '',
      cidade: corpo.localidade ?? '',
      estado: corpo.uf ?? '',
    }
  } catch {
    return null
  }
}
