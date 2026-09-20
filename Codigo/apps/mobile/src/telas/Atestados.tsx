import { useState } from 'react';
import { View } from 'react-native';
import { StatusAtestado } from '@montacontrol/shared';
import { cores, espacamento, espacamentoNomeado } from '@montacontrol/design-tokens/native';
import { Alerta } from '../ui/Alerta';
import { Badge } from '../ui/Badge';
import type { VarianteBadge } from '@montacontrol/ui-contracts/badge';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Carregando } from '../ui/Carregando';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';
import { useAuth } from '../auth/AuthContext';
import { useMeusAtestados } from '../atestados/useMeusAtestados';
import { NovoAtestado } from './atestados/NovoAtestado';

const VARIANTE_POR_STATUS: Record<StatusAtestado, VarianteBadge> = {
  [StatusAtestado.PENDENTE]: 'neutro',
  [StatusAtestado.VALIDADO]: 'sucesso',
  [StatusAtestado.REJEITADO]: 'erro',
};

const ROTULO_POR_STATUS: Record<StatusAtestado, string> = {
  [StatusAtestado.PENDENTE]: 'Em análise',
  [StatusAtestado.VALIDADO]: 'Aprovado',
  [StatusAtestado.REJEITADO]: 'Rejeitado',
};

/** Dia civil `YYYY-MM-DD` para exibição, sem `new Date` (que aplicaria fuso e voltaria um dia). */
function formatarDia(dia: string): string {
  const [ano, mes, diaDoMes] = dia.split('-');
  return `${diaDoMes}/${mes}/${ano}`;
}

/** US13/UC18 — envio de atestado pelo montador, com foto e acompanhamento da análise. */
export function Atestados() {
  const { sessao } = useAuth();
  const token = sessao?.accessToken ?? '';
  const { atestados, carregando, erro, recarregar } = useMeusAtestados(token);
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  function aoEnviado() {
    setFormularioAberto(false);
    setAviso('Atestado enviado. O RH vai analisar.');
    void recarregar();
  }

  return (
    <Tela rolavel>
      <View style={{ gap: espacamentoNomeado.gapPilha }}>
        <View style={{ gap: espacamento[4] }}>
          <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
            ATESTADOS
          </Texto>
          <Texto variante="headlineMd">Meus atestados</Texto>
        </View>

        {aviso && <Alerta variante="sucesso" mensagem={aviso} />}

        <Botao
          variante="primario"
          tamanho={48}
          forma="pilula"
          texto="Novo atestado"
          larguraTotal
          aoPressionar={() => {
            setAviso(null);
            setFormularioAberto(true);
          }}
        />

        {carregando ? (
          <View style={{ alignItems: 'center', paddingVertical: espacamento[32] }}>
            <Carregando tamanho={espacamento[32]} />
          </View>
        ) : erro ? (
          <>
            <Alerta
              variante="erro"
              titulo="Não foi possível carregar seus atestados"
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
        ) : atestados.length === 0 ? (
          <Texto variante="bodyMd" cor={cores.onSurfaceVariant}>
            Nenhum atestado enviado ainda.
          </Texto>
        ) : (
          <View style={{ gap: espacamento[12] }}>
            {atestados.map((atestado) => (
              <Cartao
                key={atestado.id}
                elevacao="elev1"
                tom="baixo"
                conteudo={
                  <View style={{ gap: espacamento[8] }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Texto variante="titleMd">
                        {formatarDia(atestado.dataInicio)} a {formatarDia(atestado.dataFim)}
                      </Texto>
                      <Badge
                        variante={VARIANTE_POR_STATUS[atestado.status]}
                        texto={ROTULO_POR_STATUS[atestado.status]}
                      />
                    </View>
                    {atestado.status === StatusAtestado.REJEITADO && atestado.motivoRejeicao && (
                      <Texto variante="bodyMd" cor={cores.onSurfaceVariant}>
                        {atestado.motivoRejeicao}
                      </Texto>
                    )}
                  </View>
                }
              />
            ))}
          </View>
        )}
      </View>

      {formularioAberto && (
        <NovoAtestado token={token} aoFechar={() => setFormularioAberto(false)} aoEnviado={aoEnviado} />
      )}
    </Tela>
  );
}
