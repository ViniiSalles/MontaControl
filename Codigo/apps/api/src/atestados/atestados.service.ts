import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  AtestadoDTO,
  AtestadoDetalhadoDTO,
  EnviarAtestadoRequest,
  FotoBase64,
} from '@montacontrol/shared';
import { diaNoFuso, somarDias } from '@montacontrol/shared';
import { Perfil, StatusAtestado } from '../../generated/prisma';
import { FUSO_OPERACAO } from '../common/fuso';
import { notificarSemFalhar } from '../notificacoes/notificar-sem-falhar';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { SupabaseStorageGateway } from '../supabase/supabase-storage.gateway';
import { AtestadosRepository, FotoArmazenada } from './atestados.repository';
import { AtestadoJaAnalisadoException } from './exceptions/atestado-ja-analisado.exception';
import { AtestadoNaoEncontradoException } from './exceptions/atestado-nao-encontrado.exception';
import { FotoInvalidaException } from './exceptions/foto-invalida.exception';
import { PeriodoAtestadoInvalidoException } from './exceptions/periodo-atestado-invalido.exception';

const TAMANHO_MAXIMO_FOTO_BYTES = 5 * 1024 * 1024;
const VALIDADE_URL_ASSINADA_SEGUNDOS = 300;
const EXTENSAO_POR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/** `2026-09-01` -> `01/09/2026`, para o texto da notificação. */
function formatarDia(dia: string): string {
  return dia.split('-').reverse().join('/');
}

@Injectable()
export class AtestadosService {
  private readonly logger = new Logger(AtestadosService.name);

  constructor(
    private readonly atestados: AtestadosRepository,
    private readonly storage: SupabaseStorageGateway,
    private readonly notificacoes: NotificacoesService,
  ) {}

  /**
   * Ordem deliberada: valida tudo, sobe as fotos, só então grava. Uma linha
   * em `atestado` sem foto no bucket é um atestado que o RH nunca consegue
   * analisar — pior que nenhum atestado.
   */
  async enviar(usuarioId: number, dados: EnviarAtestadoRequest): Promise<AtestadoDTO> {
    const jaCriado = await this.atestados.buscarPorIdCliente(dados.idCliente);
    if (jaCriado) return jaCriado;

    this.validarPeriodo(dados.dataInicio, dados.dataFim);
    if (dados.fotos.length === 0) throw new FotoInvalidaException('nenhuma foto enviada');

    const enviadas: FotoArmazenada[] = [];
    for (const foto of dados.fotos) {
      enviadas.push(await this.subirFoto(usuarioId, foto, enviadas));
    }

    const criado = await this.atestados.criar({
      usuarioId,
      idCliente: dados.idCliente,
      dataInicio: dados.dataInicio,
      dataFim: dados.dataFim,
      observacao: dados.observacao?.trim() || null,
      fotos: enviadas,
    });

    await notificarSemFalhar(
      this.notificacoes,
      {
        perfis: [Perfil.RH],
        tipo: 'ATESTADO_ENVIADO',
        titulo: 'Atestado recebido',
        mensagem: `${criado.usuarioNome} enviou um atestado de ${formatarDia(criado.dataInicio)} a ${formatarDia(criado.dataFim)}.`,
        referencia: { tipo: 'ATESTADO', id: criado.id },
        chaveOrigem: `atestado:${criado.id}:enviado`,
      },
      this.logger,
    );
    return criado;
  }

  async listarPendentes(): Promise<AtestadoDTO[]> {
    return this.atestados.listarPorStatus(StatusAtestado.PENDENTE);
  }

  async listarHistorico(): Promise<AtestadoDTO[]> {
    return this.atestados.listarAnalisados();
  }

  async listarDoUsuario(usuarioId: number): Promise<AtestadoDTO[]> {
    return this.atestados.listarPorUsuario(usuarioId);
  }

  /** Detalhe do RH: o caminho do bucket vira URL assinada e não vaza no corpo. */
  async detalhar(id: number): Promise<AtestadoDetalhadoDTO> {
    const atestado = await this.atestados.buscarPorId(id);
    if (!atestado) throw new AtestadoNaoEncontradoException();

    const expiraEm = new Date(
      Date.now() + VALIDADE_URL_ASSINADA_SEGUNDOS * 1000,
    ).toISOString();

    const fotos = [];
    for (const foto of atestado.fotos) {
      const url = await this.storage.gerarUrlAssinada(
        foto.storagePath,
        VALIDADE_URL_ASSINADA_SEGUNDOS,
      );
      if (!url) throw new BadGatewayException('Não foi possível abrir a foto do atestado');
      fotos.push({ id: foto.id, url, expiraEm });
    }

    return { ...atestado, fotos };
  }

  async validar(id: number, analistaId: number): Promise<AtestadoDTO> {
    await this.garantirPendente(id);
    const validado = await this.atestados.analisar(id, {
      status: StatusAtestado.VALIDADO,
      analistaId,
      motivoRejeicao: null,
    });

    await notificarSemFalhar(
      this.notificacoes,
      {
        usuarioIds: [validado.usuarioId],
        tipo: 'ATESTADO_VALIDADO',
        titulo: 'Atestado validado',
        mensagem: `Seu atestado de ${formatarDia(validado.dataInicio)} a ${formatarDia(validado.dataFim)} foi validado.`,
        referencia: { tipo: 'ATESTADO', id: validado.id },
        chaveOrigem: `atestado:${validado.id}:validado`,
      },
      this.logger,
    );
    return validado;
  }

  async rejeitar(id: number, analistaId: number, motivo: string): Promise<AtestadoDTO> {
    await this.garantirPendente(id);

    const motivoAparado = motivo.trim();
    if (!motivoAparado) {
      throw new PeriodoAtestadoInvalidoException('a rejeição exige motivo preenchido');
    }

    const rejeitado = await this.atestados.analisar(id, {
      status: StatusAtestado.REJEITADO,
      analistaId,
      motivoRejeicao: motivoAparado,
    });

    await notificarSemFalhar(
      this.notificacoes,
      {
        usuarioIds: [rejeitado.usuarioId],
        tipo: 'ATESTADO_REJEITADO',
        titulo: 'Atestado rejeitado',
        mensagem: `Seu atestado de ${formatarDia(rejeitado.dataInicio)} a ${formatarDia(rejeitado.dataFim)} foi rejeitado: ${motivoAparado}`,
        referencia: { tipo: 'ATESTADO', id: rejeitado.id },
        chaveOrigem: `atestado:${rejeitado.id}:rejeitado`,
      },
      this.logger,
    );
    return rejeitado;
  }

  private async garantirPendente(id: number): Promise<void> {
    const atestado = await this.atestados.buscarPorId(id);
    if (!atestado) throw new AtestadoNaoEncontradoException();
    if (atestado.status !== StatusAtestado.PENDENTE) throw new AtestadoJaAnalisadoException();
  }

  /** Atestado justifica ausência que já aconteceu; 1 dia de folga cobre relógio de aparelho adiantado. */
  private validarPeriodo(dataInicio: string, dataFim: string): void {
    if (dataFim < dataInicio) {
      throw new PeriodoAtestadoInvalidoException('a data final é anterior à inicial');
    }

    const limite = somarDias(diaNoFuso(new Date().toISOString(), FUSO_OPERACAO), 1);
    if (dataInicio > limite) {
      throw new PeriodoAtestadoInvalidoException('o período começa no futuro');
    }
  }

  /** Sobe uma foto; em falha, remove o que já subiu no mesmo envio antes de estourar. */
  private async subirFoto(
    usuarioId: number,
    foto: FotoBase64,
    jaEnviadas: FotoArmazenada[],
  ): Promise<FotoArmazenada> {
    const extensao = EXTENSAO_POR_MIME[foto.mimeType];
    if (!extensao) throw new FotoInvalidaException(`tipo ${foto.mimeType} não aceito`);

    const conteudo = Buffer.from(foto.conteudoBase64, 'base64');
    if (conteudo.byteLength === 0) throw new FotoInvalidaException('conteúdo vazio ou não é base64');
    if (conteudo.byteLength > TAMANHO_MAXIMO_FOTO_BYTES) {
      throw new FotoInvalidaException('acima de 5 MB');
    }

    const caminho = `${usuarioId}/${randomUUID()}.${extensao}`;
    const enviou = await this.storage.enviar(caminho, conteudo, foto.mimeType);
    if (!enviou) {
      for (const anterior of jaEnviadas) await this.storage.remover(anterior.storagePath);
      throw new BadGatewayException('Falha ao armazenar a foto do atestado');
    }

    return { storagePath: caminho, mimeType: foto.mimeType, tamanhoBytes: conteudo.byteLength };
  }
}
