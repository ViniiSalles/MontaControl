import { Platform, Pressable, View } from 'react-native';
import { cores, espacamento, raio } from '@montacontrol/design-tokens/native';
import { sombraPorNivel } from '@montacontrol/design-tokens/native/sombra';
import { Botao } from '../ui/Botao';
import { Icone } from '../ui/Icone';
import { Texto } from '../ui/Texto';
import { iconeDaNotificacao, tomDaNotificacao } from './apresentacao';
import type { TomDaNotificacao } from './apresentacao';
import type { NotificacaoLocal } from './useNotificacoes';

/** Borda esquerda, ícone e fundo do ícone por tom — todos papéis de `cores`, nenhum hex solto. */
const corPorTom: Record<TomDaNotificacao, { borda: string; icone: string; fundoIcone: string }> = {
  primary: { borda: cores.primary, icone: cores.primary, fundoIcone: cores.primaryFixed },
  tertiary: { borda: cores.tertiary, icone: cores.tertiary, fundoIcone: cores.tertiaryFixed },
  error: { borda: cores.error, icone: cores.error, fundoIcone: cores.errorContainer },
  success: { borda: cores.success, icone: cores.success, fundoIcone: cores.successContainer },
};

const TAMANHO_DO_ICONE = espacamento[48];
const TAMANHO_DO_PONTO = espacamento[8];
const OPACIDADE_DA_LIDA = 0.8;

interface PropsCartaoNotificacao {
  notificacao: NotificacaoLocal;
  /** Hora local (`HH:mm`) já formatada no fuso de operação. */
  hora: string;
  /** Tocar no cartão (marca como lida). Ausente quando não há o que fazer: já lida ou sem conexão. */
  aoPressionar?: () => void;
  /** Ação "Ver detalhes". Ausente quando o tipo não tem destino. */
  aoAbrir?: () => void;
}

/**
 * Cartão de uma notificação. Não usa `Cartao`: aqui há uma borda colorida à
 * esquerda por tipo (a cor é o que o montador lê primeiro: verde aprovado,
 * vermelho recusado) e o `Cartao` é, de propósito, sem borda. Sem linhas
 * divisórias (DESIGN.md §5): a diferença entre lida e não lida é só tom de
 * fundo, sombra, peso do texto e o ponto azul.
 */
export function CartaoNotificacao({ notificacao, hora, aoPressionar, aoAbrir }: PropsCartaoNotificacao) {
  const cor = corPorTom[tomDaNotificacao(notificacao.tipo)];
  const lida = notificacao.lida;

  return (
    <View
      testID="cartao-notificacao"
      style={[
        {
          borderRadius: raio.lg,
          borderLeftWidth: espacamento[4],
          borderLeftColor: cor.borda,
          overflow: 'hidden',
          backgroundColor: lida ? cores.surfaceContainerLow : cores.surfaceContainerLowest,
          opacity: lida ? OPACIDADE_DA_LIDA : 1,
        },
        !lida && sombraPorNivel('elev1', Platform.OS === 'android' ? 'android' : 'ios'),
      ]}
    >
      <View style={{ padding: espacamento[16], gap: espacamento[12] }}>
        <Pressable
          disabled={!aoPressionar}
          onPress={aoPressionar}
          accessibilityRole={aoPressionar ? 'button' : undefined}
          accessibilityHint={aoPressionar ? 'Marca como lida' : undefined}
          style={{ flexDirection: 'row', gap: espacamento[16] }}
        >
          <View
            style={{
              width: TAMANHO_DO_ICONE,
              height: TAMANHO_DO_ICONE,
              borderRadius: raio.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: cor.fundoIcone,
            }}
          >
            <Icone nome={iconeDaNotificacao(notificacao.tipo)} cor={cor.icone} preenchido />
          </View>
          <View style={{ flex: 1, gap: espacamento[4] }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: espacamento[8] }}>
              <View style={{ flex: 1 }}>
                <Texto variante="titleMd" peso={lida ? 600 : 700} cor={lida ? cores.onSurfaceVariant : cores.onSurface}>
                  {notificacao.titulo}
                </Texto>
              </View>
              <View
                style={{
                  backgroundColor: lida ? cores.surfaceContainerHigh : cores.surfaceContainer,
                  borderRadius: raio.sm,
                  paddingHorizontal: espacamento[8],
                  paddingVertical: espacamento[4],
                  // Libera o canto do ponto de "não lida".
                  marginTop: espacamento[4],
                }}
              >
                <Texto variante="labelSm" cor={cores.onSurfaceVariant} tabular>
                  {hora}
                </Texto>
              </View>
            </View>
            <Texto variante="bodyMd" cor={cores.onSurfaceVariant}>
              {notificacao.mensagem}
            </Texto>
          </View>
        </Pressable>

        {aoAbrir && (
          <View style={{ alignSelf: 'flex-start' }}>
            <Botao
              variante="tonal"
              tamanho={40}
              forma="pilula"
              texto="Ver detalhes"
              rotuloAcessivel={`Ver detalhes: ${notificacao.titulo}`}
              aoPressionar={aoAbrir}
            />
          </View>
        )}
      </View>

      {!lida && (
        <View
          testID="ponto-nao-lida"
          style={{
            position: 'absolute',
            top: espacamento[8],
            right: espacamento[8],
            width: TAMANHO_DO_PONTO,
            height: TAMANHO_DO_PONTO,
            borderRadius: raio.full,
            backgroundColor: cores.primary,
          }}
        />
      )}
    </View>
  );
}
