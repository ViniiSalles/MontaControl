import { UnprocessableEntityException } from '@nestjs/common';

/** O serviço de mapas não achou o endereço — o gestor pode informar as coordenadas à mão. */
export class EnderecoNaoLocalizadoException extends UnprocessableEntityException {
  constructor() {
    super('Endereço não localizado no mapa. Confira os dados ou informe latitude e longitude.');
  }
}
