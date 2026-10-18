export interface AtestadosRecentes<T> {
  visiveis: T[];
  ocultos: number;
}

/** Mais recentes primeiro (`criadoEm` desc, empate por `chave` desc); limita a `limite` salvo `mostrarTodos`. */
export function atestadosRecentes<T extends { criadoEm: string; chave: string }>(
  atestados: readonly T[],
  limite: number,
  mostrarTodos: boolean,
): AtestadosRecentes<T> {
  const ordenados = [...atestados].sort((a, b) => {
    if (a.criadoEm !== b.criadoEm) return a.criadoEm < b.criadoEm ? 1 : -1;
    return a.chave < b.chave ? 1 : a.chave > b.chave ? -1 : 0;
  });
  if (mostrarTodos || ordenados.length <= limite) return { visiveis: ordenados, ocultos: 0 };
  return { visiveis: ordenados.slice(0, limite), ocultos: ordenados.length - limite };
}
