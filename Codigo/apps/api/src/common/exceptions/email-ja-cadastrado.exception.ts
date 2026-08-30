import { ConflictException } from '@nestjs/common';

/** 409 de `POST /usuarios`: e-mail já existe no Supabase Auth ou em `usuario`. */
export class EmailJaCadastradoException extends ConflictException {
  readonly codigo = 'EMAIL_JA_CADASTRADO';

  constructor() {
    super('E-mail já cadastrado');
  }
}
