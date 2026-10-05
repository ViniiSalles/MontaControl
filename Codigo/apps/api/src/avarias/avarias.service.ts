import { BadGatewayException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  AvariaDTO,
  AvariaDetalhadaDTO,
  FotoBase64,
  ReportarAvariaRequest,
  TipoAvariaDTO,
} from '@montacontrol/shared';
import { Perfil, StatusAvaria } from '../../generated/prisma';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado';
import { PecaNaoEncontradaException } from '../pecas/exceptions/peca-nao-encontrada.exception';
import { PecasRepository } from '../pecas/pecas.repository';
import { PedidosRepository } from '../pedidos/pedidos.repository';
import { AvariasStorageGateway } from '../supabase/avarias-storage.gateway';
import {
  AvariasRepository,
  FiltroListagemAvarias,
  FotoArmazenada,
} from './avarias.repository';
import { AvariaInvalidaException } from './exceptions/avaria-invalida.exception';
import { AvariaNaoEncontradaException } from './exceptions/avaria-nao-encontrada.exception';
import { TransicaoStatusAvariaInvalidaException } from './exceptions/transicao-status-avaria-invalida.exception';
import { TiposAvariaRepository } from './tipos-avaria.repository';

const TAMANHO_MAXIMO_FOTO_BYTES = 5 * 1024 * 1024;
const VALIDADE_URL_ASSINADA_SEGUNDOS = 300;
const EXTENSAO_POR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/** Fluxo de análise do gestor: só anda para frente, sem pular etapa. */
const PROXIMOS_STATUS: Record<StatusAvaria, StatusAvaria[]> = {
  [StatusAvaria.REPORTADA]: [StatusAvaria.EM_ANALISE],
  [StatusAvaria.EM_ANALISE]: [StatusAvaria.REPOSICAO_SOLICITADA, StatusAvaria.RESOLVIDA],
  [StatusAvaria.REPOSICAO_SOLICITADA]: [StatusAvaria.RESOLVIDA],
  [StatusAvaria.RESOLVIDA]: [],
};

/** Decisões que encerram ou movem a peça exigem justificativa registrada. */
const EXIGEM_PARECER = new Set<StatusAvaria>([
  StatusAvaria.REPOSICAO_SOLICITADA,
  StatusAvaria.RESOLVIDA,
]);

@Injectable()
export class AvariasService {
  constructor(
    private readonly avarias: AvariasRepository,
    private readonly tipos: TiposAvariaRepository,
    private readonly pecas: PecasRepository,
    private readonly pedidos: PedidosRepository,
    private readonly storage: AvariasStorageGateway,
  ) {}

  async listarTipos(): Promise<TipoAvariaDTO[]> {
    return this.tipos.listar();
  }

  /**
   * Ordem deliberada, como no atestado: valida tudo, sobe as fotos, só então
   * grava. O montador só reporta peça de pedido em que está trabalhando; para
   * ele, peça de outro pedido é indistinguível de peça inexistente (404).
   */
  async reportar(usuario: UsuarioAutenticado, dados: ReportarAvariaRequest): Promise<AvariaDTO> {
    const jaCriada = await this.avarias.buscarPorIdCliente(dados.idCliente);
    if (jaCriada) return jaCriada;

    const peca = await this.pecas.buscarPorId(dados.pecaId);
    if (!peca) throw new PecaNaoEncontradaException();
    if (
      usuario.perfil === Perfil.MONTADOR &&
      !(await this.pedidos.montadorVinculado(peca.pedidoId, usuario.id))
    ) {
      throw new PecaNaoEncontradaException();
    }

    if (!(await this.tipos.existe(dados.tipoAvariaId))) {
      throw new AvariaInvalidaException('tipo de avaria inexistente');
    }

    const descricao = dados.descricao.trim();
    if (!descricao) throw new AvariaInvalidaException('descrição vazia');

    const enviadas: FotoArmazenada[] = [];
    for (const foto of dados.fotos ?? []) {
      enviadas.push(await this.subirFoto(usuario.id, foto, enviadas));
    }

    try {
      return await this.avarias.criar({
        pecaId: dados.pecaId,
        tipoAvariaId: dados.tipoAvariaId,
        registradaPor: usuario.id,
        idCliente: dados.idCliente,
        descricao,
        fotos: enviadas,
      });
    } catch (erro) {
      // Compensação: sem a linha no banco, a foto no bucket fica órfã.
      for (const foto of enviadas) await this.storage.remover(foto.storagePath);
      throw erro;
    }
  }

  async listar(filtro: FiltroListagemAvarias): Promise<AvariaDTO[]> {
    return this.avarias.listar(filtro);
  }

  async listarDoUsuario(usuarioId: number): Promise<AvariaDTO[]> {
    return this.avarias.listarPorRegistrador(usuarioId);
  }

  /** Detalhe do gestor: o caminho do bucket vira URL assinada e não vaza no corpo. */
  async detalhar(id: number): Promise<AvariaDetalhadaDTO> {
    const avaria = await this.avarias.buscarPorId(id);
    if (!avaria) throw new AvariaNaoEncontradaException();

    const expiraEm = new Date(Date.now() + VALIDADE_URL_ASSINADA_SEGUNDOS * 1000).toISOString();

    const fotos = [];
    for (const foto of avaria.fotos) {
      const url = await this.storage.gerarUrlAssinada(
        foto.storagePath,
        VALIDADE_URL_ASSINADA_SEGUNDOS,
      );
      if (!url) throw new BadGatewayException('Não foi possível abrir a foto da avaria');
      fotos.push({ id: foto.id, url, expiraEm });
    }

    return { ...avaria, fotos };
  }

  async atualizarStatus(
    id: number,
    analistaId: number,
    para: StatusAvaria,
    parecer?: string,
  ): Promise<AvariaDTO> {
    const avaria = await this.avarias.buscarPorId(id);
    if (!avaria) throw new AvariaNaoEncontradaException();

    const de = avaria.status as unknown as StatusAvaria;
    if (!PROXIMOS_STATUS[de].includes(para)) {
      throw new TransicaoStatusAvariaInvalidaException(de, para);
    }

    const parecerAparado = parecer?.trim() || null;
    if (EXIGEM_PARECER.has(para) && !parecerAparado) {
      throw new AvariaInvalidaException(`${para} exige parecer preenchido`);
    }

    const atualizada = await this.avarias.analisar(id, {
      de,
      para,
      analistaId,
      parecer: parecerAparado ?? avaria.parecer,
    });
    // Outro gestor mudou o status entre a leitura e a escrita.
    if (!atualizada) throw new TransicaoStatusAvariaInvalidaException(de, para);
    return atualizada;
  }

  /** Sobe uma foto; em falha, remove o que já subiu no mesmo envio antes de estourar. */
  private async subirFoto(
    usuarioId: number,
    foto: FotoBase64,
    jaEnviadas: FotoArmazenada[],
  ): Promise<FotoArmazenada> {
    const extensao = EXTENSAO_POR_MIME[foto.mimeType];
    if (!extensao) throw new AvariaInvalidaException(`foto do tipo ${foto.mimeType} não aceita`);

    const conteudo = Buffer.from(foto.conteudoBase64, 'base64');
    if (conteudo.byteLength === 0) {
      throw new AvariaInvalidaException('foto vazia ou não é base64');
    }
    if (conteudo.byteLength > TAMANHO_MAXIMO_FOTO_BYTES) {
      throw new AvariaInvalidaException('foto acima de 5 MB');
    }

    const caminho = `${usuarioId}/${randomUUID()}.${extensao}`;
    const enviou = await this.storage.enviar(caminho, conteudo, foto.mimeType);
    if (!enviou) {
      for (const anterior of jaEnviadas) await this.storage.remover(anterior.storagePath);
      throw new BadGatewayException('Falha ao armazenar a foto da avaria');
    }

    return { storagePath: caminho, mimeType: foto.mimeType, tamanhoBytes: conteudo.byteLength };
  }
}
