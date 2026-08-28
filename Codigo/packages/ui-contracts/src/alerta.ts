/**
 * Ver plano §"Fluxos de aceite": `erro` (senha incorreta — N1T2, distinto de
 * offline), `aviso` (sessão expirada — TI02; login de perfil não-Montador
 * negado, app exclusivo), `info`/`sucesso` para os demais casos.
 */
export type VarianteAlerta = 'sucesso' | 'aviso' | 'erro' | 'info';

export interface PropsAlerta {
  variante: VarianteAlerta;
  mensagem: string;
  titulo?: string;
}
