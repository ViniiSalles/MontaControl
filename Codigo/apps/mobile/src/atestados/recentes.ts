import type { AtestadoDTO } from '@montacontrol/shared';

export interface AtestadosRecentes {
  visiveis: AtestadoDTO[];
  ocultos: number;
}

/** Mais recentes primeiro (`criadoEm` desc, empate por `id` desc); limita a `limite` salvo `mostrarTodos`. */
export function atestadosRecentes(
  atestados: AtestadoDTO[],
  limite: number,
  mostrarTodos: boolean,
): AtestadosRecentes {
  const ordenados = [...atestados].sort((a, b) => {
    if (a.criadoEm !== b.criadoEm) return a.criadoEm < b.criadoEm ? 1 : -1;
    return b.id - a.id;
  });
  if (mostrarTodos || ordenados.length <= limite) return { visiveis: ordenados, ocultos: 0 };
  return { visiveis: ordenados.slice(0, limite), ocultos: ordenados.length - limite };
}
