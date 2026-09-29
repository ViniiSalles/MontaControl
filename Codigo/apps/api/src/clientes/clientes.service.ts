import { Injectable } from '@nestjs/common';
import type { ClienteResumoDTO } from '@montacontrol/shared';
import { ClientesRepository } from './clientes.repository';

@Injectable()
export class ClientesService {
  constructor(private readonly clientes: ClientesRepository) {}

  async listar(busca?: string): Promise<ClienteResumoDTO[]> {
    return this.clientes.listar(busca);
  }
}
