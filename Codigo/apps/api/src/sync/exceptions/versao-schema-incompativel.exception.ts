import { HttpException } from '@nestjs/common';

/** `HttpStatus` do Nest não traz o 426 (Upgrade Required). */
const STATUS_UPGRADE_REQUIRED = 426;

/**
 * 426: o `schemaVersion` do app não é o do contrato que esta API serve. O app
 * precisa ser atualizado; repetir o pull não resolve.
 */
export class VersaoSchemaIncompativelException extends HttpException {
  readonly codigo = 'VERSAO_SCHEMA_INCOMPATIVEL';

  constructor(versaoRecebida: number, versaoSuportada: number) {
    super(
      `Versão do contrato de sincronização incompatível (recebida ${versaoRecebida}, suportada ${versaoSuportada}). Atualize o aplicativo.`,
      STATUS_UPGRADE_REQUIRED,
    );
  }
}
