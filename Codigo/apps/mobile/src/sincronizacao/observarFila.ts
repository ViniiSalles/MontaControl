import { Q } from '@nozbe/watermelondb';
import type { Database } from '@nozbe/watermelondb';
import { AcaoPendente } from '../db/AcaoPendente';
import { useSincronizacaoStore } from '../estado/sincronizacaoStore';
import { apagarFotosDaAcao, caminhosDasFotosDaAcao } from './payloadsDaFila';

/**
 * Publica no store de sincronização o que a fila (WatermelonDB) tem de
 * relevante para a tela: quantas ações ainda esperam envio (`pendentes`) e as
 * mensagens das que o servidor recusou (`avisosDescartados`). A fila continua
 * no banco — o store guarda só a contagem e os avisos, nunca as ações.
 *
 * Devolve a função que cancela as assinaturas (e zera o que publicou: sem
 * observar, a contagem seria um valor velho).
 */
export function observarFila(database: Database): () => void {
  const colecao = database.get<AcaoPendente>('acoes_pendentes');
  const { setState } = useSincronizacaoStore;

  // `observeCount(false)`: a versão throttled do WatermelonDB descarta as
  // mudanças dentro da janela de 250 ms (bug conhecido dela), o que deixaria
  // o contador preso num valor velho quando a fila muda em rajada.
  const assinaturaPendentes = colecao
    .query(Q.where('status', 'pendente'))
    .observeCount(false)
    .subscribe((pendentes) => setState({ pendentes }));

  // `observe()` pode reemitir a mesma linha antes do apagamento terminar (ou se
  // ele falhar); o id evita avisar duas vezes da mesma recusa.
  const idsVistos = new Set<string>();

  const assinaturaDescartadas = colecao
    .query(Q.where('status', 'descartada'))
    .observe()
    .subscribe((registros) => {
      if (registros.length === 0) return;
      const novos = registros
        .filter((registro) => !idsVistos.has(registro.id))
        .map((registro) => ({ id: registro.id, mensagem: registro.mensagemDescarte ?? '' }));
      novos.forEach((aviso) => idsVistos.add(aviso.id));
      // Acumula: um aviso ainda não dispensado não pode se perder porque outra
      // ação foi recusada depois (a linha da primeira já foi apagada da fila).
      if (novos.length > 0) {
        setState((atual) => ({
          avisosDescartados: [...atual.avisosDescartados, ...novos.map((aviso) => aviso.mensagem)],
        }));
      }
      // A drenagem já apaga as fotos ao descartar; aqui é a rede de segurança
      // para um app que morreu entre marcar o descarte e apagar o arquivo.
      void apagarFotosDaAcao(
        registros.flatMap((registro) => caminhosDasFotosDaAcao(registro.payload)),
      );
      // Sem o apagamento a linha só reaparece na próxima emissão (já deduplicada).
      void database
        .write(() =>
          database.batch(...registros.map((registro) => registro.prepareDestroyPermanently())),
        )
        .catch(() => undefined);
    });

  return () => {
    assinaturaPendentes.unsubscribe();
    assinaturaDescartadas.unsubscribe();
    setState({ pendentes: 0, avisosDescartados: [] });
  };
}
