import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Perfil, TIPOS_NOTIFICACAO } from '@montacontrol/shared'
import type { NotificacaoDTO } from '@montacontrol/shared'
import { ICONE_NOTIFICACAO, rotaDaNotificacao, TOM_NOTIFICACAO } from '../notificacoes.ts'

function notificacao(tipo: NotificacaoDTO['tipo']): NotificacaoDTO {
  return {
    id: 1,
    tipo,
    titulo: 'Título',
    mensagem: 'Mensagem',
    referenciaTipo: null,
    referenciaId: null,
    lida: false,
    criadaEm: '2026-10-27T12:00:00.000Z',
  }
}

test('rotaDaNotificacao devolve null para atestado enviado no GESTOR e /atestados para RH', () => {
  const n = notificacao('ATESTADO_ENVIADO')
  assert.equal(rotaDaNotificacao(n, Perfil.GESTOR), null)
  assert.equal(rotaDaNotificacao(n, Perfil.RH), '/atestados')
})

test('rotaDaNotificacao leva avaria reportada e peça inconsistente ao GESTOR', () => {
  assert.equal(rotaDaNotificacao(notificacao('AVARIA_REPORTADA'), Perfil.GESTOR), '/avarias')
  assert.equal(rotaDaNotificacao(notificacao('PECA_INCONSISTENTE'), Perfil.GESTOR), '/dashboard')
})

test('rotaDaNotificacao leva ponto em atraso solicitado ao banco de horas do RH', () => {
  const n = notificacao('PONTO_ATRASO_SOLICITADO')
  assert.equal(rotaDaNotificacao(n, Perfil.RH), '/banco-horas')
  assert.equal(rotaDaNotificacao(n, Perfil.GESTOR), null)
})

test('rotaDaNotificacao não oferece destino ao DEPOSITO nem para tipos de montador', () => {
  for (const tipo of TIPOS_NOTIFICACAO) {
    assert.equal(rotaDaNotificacao(notificacao(tipo), Perfil.DEPOSITO), null, tipo)
  }
  for (const tipo of [
    'ATESTADO_VALIDADO',
    'ATESTADO_REJEITADO',
    'PONTO_ATRASO_APROVADO',
    'PONTO_ATRASO_REJEITADO',
    'AVARIA_ATUALIZADA',
  ] as const) {
    assert.equal(rotaDaNotificacao(notificacao(tipo), Perfil.GESTOR), null, tipo)
    assert.equal(rotaDaNotificacao(notificacao(tipo), Perfil.RH), null, tipo)
  }
})

test('todo TipoNotificacao tem ícone e tom', () => {
  for (const tipo of TIPOS_NOTIFICACAO) {
    assert.ok(ICONE_NOTIFICACAO[tipo], `ícone de ${tipo}`)
    assert.ok(TOM_NOTIFICACAO[tipo], `tom de ${tipo}`)
  }
})
