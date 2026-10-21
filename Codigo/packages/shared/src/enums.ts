/**
 * Enumerados do domínio MontaControl.
 * Fonte: Glossário (Seção 5) e DER do Documento de Projeto v1.7.
 */

export enum Perfil {
  GESTOR = 'GESTOR',
  RH = 'RH',
  MONTADOR = 'MONTADOR',
  DEPOSITO = 'DEPOSITO',
}

export enum StatusPedido {
  AGUARDANDO = 'AGUARDANDO',
  EM_TRIAGEM = 'EM_TRIAGEM',
  RECEBIDO = 'RECEBIDO',
  EM_ENTREGA = 'EM_ENTREGA',
  ENTREGUE = 'ENTREGUE',
}

export enum StatusAmbiente {
  PENDENTE = 'PENDENTE',
  EM_PROGRESSO = 'EM_PROGRESSO',
  COMPLETO = 'COMPLETO',
}

export enum StatusPeca {
  /** Cadastrada pelo gestor, ainda sem código de barras — aguarda a triagem. */
  PENDENTE = 'PENDENTE',
  TRIADA = 'TRIADA',
  CARREGADA = 'CARREGADA',
  /** Bipada pelo montador no descarregamento, no pedido certo (US02/UC03). */
  DESCARREGADA = 'DESCARREGADA',
  /** Bipada no descarregamento de outro pedido — peça no caminhão errado (US02/UC04). */
  INCONSISTENTE = 'INCONSISTENTE',
  ENTREGUE = 'ENTREGUE',
}

export enum StatusAvaria {
  REPORTADA = 'REPORTADA',
  EM_ANALISE = 'EM_ANALISE',
  REPOSICAO_SOLICITADA = 'REPOSICAO_SOLICITADA',
  RESOLVIDA = 'RESOLVIDA',
}

export enum StatusJornada {
  EM_ANDAMENTO = 'EM_ANDAMENTO',
  PAUSADA = 'PAUSADA',
  FINALIZADA = 'FINALIZADA',
}

export enum StatusAtestado {
  PENDENTE = 'PENDENTE',
  VALIDADO = 'VALIDADO',
  REJEITADO = 'REJEITADO',
}

/**
 * Status de uma operação na fila de sincronização offline-first (outbox) do
 * app mobile. Substitui o antigo campo booleano `enviado`, que tornava uma
 * recusa 4xx indistinguível de um envio aceito (ver Sprint 1, catálogo de
 * bugs do protótipo).
 */
export enum StatusOutbox {
  PENDENTE = 'PENDENTE',
  ENVIANDO = 'ENVIANDO',
  ENVIADO = 'ENVIADO',
  DESCARTADO = 'DESCARTADO',
}

/** Tipo de operação enfileirada na outbox do WatermelonDB. */
export enum TipoOperacaoOutbox {
  CHECKIN = 'CHECKIN',
  CHECKOUT = 'CHECKOUT',
  BIPAGEM = 'BIPAGEM',
  AVARIA = 'AVARIA',
  /** Lançamento de ponto em atraso — também é feito offline, então também enfileira. */
  SOLICITACAO_PONTO = 'SOLICITACAO_PONTO',
}

/** Ciclo de vida de um lançamento de ponto em atraso (Sprint 2). */
export enum StatusSolicitacaoPonto {
  PENDENTE = 'PENDENTE',
  APROVADA = 'APROVADA',
  REJEITADA = 'REJEITADA',
}
