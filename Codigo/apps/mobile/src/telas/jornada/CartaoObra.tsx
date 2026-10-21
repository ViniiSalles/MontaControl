import { Pressable, View } from 'react-native';
import { cores, espacamento } from '@montacontrol/design-tokens/native';
import { Cartao } from '../../ui/Cartao';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';
import type { ObraDoPonto } from '../../pedidos/obras';

export function descreverObra(obra: ObraDoPonto): string {
  return `${obra.cliente.endereco} · ${obra.cliente.cidade}/${obra.cliente.estado}`;
}

export interface AcaoCartaoObra {
  rotulo: string;
  aoPressionar: () => void;
}

interface PropsCartaoObra {
  obra: ObraDoPonto | null;
  /** Título quando não há obra (ex.: "Nenhuma obra escolhida"). */
  tituloVazio?: string;
  detalheVazio?: string;
  /** Sem ação, o cartão é só leitura: a obra vem do ponto e não se troca ali. */
  acao?: AcaoCartaoObra;
}

/**
 * Linha compacta da obra (ícone, cliente, pedido e endereço). A Jornada a usa
 * para escolher a obra antes da entrada; Jornada com ponto aberto, Bipagem e
 * Avarias a usam só para mostrar em que obra o montador está.
 */
export function CartaoObra({ obra, tituloVazio = '', detalheVazio = '', acao }: PropsCartaoObra) {
  const titulo = obra ? obra.cliente.nome : tituloVazio;
  const detalhe = obra ? `${obra.numeroPedido} · ${descreverObra(obra)}` : detalheVazio;

  const linha = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[12] }}>
      <Icone nome="home_work" tamanho={espacamento[24]} cor={obra ? cores.primary : cores.tertiary} />
      <View style={{ flex: 1, gap: espacamento[2] }}>
        <Texto variante="labelSm" cor={cores.onSurfaceVariant}>
          OBRA
        </Texto>
        <Texto variante="titleSm" numeroDeLinhas={1}>
          {titulo}
        </Texto>
        <Texto variante="bodySm" cor={cores.onSurfaceVariant} numeroDeLinhas={2}>
          {detalhe}
        </Texto>
      </View>
      {acao && (
        <Texto variante="labelLg" cor={cores.primary}>
          {acao.rotulo}
        </Texto>
      )}
    </View>
  );

  return (
    <Cartao
      elevacao="elev1"
      tom="padrao"
      conteudo={
        acao ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Obra: ${titulo}. ${acao.rotulo}`}
            onPress={acao.aoPressionar}
          >
            {linha}
          </Pressable>
        ) : (
          linha
        )
      }
    />
  );
}
