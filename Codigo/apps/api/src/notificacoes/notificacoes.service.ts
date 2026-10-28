import { Injectable, Logger } from '@nestjs/common';
import type {
  ListaNotificacoesDTO,
  ReferenciaNotificacao,
  TipoNotificacao,
} from '@montacontrol/shared';
import type { Perfil } from '../../generated/prisma';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { NotificacaoNaoEncontradaException } from './exceptions/notificacao-nao-encontrada.exception';
import { EmissorNotificacao } from './notificacoes.emissor';
import { NotificacoesRepository } from './notificacoes.repository';

export interface EntradaNotificacao {
  perfis?: Perfil[];
  usuarioIds?: number[];
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  referencia?: { tipo: ReferenciaNotificacao; id: number };
  chaveOrigem: string;
}

@Injectable()
export class NotificacoesService {
  private readonly logger = new Logger(NotificacoesService.name);

  constructor(
    private readonly repositorio: NotificacoesRepository,
    private readonly usuarios: UsuariosRepository,
    private readonly emissor: EmissorNotificacao,
  ) {}

  /**
   * Grava e empurra a notificação para cada destinatário. Nunca lança: a
   * operação de negócio que a originou não pode falhar por causa do aviso.
   * Idempotência por `chaveOrigem` fica no banco — só o que foi realmente
   * criado é emitido.
   */
  async notificar(entrada: EntradaNotificacao): Promise<void> {
    try {
      const idsDosPerfis = entrada.perfis?.length
        ? await this.usuarios.listarIdsAtivosPorPerfil(entrada.perfis)
        : [];
      const destinatarios = [...new Set([...(entrada.usuarioIds ?? []), ...idsDosPerfis])];
      if (destinatarios.length === 0) return;

      const criadas = await this.repositorio.criarVarias(
        destinatarios.map((usuarioId) => ({
          usuarioId,
          tipo: entrada.tipo,
          titulo: entrada.titulo,
          mensagem: entrada.mensagem,
          referenciaTipo: entrada.referencia?.tipo,
          referenciaId: entrada.referencia?.id,
          chaveOrigem: entrada.chaveOrigem,
        })),
      );
      for (const { usuarioId, notificacao } of criadas) {
        this.emissor.emitirParaUsuario(usuarioId, notificacao);
      }
    } catch (erro) {
      this.logger.error(
        `Falha ao notificar (${entrada.chaveOrigem})`,
        erro instanceof Error ? erro.stack : String(erro),
      );
    }
  }

  async listar(usuarioId: number, limite: number, antesDe?: number): Promise<ListaNotificacoesDTO> {
    const [itens, naoLidas] = await Promise.all([
      this.repositorio.listarDoUsuario(usuarioId, limite, antesDe),
      this.repositorio.contarNaoLidas(usuarioId),
    ]);
    const proximoCursor = itens.length === limite ? itens[itens.length - 1].id : null;
    return { itens, naoLidas, proximoCursor };
  }

  async marcarLida(id: number, usuarioId: number): Promise<void> {
    const marcada = await this.repositorio.marcarLida(id, usuarioId);
    if (!marcada) throw new NotificacaoNaoEncontradaException();
  }

  async marcarTodasLidas(usuarioId: number): Promise<void> {
    await this.repositorio.marcarTodasLidas(usuarioId);
  }
}
