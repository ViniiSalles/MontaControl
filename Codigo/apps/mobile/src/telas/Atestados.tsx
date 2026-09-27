import { useState } from 'react';
import { View } from 'react-native';
import { StatusAtestado } from '@montacontrol/shared';
import type { AtestadoDTO } from '@montacontrol/shared';
import type { NomeIcone } from '@montacontrol/design-tokens/icones';
import { cores, espacamento, espacamentoNomeado } from '@montacontrol/design-tokens/native';
import { Alerta } from '../ui/Alerta';
import { Badge } from '../ui/Badge';
import type { VarianteBadge } from '@montacontrol/ui-contracts/badge';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Icone } from '../ui/Icone';
import { Carregando } from '../ui/Carregando';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';
import { useAuth } from '../auth/AuthContext';
import { textoPeriodo } from '../atestados/formatarPeriodo';
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
  [StatusAtestado.REJEITADO]: 'Recusado',
};

const ICONE_POR_STATUS: Record<StatusAtestado, NomeIcone> = {
  [StatusAtestado.PENDENTE]: 'schedule',
  [StatusAtestado.VALIDADO]: 'check_circle',
  [StatusAtestado.REJEITADO]: 'cancel',
};

const COR_ICONE_POR_STATUS: Record<StatusAtestado, string> = {
  [StatusAtestado.PENDENTE]: cores.onSurfaceVariant,
  [StatusAtestado.VALIDADO]: cores.primary,
  [StatusAtestado.REJEITADO]: cores.error,
};

function ItemHistorico({ atestado }: { atestado: AtestadoDTO }) {
  return (
    <View style={{ gap: espacamento[8] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[12] }}>
        <Icone nome={ICONE_POR_STATUS[atestado.status]} cor={COR_ICONE_POR_STATUS[atestado.status]} />
        <View style={{ flex: 1 }}>
          <Texto variante="titleMd">Atestado</Texto>
          <Texto variante="bodySm" cor={cores.onSurfaceVariant}>
            {textoPeriodo(atestado.dataInicio, atestado.dataFim)}
          </Texto>
        </View>
        <Badge variante={VARIANTE_POR_STATUS[atestado.status]} texto={ROTULO_POR_STATUS[atestado.status]} />
      </View>
      {atestado.status === StatusAtestado.REJEITADO && atestado.motivoRejeicao && (
        <Texto variante="bodyMd" cor={cores.onSurfaceVariant}>
          {atestado.motivoRejeicao}
        </Texto>
      )}
    </View>
  );
}

/** US13/UC18 — envio de atestado pelo montador, com foto e acompanhamento da análise. */
export function Atestados() {
  const { sessao } = useAuth();
  const token = sessao?.accessToken ?? '';
  const { atestados, carregando, erro, recarregar } = useMeusAtestados(token);
  const [aviso, setAviso] = useState<string | null>(null);

  function aoEnviado() {
    setAviso('Atestado enviado. O RH vai analisar.');
    void recarregar();
  }

  return (
    <Tela rolavel>
      <View style={{ gap: espacamentoNomeado.gapPilha }}>
        <Texto variante="headlineMd">Atestados Médicos</Texto>

        {aviso && <Alerta variante="sucesso" mensagem={aviso} />}

        <NovoAtestado token={token} aoEnviado={aoEnviado} />

        <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
          HISTÓRICO RECENTE
        </Texto>

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
                conteudo={<ItemHistorico atestado={atestado} />}
              />
            ))}
          </View>
        )}

        <Texto variante="bodySm" cor={cores.onSurfaceVariant}>
          Aviso LGPD: os dados e documentos enviados são protegidos pela Lei Geral de Proteção de Dados
          (13.709/2018) e usados exclusivamente para fins de gestão de pessoas.
        </Texto>
      </View>
    </Tela>
  );
}
