/**
 * Mapa estático da posição de um registro de ponto. Contrato só de props: o
 * componente Web (se existir um dia) e o Mobile não compartilham
 * implementação, apenas a forma dos dados.
 */
export interface PropsMapaLocalizacao {
  latitude: number;
  longitude: number;
  /** Endereço já resolvido; `null` mostra "endereço indisponível". */
  endereco?: string | null;
  /** Padrão 16. */
  zoom?: number;
  /** Altura do mapa em px. Padrão 180. */
  altura?: number;
  /**
   * Padrão `false`. Um mapa que aceita arrasto dentro de uma tela rolável
   * captura o gesto e trava a rolagem — só liga quando o mapa ocupa a tela.
   */
  interativo?: boolean;
}
