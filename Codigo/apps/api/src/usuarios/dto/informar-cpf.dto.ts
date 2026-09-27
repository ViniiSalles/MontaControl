import { IsCpf } from '../../common/validators/is-cpf.validator';

export class InformarCpfDto {
  @IsCpf()
  cpf!: string;
}
