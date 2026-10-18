import { useState } from 'react';
import { View } from 'react-native';
import { cores, espacamento, espacamentoNomeado } from '@montacontrol/design-tokens/native';
import { Alerta } from '../ui/Alerta';
import { Badge } from '../ui/Badge';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Carregando } from '../ui/Carregando';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';
import { ROTULO_STATUS_AVARIA, VARIANTE_STATUS_AVARIA } from '../avarias/rotulos';
import type { AvariaExibida } from '../avarias/avariasComPendentes';
import { useDadosAvarias } from '../avarias/useDadosAvarias';
import { useStatusDaSincronizacao } from '../sincronizacao/statusDaSincronizacao';
import { AvisosDeAcoesRecusadas } from './AvisosDeAcoesRecusadas';
import { NovaAvaria } from './avarias/NovaAvaria';

function ItemHistorico({ avaria }: { avaria: AvariaExibida }) {
  return (
    <View style={{ gap: espacamento[8] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[12] }}>
        <View style={{ flex: 1 }}>
          <Texto variante="titleMd">{avaria.descricaoPeca}</Texto>
          <Texto variante="bodySm" cor={cores.onSurfaceVariant}>
            {[avaria.tipoAvaria, avaria.numeroPedido, avaria.ambiente].filter(Boolean).join(' · ')}
          </Texto>
        </View>
        {avaria.aguardandoEnvio ? (
          <Badge variante="aviso" texto="Aguardando envio" />
        ) : (
          <Badge variante={VARIANTE_STATUS_AVARIA[avaria.status]} texto={ROTULO_STATUS_AVARIA[avaria.status]} />
        )}
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
  const { pedidos, tipos, avarias, carregando, erro, recarregar } = useDadosAvarias();
  const { sincronizando } = useStatusDaSincronizacao();
  const [aviso, setAviso] = useState<string | null>(null);

  function aoEnviado(mensagem: string) {
    setAviso(mensagem);
    void recarregar();
  }

  return (
    <Tela rolavel>
      <View style={{ gap: espacamentoNomeado.gapPilha }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[12] }}>
          <View style={{ flex: 1 }}>
            <Texto variante="headlineMd">Avarias</Texto>
          </View>
          <Botao
            variante="icone"
            tamanho={40}
            forma="pilula"
            icone="sync"
            rotuloAcessivel="Atualizar"
            carregando={sincronizando}
            aoPressionar={() => void recarregar()}
          />
        </View>

        {aviso && <Alerta variante="sucesso" mensagem={aviso} />}
        <AvisosDeAcoesRecusadas />

        {carregando ? (
          <View style={{ alignItems: 'center', paddingVertical: espacamento[32] }}>
            <Carregando tamanho={espacamento[32]} />
          </View>
        ) : erro ? (
          <>
            <Alerta
              variante="erro"
              titulo="Não foi possível carregar"
              mensagem="Ainda não há dados no aparelho. Conecte-se à internet e tente de novo."
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
                  <Cartao key={avaria.chave} elevacao="elev1" tom="baixo" conteudo={<ItemHistorico avaria={avaria} />} />
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </Tela>
  );
}
