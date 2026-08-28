/** Ver `login_montacontrol:135-138` — "Manter conectado" no Login. */
export interface PropsCheckbox {
  rotulo: string;
  marcado: boolean;
  aoAlterar: (marcado: boolean) => void;
  desabilitado?: boolean;
}
