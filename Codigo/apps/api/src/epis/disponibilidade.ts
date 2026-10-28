/** Aluguel que pode ocupar unidades do estoque — só as datas e a quantidade importam. */
export interface Ocupacao {
  inicio: Date;
  fimPrevisto: Date;
  devolvidoEm: Date | null;
  quantidade: number;
}

/**
 * Até quando o aluguel segura as unidades. Devolvido: até a devolução.
 * Atrasado: não se sabe quando volta, então segura indefinidamente — o
 * gestor não pode alugar uma unidade que ainda não voltou.
 */
function fimDaOcupacao(ocupacao: Ocupacao, agora: Date): number {
  if (ocupacao.devolvidoEm) return ocupacao.devolvidoEm.getTime();
  if (ocupacao.fimPrevisto < agora) return Number.POSITIVE_INFINITY;
  return ocupacao.fimPrevisto.getTime();
}

/**
 * Maior quantidade de unidades ocupadas ao mesmo tempo dentro de
 * `[inicio, fim)`. Somar tudo que encosta no período bloquearia reservas
 * legítimas (dois aluguéis em sequência dentro de uma janela longa usam a
 * mesma unidade), então varre os eventos de saída/volta e guarda o pico.
 */
export function picoDeUso(ocupacoes: Ocupacao[], inicio: Date, fim: Date, agora: Date): number {
  const eventos: Array<{ instante: number; delta: number }> = [];
  for (const ocupacao of ocupacoes) {
    const sai = Math.max(ocupacao.inicio.getTime(), inicio.getTime());
    const volta = Math.min(fimDaOcupacao(ocupacao, agora), fim.getTime());
    if (sai >= volta) continue;
    eventos.push({ instante: sai, delta: ocupacao.quantidade }, { instante: volta, delta: -ocupacao.quantidade });
  }
  // No mesmo instante, a volta vem antes da saída: a unidade devolvida às 10h
  // pode sair de novo às 10h.
  eventos.sort((a, b) => a.instante - b.instante || a.delta - b.delta);

  let emUso = 0;
  let pico = 0;
  for (const evento of eventos) {
    emUso += evento.delta;
    pico = Math.max(pico, emUso);
  }
  return pico;
}

/** Unidades fora do almoxarifado neste instante (em uso ou atrasadas). */
export function unidadesEmUso(ocupacoes: Ocupacao[], agora: Date): number {
  return ocupacoes
    .filter((ocupacao) => !ocupacao.devolvidoEm && ocupacao.inicio <= agora)
    .reduce((total, ocupacao) => total + ocupacao.quantidade, 0);
}
