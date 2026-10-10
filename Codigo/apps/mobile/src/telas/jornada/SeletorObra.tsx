import { View } from 'react-native';
import { cores, espacamento } from '@montacontrol/design-tokens/native';
import { RAIO_TOLERANCIA_PONTO_METROS } from '@montacontrol/shared';
import { Alerta } from '../../ui/Alerta';
import { Cartao } from '../../ui/Cartao';
import { Texto } from '../../ui/Texto';
import type { ObraDoPonto } from '../../pedidos/obrasLocais';
import { Opcao } from '../avarias/Opcao';

interface PropsSeletorObra {
  obras: ObraDoPonto[];
  selecionadaId: number | null;
  aoSelecionar: (id: number) => void;
  carregando: boolean;
}

export function descreverObra(obra: ObraDoPonto): string {
  return `${obra.cliente.endereco} · ${obra.cliente.cidade}/${obra.cliente.estado}`;
}

/** Escolha da obra antes da entrada — o ponto só vale perto do endereço do cliente dela. */
export function SeletorObra({ obras, selecionadaId, aoSelecionar, carregando }: PropsSeletorObra) {
  if (!carregando && obras.length === 0) {
    return (
      <Alerta
        variante="info"
        titulo="Nenhuma obra atribuída"
        mensagem="Para bater o ponto você precisa estar vinculado a um pedido. Fale com o gestor e toque em Atualizar."
      />
    );
  }

  return (
    <Cartao
      elevacao="elev1"
      tom="padrao"
      conteudo={
        <View style={{ gap: espacamento[8] }}>
          <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
            OBRA
          </Texto>
          {obras.map((obra) => (
            <Opcao
              key={obra.id}
              forma="linha"
              rotulo={`${obra.cliente.nome} · ${obra.numeroPedido}`}
              detalhe={descreverObra(obra)}
              selecionada={obra.id === selecionadaId}
              aoPressionar={() => aoSelecionar(obra.id)}
            />
          ))}
          <Texto variante="bodySm" cor={cores.onSurfaceVariant}>
            O ponto só é aceito a até {RAIO_TOLERANCIA_PONTO_METROS} m do endereço da obra.
          </Texto>
        </View>
      }
    />
  );
}
