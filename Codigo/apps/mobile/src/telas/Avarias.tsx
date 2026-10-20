import { useState } from 'react';
import { View } from 'react-native';
import { cores, espacamento, espacamentoNomeado } from '@montacontrol/design-tokens/native';
import { Alerta } from '../ui/Alerta';
import { Badge } from '../ui/Badge';
import { Botao } from '../ui/Botao';
import { BotaoSincronizacao } from '../sincronizacao/BotaoSincronizacao';
import { Cartao } from '../ui/Cartao';
import { Carregando } from '../ui/Carregando';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';
import { ROTULO_STATUS_AVARIA, VARIANTE_STATUS_AVARIA } from '../avarias/rotulos';
import type { AvariaExibida } from '../avarias/avariasComPendentes';
import { useDadosAvarias } from '../avarias/useDadosAvarias';
import { AvisosDeAcoesRecusadas } from './AvisosDeAcoesRecusadas';
import { useObraEmTrabalho } from '../jornada/useObraEmTrabalho';
import type { PropsTelaDaAba } from '../navegacao/telaDaAba';
import { NovaAvaria } from './avarias/NovaAvaria';
import { BloqueioSemObra } from './jornada/BloqueioSemObra';
import { CartaoObra } from './jornada/CartaoObra';

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
export function Avarias({ aoIrParaJornada }: PropsTelaDaAba) {
  const { pedidos, tipos, avarias, carregando, erro, recarregar } = useDadosAvarias();
  const { obra, motivo, carregando: carregandoObra } = useObraEmTrabalho();
  // Só se reporta peça da obra do ponto: abrir avaria em outro pedido era fácil demais.
  const pedido = obra ? (pedidos.find((candidato) => candidato.id === obra.id) ?? null) : null;
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
          <BotaoSincronizacao aoSincronizar={() => void recarregar()} />
        </View>

        {aviso && <Alerta variante="sucesso" mensagem={aviso} />}
        <AvisosDeAcoesRecusadas />

        {carregando || carregandoObra ? (
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
            {!obra ? (
              <BloqueioSemObra
                titulo="Bata o ponto de entrada para registrar avarias"
                motivo={motivo ?? 'sem_ponto'}
                aoIrParaJornada={aoIrParaJornada}
              />
            ) : !pedido ? (
              <>
                <CartaoObra obra={obra} />
                <Alerta
                  variante="aviso"
                  titulo="Dados da obra fora do aparelho"
                  mensagem="As peças desta obra ainda não estão no aparelho. Sincronize pelo botão do topo para reportar."
                />
              </>
            ) : (
              <>
                <CartaoObra obra={obra} />
                <NovaAvaria
                  pedido={pedido}
                  tipos={tipos}
                  aoEnviado={aoEnviado}
                  aoIniciarEnvio={() => setAviso(null)}
                />
              </>
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
