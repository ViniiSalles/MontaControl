import { View } from 'react-native';
import type { NomeIcone } from '@montacontrol/design-tokens/icones';
import { cores, espacamento, raio } from '@montacontrol/design-tokens/native';
import { Badge } from '../../ui/Badge';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';
import type {
  AmbienteNaConferencia,
  PecaNaConferencia,
  SituacaoPeca,
} from '../../conferencia/conferencia';

const VISUAL_POR_SITUACAO: Record<
  SituacaoPeca,
  { icone: NomeIcone; cor: string; preenchido: boolean; rotulo: string }
> = {
  conferida: { icone: 'check_circle', cor: cores.primary, preenchido: true, rotulo: 'Conferida' },
  aguardando_envio: {
    icone: 'check_circle',
    cor: cores.primary,
    preenchido: true,
    rotulo: 'Conferida, aguardando envio',
  },
  faltando: { icone: 'radio_button_unchecked', cor: cores.outline, preenchido: false, rotulo: 'Faltando' },
  inconsistente: { icone: 'warning', cor: cores.error, preenchido: true, rotulo: 'Lida em outra obra' },
  sem_codigo: { icone: 'warning', cor: cores.tertiary, preenchido: false, rotulo: 'Não triada' },
};

function ItemPeca({ item }: { item: PecaNaConferencia }) {
  const visual = VISUAL_POR_SITUACAO[item.situacao];
  const { peca } = item;
  const detalhe = [
    peca.codigoBarras ?? 'Sem código de barras',
    peca.quantidade > 1 ? `${peca.quantidade} un.` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View
      accessible
      accessibilityLabel={`${peca.descricao}, ${detalhe}, ${visual.rotulo}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacamento[12],
        padding: espacamento[16],
        borderRadius: raio.lg,
        backgroundColor: cores.surfaceContainerLow,
      }}
    >
      <View style={{ flex: 1, gap: espacamento[4] }}>
        <Texto variante="titleMd" cor={item.situacao === 'faltando' ? cores.onSurfaceVariant : cores.onSurface}>
          {peca.descricao}
        </Texto>
        <Texto variante="bodySm" cor={cores.onSurfaceVariant}>
          {detalhe}
        </Texto>
        {item.situacao === 'aguardando_envio' && <Badge variante="aviso" texto="Aguardando envio" />}
        {(item.situacao === 'inconsistente' || item.situacao === 'sem_codigo') && (
          <Texto variante="bodySm" cor={visual.cor}>
            {visual.rotulo}
          </Texto>
        )}
      </View>
      <Icone nome={visual.icone} cor={visual.cor} preenchido={visual.preenchido} />
    </View>
  );
}

/** Checklist do pedido ativo por ambiente — peça que falta salta à vista antes de o caminhão sair. */
export function ChecklistPecas({ ambientes }: { ambientes: AmbienteNaConferencia[] }) {
  return (
    <View style={{ gap: espacamento[24] }}>
      {ambientes.map((ambiente) => (
        <View key={ambiente.id} style={{ gap: espacamento[8] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[8] }}>
            <View style={{ flex: 1 }}>
              <Texto variante="titleSm">{ambiente.nome}</Texto>
            </View>
            <Badge
              variante={ambiente.total > 0 && ambiente.conferidas === ambiente.total ? 'sucesso' : 'neutro'}
              texto={`${ambiente.conferidas}/${ambiente.total}`}
            />
          </View>
          {ambiente.pecas.length === 0 ? (
            <Texto variante="bodySm" cor={cores.onSurfaceVariant}>
              Nenhuma peça cadastrada neste ambiente.
            </Texto>
          ) : (
            ambiente.pecas.map((item) => <ItemPeca key={item.peca.id} item={item} />)
          )}
        </View>
      ))}
    </View>
  );
}
