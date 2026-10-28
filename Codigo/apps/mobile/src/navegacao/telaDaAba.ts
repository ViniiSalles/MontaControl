/** Props que a casca das abas (`AppAutenticado`) passa a toda tela de aba. */
export interface PropsTelaDaAba {
  /** Leva à aba Jornada — onde se escolhe a obra e se bate o ponto. */
  aoIrParaJornada: () => void;
  /** Abre a tela de notificações (o sino do cabeçalho). */
  aoAbrirNotificacoes: () => void;
}
