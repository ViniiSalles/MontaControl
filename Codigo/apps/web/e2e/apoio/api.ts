import type { APIRequestContext } from '@playwright/test'

export const SENHA_SEED = 'MontaControl@Seed1'
export const USUARIOS_SEED = {
  rh: 'rh@montacontrol.local',
  montador: 'montador@montacontrol.local',
}

const UM_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

export async function autenticar(request: APIRequestContext, email: string): Promise<string> {
  const resposta = await request.post('/api/auth/login', {
    data: { email, senha: SENHA_SEED },
  })
  const corpo = (await resposta.json()) as { accessToken: string }
  return corpo.accessToken
}

/** Cria um atestado PENDENTE do montador seed e devolve o id. */
export async function criarAtestadoPendente(
  request: APIRequestContext,
  token: string,
  dia: string,
  observacao?: string,
): Promise<number> {
  const resposta = await request.post('/api/atestados', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      idCliente: crypto.randomUUID(),
      dataInicio: dia,
      dataFim: dia,
      fotos: [{ conteudoBase64: UM_PIXEL_PNG_BASE64, mimeType: 'image/png' }],
      ...(observacao && { observacao }),
    },
  })
  const corpo = (await resposta.json()) as { id: number }
  return corpo.id
}

/** Bate um turno fechado hoje para o montador seed — insumo do espelho de ponto. */
export async function baterPontoDeHoje(
  request: APIRequestContext,
  token: string,
): Promise<void> {
  const agora = new Date()
  const entrada = new Date(agora.getTime() - 60 * 60_000).toISOString()

  await request.post('/api/jornadas/checkin', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      idCliente: crypto.randomUUID(),
      latitude: -19.9227,
      longitude: -43.9451,
      registradoEm: entrada,
      endereco: 'Rua de teste, 100',
    },
  })
  await request.post('/api/jornadas/checkout', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      idCliente: crypto.randomUUID(),
      latitude: -19.9227,
      longitude: -43.9451,
      registradoEm: agora.toISOString(),
      endereco: 'Rua de teste, 100',
    },
  })
}

export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function entrarComoRh(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill(USUARIOS_SEED.rh)
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(SENHA_SEED)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(/\/atestados$/)
}

/** CPF válido e aleatório (único por execução, na prática). */
export function gerarCpfValido(): string {
  const digitos = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  const verificador = (base: number[]) => {
    const soma = base.reduce((acc, d, i) => acc + d * (base.length + 1 - i), 0)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  digitos.push(verificador(digitos))
  digitos.push(verificador(digitos))
  return digitos.join('')
}
