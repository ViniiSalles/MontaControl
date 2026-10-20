import { View } from 'react-native';
import { cores, espacamento } from '@montacontrol/design-tokens/native';
import { RAIO_TOLERANCIA_PONTO_METROS } from '@montacontrol/shared';
import { Alerta } from '../../ui/Alerta';
import { Modal } from '../../ui/Modal';
import { Texto } from '../../ui/Texto';
import type { ObraDoPonto } from '../../pedidos/obras';
import { Opcao } from '../avarias/Opcao';
import { CartaoObra, descreverObra } from './CartaoObra';

interface PropsSeletorObra {
  obras: ObraDoPonto[];
  selecionadaId: number | null;
  aoSelecionar: (id: number) => void;
  carregando: boolean;
  /** A lista mora num modal controlado pela tela: bater a entrada sem obra também a abre. */
  aberto: boolean;
  aoAbrir: () => void;
  aoFechar: () => void;
}

/**
 * Escolha da obra antes da entrada — o ponto só vale perto do endereço do
 * cliente dela. Fica numa linha compacta acima do botão principal (a lista
 * inteira empurrava o "bater ponto" para fora da tela); a lista abre num
 * modal, e só quando há o que escolher.
 */
export function SeletorObra({
  obras,
  selecionadaId,
  aoSelecionar,
  carregando,
  aberto,
  aoAbrir,
  aoFechar,
}: PropsSeletorObra) {
  if (!carregando && obras.length === 0) {
    return (
      <Alerta
        variante="info"
        titulo="Nenhuma obra atribuída"
        mensagem="Para bater o ponto você precisa estar vinculado a um pedido. Fale com o gestor e sincronize de novo."
      />
    );
  }

  const selecionada = obras.find((obra) => obra.id === selecionadaId) ?? null;
  const acao =
    obras.length > 1 ? { rotulo: selecionada ? 'Trocar' : 'Escolher', aoPressionar: aoAbrir } : undefined;

  return (
    <>
      <CartaoObra
        obra={selecionada}
        tituloVazio={carregando ? 'Carregando obras…' : 'Nenhuma obra escolhida'}
        detalheVazio={`O ponto só é aceito a até ${RAIO_TOLERANCIA_PONTO_METROS} m da obra.`}
        acao={acao}
      />

      <Modal
        visivel={aberto}
        apresentacao="folha"
        titulo="Escolha a obra"
        aoFechar={aoFechar}
        conteudo={
          <View style={{ gap: espacamento[8], paddingBottom: espacamento[24] }}>
            {obras.map((obra) => (
              <Opcao
                key={obra.id}
                forma="linha"
                rotulo={`${obra.cliente.nome} · ${obra.numeroPedido}`}
                detalhe={descreverObra(obra)}
                selecionada={obra.id === selecionadaId}
                aoPressionar={() => {
                  aoSelecionar(obra.id);
                  aoFechar();
                }}
              />
            ))}
            <Texto variante="bodySm" cor={cores.onSurfaceVariant}>
              O ponto só é aceito a até {RAIO_TOLERANCIA_PONTO_METROS} m do endereço da obra.
            </Texto>
          </View>
        }
      />
    </>
  );
}
