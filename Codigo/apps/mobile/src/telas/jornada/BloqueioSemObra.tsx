import { View } from 'react-native';
import { espacamento } from '@montacontrol/design-tokens/native';
import { Alerta } from '../../ui/Alerta';
import { Botao } from '../../ui/Botao';
import type { MotivoSemObra } from '../../jornada/obraEmTrabalho';

const MENSAGEM: Record<MotivoSemObra, string> = {
  sem_ponto: 'A obra vem do seu ponto: na Jornada, escolha a obra e bata a entrada.',
  jornada_vencida:
    'Sua última entrada passou de 24h sem saída. Registre a saída pelo ponto em atraso e bata uma nova entrada.',
  sem_obra_vinculada:
    'Seu ponto aberto não tem obra vinculada. Registre a saída e bata uma nova entrada escolhendo a obra.',
  obra_fora_da_replica:
    'A obra do seu ponto ainda não está no aparelho. Sincronize e tente de novo.',
};

interface PropsBloqueioSemObra {
  titulo: string;
  motivo: MotivoSemObra;
  aoIrParaJornada: () => void;
}

/**
 * Bipagem e Avarias só funcionam na obra em que o montador bateu o ponto:
 * sem ela, explica o porquê e leva à Jornada, onde se escolhe a obra.
 */
export function BloqueioSemObra({ titulo, motivo, aoIrParaJornada }: PropsBloqueioSemObra) {
  return (
    <View style={{ gap: espacamento[12] }}>
      <Alerta variante="info" titulo={titulo} mensagem={MENSAGEM[motivo]} />
      <Botao
        variante="primario"
        tamanho={48}
        forma="pilula"
        texto="Ir para a Jornada"
        larguraTotal
        aoPressionar={aoIrParaJornada}
      />
    </View>
  );
}
