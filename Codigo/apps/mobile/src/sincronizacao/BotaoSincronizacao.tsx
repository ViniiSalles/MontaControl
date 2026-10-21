import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { cores, espacamento, raio } from '@montacontrol/design-tokens/native';
import type { NomeIcone } from '@montacontrol/design-tokens/icones';
import { useSincronizacaoStore } from '../estado/sincronizacaoStore';
import { Icone } from '../ui/Icone';
import { Modal } from '../ui/Modal';
import { Texto } from '../ui/Texto';
import { descreverStatus, formatarHa } from './descreverStatus';
import type { StatusDescrito } from './descreverStatus';
import { useAgora } from './useAgora';

/** O "há X" envelhece sozinho: reavalia a cada meio minuto. */
const INTERVALO_DO_RELOGIO_MS = 30_000;

const TAMANHO = espacamento[40];
const TAMANHO_PONTO = espacamento[10];

/** Só o que pede atenção ganha ponto; em dia, em andamento ou sem histórico, o ícone fica limpo. */
const corDoPonto: Partial<Record<StatusDescrito['variante'], string>> = {
  aviso: cores.tertiary,
  erro: cores.error,
};

interface PropsBotaoSincronizacao {
  /** Sincronização da tela (cada aba recarrega o que mostra depois do pull). */
  aoSincronizar: () => void;
  desabilitado?: boolean;
}

function textoDeRegistros(pendentes: number): string {
  if (pendentes === 0) return 'Nenhum';
  return `${pendentes} ${pendentes === 1 ? 'registro' : 'registros'}`;
}

function LinhaDetalhe({ icone, rotulo, valor }: { icone: NomeIcone; rotulo: string; valor: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[12] }}>
      <Icone nome={icone} tamanho={espacamento[20]} cor={cores.onSurfaceVariant} />
      <View style={{ flex: 1 }}>
        <Texto variante="bodyMd" cor={cores.onSurfaceVariant}>
          {rotulo}
        </Texto>
      </View>
      <Texto variante="titleSm" tabular>
        {valor}
      </Texto>
    </View>
  );
}

/**
 * Botão ⟳ do cabeçalho das abas, que carrega o status da sincronização no
 * lugar de uma faixa fixa: gira enquanto sincroniza e ganha um ponto quando
 * há fila ou problema. Tocar abre um painel com o detalhe (última
 * sincronização, registros aguardando envio) e o "Sincronizar agora" — a faixa
 * global (`IndicadorDeSincronizacao`) só aparece quando o montador precisa agir.
 */
export function BotaoSincronizacao({ aoSincronizar, desabilitado = false }: PropsBotaoSincronizacao) {
  const online = useSincronizacaoStore((estado) => estado.online);
  const sincronizando = useSincronizacaoStore((estado) => estado.sincronizando);
  const pendentes = useSincronizacaoStore((estado) => estado.pendentes);
  const ultimaSincronizacaoEm = useSincronizacaoStore((estado) => estado.ultimaSincronizacaoEm);
  const ultimoErro = useSincronizacaoStore((estado) => estado.ultimoErro);
  const agora = useAgora(INTERVALO_DO_RELOGIO_MS);
  const [aberto, setAberto] = useState(false);

  const { variante, texto } = descreverStatus(
    { online, sincronizando, pendentes, ultimaSincronizacaoEm, ultimoErro },
    agora,
  );
  const ponto = corDoPonto[variante];
  const ultima =
    ultimaSincronizacaoEm === null
      ? 'Ainda não sincronizou'
      : formatarHa(Math.max(0, agora - ultimaSincronizacaoEm));

  function sincronizarAgora() {
    setAberto(false);
    aoSincronizar();
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sincronização: ${texto}`}
        disabled={desabilitado}
        onPress={() => setAberto(true)}
        style={({ pressed }) => ({
          width: TAMANHO,
          height: TAMANHO,
          borderRadius: raio.full,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: desabilitado ? 0.4 : 1,
          backgroundColor: pressed ? cores.surfaceContainerHigh : 'transparent',
        })}
      >
        {sincronizando ? (
          <ActivityIndicator color={cores.onSurfaceVariant} />
        ) : (
          <Icone nome="sync" cor={cores.onSurfaceVariant} />
        )}
        {ponto && (
          <View
            testID="ponto-status-sincronizacao"
            style={{
              position: 'absolute',
              top: espacamento[6],
              right: espacamento[6],
              width: TAMANHO_PONTO,
              height: TAMANHO_PONTO,
              borderRadius: raio.full,
              backgroundColor: ponto,
              borderWidth: 2,
              borderColor: cores.background,
            }}
          />
        )}
      </Pressable>

      <Modal
        visivel={aberto}
        apresentacao="folha"
        titulo="Sincronização"
        aoFechar={() => setAberto(false)}
        conteudo={
          <View style={{ gap: espacamento[16], paddingBottom: espacamento[8] }}>
            {/* Em dia, o "há X" já está na linha de baixo — repetir no título é ruído. */}
            <Texto variante="titleMd">{variante === 'sucesso' ? 'Tudo em dia' : texto}</Texto>
            <LinhaDetalhe icone="schedule" rotulo="Última sincronização" valor={ultima} />
            <LinhaDetalhe icone="pending_actions" rotulo="Aguardando envio" valor={textoDeRegistros(pendentes)} />
            {(!online || pendentes > 0) && (
              <Texto variante="bodySm" cor={cores.onSurfaceVariant}>
                Os registros ficam guardados no aparelho e são enviados sozinhos assim que houver conexão.
              </Texto>
            )}
          </View>
        }
        acoes={[{ texto: 'Sincronizar agora', aoPressionar: sincronizarAgora }]}
      />
    </>
  );
}
