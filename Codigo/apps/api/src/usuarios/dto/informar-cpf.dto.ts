import { InformarCpfRequest } from '@montacontrol/shared';
import { IsCpf } from '../../common/validators/is-cpf.validator';

export class InformarCpfDto implements InformarCpfRequest {
  @IsCpf()
  cpf!: string;
}
