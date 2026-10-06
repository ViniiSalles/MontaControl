import { useState } from 'react';
import { View } from 'react-native';
import type { AvariaDTO } from '@montacontrol/shared';
import { cores, espacamento, espacamentoNomeado } from '@montacontrol/design-tokens/native';
import { Alerta } from '../ui/Alerta';
import { Badge } from '../ui/Badge';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Carregando } from '../ui/Carregando';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';
import { useAuth } from '../auth/AuthContext';
import { ROTULO_STATUS_AVARIA, VARIANTE_STATUS_AVARIA } from '../avarias/rotulos';
import { useDadosAvarias } from '../avarias/useDadosAvarias';
import { NovaAvaria } from './avarias/NovaAvaria';

function ItemHistorico({ avaria }: { avaria: AvariaDTO }) {
  return (
    <View style={{ gap: espacamento[8] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[12] }}>
        <View style={{ flex: 1 }}>
          <Texto variante="titleMd">{avaria.descricaoPeca}</Texto>
          <Texto variante="bodySm" cor={cores.onSurfaceVariant}>
            {avaria.tipoAvaria} · {avaria.numeroPedido} · {avaria.ambiente}
          </Texto>
        </View>
        <Badge variante={VARIANTE_STATUS_AVARIA[avaria.status]} texto={ROTULO_STATUS_AVARIA[avaria.status]} />
      </View>
      {avaria.parecer && (
        <Texto variante="bodyMd" cor={cores.onSurfaceVariant}>
          Gestor: {avaria.parecer}
        </Texto>
      )}
    </View>
  );
}

/** Reporte de problemas com peças pelo montador em campo e acompanhamento da análise do gestor. */
export function Avarias() {
  const { sessao } = useAuth();
  const token = sessao?.accessToken ?? '';
  const { pedidos, tipos, avarias, carregando, erro, recarregar } = useDadosAvarias(token);
  const [aviso, setAviso] = useState<string | null>(null);

  function aoEnviado(mensagem: string) {
    setAviso(mensagem);
    void recarregar();
  }

  return (
    <Tela rolavel>
      <View style={{ gap: espacamentoNomeado.gapPilha }}>
        <Texto variante="headlineMd">Avarias</Texto>

        {aviso && <Alerta variante="sucesso" mensagem={aviso} />}

        {carregando ? (
          <View style={{ alignItems: 'center', paddingVertical: espacamento[32] }}>
            <Carregando tamanho={espacamento[32]} />
          </View>
        ) : erro ? (
          <>
            <Alerta
              variante="erro"
              titulo="Não foi possível carregar"
              mensagem="Verifique a internet e tente de novo."
            />
            <Botao
              variante="tonal"
              tamanho={48}
              forma="pilula"
              texto="Tentar de novo"
              larguraTotal
              aoPressionar={() => void recarregar()}
            />
          </>
        ) : (
          <>
            {pedidos.length === 0 ? (
              <Alerta
                variante="info"
                titulo="Nenhum pedido vinculado"
                mensagem="Você só pode reportar peças dos pedidos em que está trabalhando. Fale com o gestor."
              />
            ) : (
              <NovaAvaria
                token={token}
                pedidos={pedidos}
                tipos={tipos}
                aoEnviado={aoEnviado}
                aoIniciarEnvio={() => setAviso(null)}
              />
            )}

            <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
              MEUS REPORTES
            </Texto>
            {avarias.length === 0 ? (
              <Texto variante="bodyMd" cor={cores.onSurfaceVariant}>
                Nenhum problema reportado ainda.
              </Texto>
            ) : (
              <View style={{ gap: espacamento[12] }}>
                {avarias.map((avaria) => (
                  <Cartao key={avaria.id} elevacao="elev1" tom="baixo" conteudo={<ItemHistorico avaria={avaria} />} />
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </Tela>
  );
}
