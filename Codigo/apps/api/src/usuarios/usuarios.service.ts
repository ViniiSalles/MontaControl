import { Injectable } from '@nestjs/common';
import { UsuariosRepository } from './usuarios.repository';
import { UsuarioListado } from './usuario-listado';

/**
 * Escopo travado à Sprint 1: só leitura. Criar/atualizar/desativar usuário
 * é escopo de outra sprint — ver plano, risco R15 (scope creep).
 */
@Injectable()
export class UsuariosService {
  constructor(private readonly usuarios: UsuariosRepository) {}

  async listar(): Promise<UsuarioListado[]> {
    return this.usuarios.listar();
  }
}
