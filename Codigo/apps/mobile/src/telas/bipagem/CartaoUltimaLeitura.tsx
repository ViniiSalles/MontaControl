import { View } from 'react-native';
import { cores, espacamento } from '@montacontrol/design-tokens/native';
import { Alerta } from '../../ui/Alerta';
import { Badge } from '../../ui/Badge';
import { Cartao } from '../../ui/Cartao';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';
import type { ResultadoLeitura } from '../../conferencia/conferencia';

interface PropsCartaoUltimaLeitura {
  leitura: ResultadoLeitura;
  numeroPedidoAtivo: string;
}

function quantidade(unidades: number): string {
  return unidades > 1 ? ` · ${unidades} un.` : '';
}

/**
 * Resultado da última leitura. Peça de outro pedido ou desconhecida é o caso
 * que o montador não pode deixar passar (N4T2): vira alerta de erro/aviso,
 * não um selo discreto.
 */
export function CartaoUltimaLeitura({ leitura, numeroPedidoAtivo }: PropsCartaoUltimaLeitura) {
  if (leitura.tipo === 'outro_pedido') {
    return (
      <Alerta
        variante="erro"
        titulo="Peça de outro pedido — não descarregue"
        mensagem={`${leitura.codigoBarras} (${leitura.peca.descricao}) é do pedido ${leitura.numeroPedido}, não do ${numeroPedidoAtivo}. A leitura foi registrada como inconsistente.`}
      />
    );
  }

  if (leitura.tipo === 'nao_encontrada') {
    return (
      <Alerta
        variante="aviso"
        titulo="Peça não encontrada neste pedido"
        mensagem={`O código ${leitura.codigoBarras} não é de nenhuma peça do pedido ${numeroPedidoAtivo}. Confira a etiqueta antes de descarregar; a leitura será verificada pelo servidor ao sincronizar.`}
      />
    );
  }

  const conferidaAgora = leitura.tipo === 'conferida';

  return (
    <View style={{ gap: espacamento[12] }}>
      <Cartao
        elevacao="elev1"
        tom="baixo"
        conteudo={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[12] }}>
            <View style={{ flex: 1, gap: espacamento[4] }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espacamento[8] }}>
                <Texto variante="titleLg">{leitura.codigoBarras}</Texto>
                <Badge
                  variante={conferidaAgora ? 'sucesso' : 'info'}
                  texto={conferidaAgora ? 'Conferida' : 'Já conferida'}
                />
              </View>
              <Texto variante="bodyMd">
                {leitura.peca.descricao}
                {quantidade(leitura.peca.quantidade)}
              </Texto>
              <Texto variante="bodySm" cor={cores.onSurfaceVariant}>
                Pedido {numeroPedidoAtivo} · Ambiente {leitura.ambiente}
              </Texto>
            </View>
            <Icone nome="check_circle" preenchido cor={cores.primary} />
          </View>
        }
      />
      {conferidaAgora && leitura.ambienteCompleto && (
        <Alerta
          variante="sucesso"
          titulo={`Ambiente ${leitura.ambiente} completo`}
          mensagem="Todas as peças deste ambiente foram conferidas."
        />
      )}
    </View>
  );
}
