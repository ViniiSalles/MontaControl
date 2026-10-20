import { Pressable, View } from 'react-native';
import { cores, espacamento } from '@montacontrol/design-tokens/native';
import { RAIO_TOLERANCIA_PONTO_METROS } from '@montacontrol/shared';
import { Alerta } from '../../ui/Alerta';
import { Cartao } from '../../ui/Cartao';
import { Icone } from '../../ui/Icone';
import { Modal } from '../../ui/Modal';
import { Texto } from '../../ui/Texto';
import type { ObraDoPonto } from '../../pedidos/obras';
import { Opcao } from '../avarias/Opcao';

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

export function descreverObra(obra: ObraDoPonto): string {
  return `${obra.cliente.endereco} · ${obra.cliente.cidade}/${obra.cliente.estado}`;
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
  const podeTrocar = obras.length > 1;

  const titulo = selecionada
    ? selecionada.cliente.nome
    : carregando
      ? 'Carregando obras…'
      : 'Nenhuma obra escolhida';
  const detalhe = selecionada
    ? `${selecionada.numeroPedido} · ${descreverObra(selecionada)}`
    : `O ponto só é aceito a até ${RAIO_TOLERANCIA_PONTO_METROS} m da obra.`;

  const linha = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[12] }}>
      <Icone nome="home_work" tamanho={espacamento[24]} cor={selecionada ? cores.primary : cores.tertiary} />
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
      {podeTrocar && (
        <Texto variante="labelLg" cor={cores.primary}>
          {selecionada ? 'Trocar' : 'Escolher'}
        </Texto>
      )}
    </View>
  );

  return (
    <>
      <Cartao
        elevacao="elev1"
        tom="padrao"
        conteudo={
          podeTrocar ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Obra: ${titulo}. ${selecionada ? 'Trocar' : 'Escolher'}`}
              onPress={aoAbrir}
            >
              {linha}
            </Pressable>
          ) : (
            linha
          )
        }
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
