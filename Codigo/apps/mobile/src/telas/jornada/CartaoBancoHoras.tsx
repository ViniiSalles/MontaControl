import { Pressable, View } from 'react-native';
import { cores, espacamento } from '@montacontrol/design-tokens/native';
import type { BancoHorasDTO } from '@montacontrol/shared';
import { Badge } from '../../ui/Badge';
import { Cartao } from '../../ui/Cartao';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';
import { formatarSaldoHoras } from '../../banco-horas/formatacao';

interface PropsCartaoBancoHoras {
  /** `null` enquanto carrega ou se a consulta falhou — o card não aparece nesse caso. */
  bancoHoras: BancoHorasDTO | null;
  aoAbrirBancoHoras: () => void;
}

function SeloSaldo({ saldo }: { saldo: number }) {
  if (saldo > 0) return <Badge variante="sucesso" texto="Saldo positivo" />;
  if (saldo < 0) return <Badge variante="erro" texto="Saldo negativo" />;
  return <Badge variante="neutro" texto="Em dia" />;
}

/**
 * Cartão "Banco de Horas" da tela de Jornada
 * (`stitch_tcc/jornada_home_blue_edition:190-206`): saldo do mês corrente,
 * com atalho para a tela de consulta completa (issue #19). O conteúdo
 * inteiro vai em `conteudo`, nunca em `rodape` — o rodapé do `Cartao` tem
 * fundo claro fixo, incompatível com o fundo escuro (`tom="destaque"`) deste
 * card.
 */
export function CartaoBancoHoras({ bancoHoras, aoAbrirBancoHoras }: PropsCartaoBancoHoras) {
  if (!bancoHoras) return null;

  return (
    <Cartao
      elevacao="elev1"
      tom="destaque"
      conteudo={
        <View style={{ gap: espacamento[16] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Texto variante="labelMd" cor={cores.onSecondary}>
              Banco de Horas
            </Texto>
            <Icone nome="account_balance_wallet" tamanho={espacamento[24]} cor={cores.onSecondary} />
          </View>

          <View style={{ gap: espacamento[8] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[8] }}>
              <Texto variante="headlineMd" cor={cores.onSecondary} tabular>
                {formatarSaldoHoras(bancoHoras.saldo)}
              </Texto>
              {bancoHoras.saldo > 0 && (
                <Icone nome="trending_up" tamanho={espacamento[20]} cor={cores.onSecondary} />
              )}
            </View>
            <SeloSaldo saldo={bancoHoras.saldo} />
          </View>

          {/*
            Não é o `Botao variante="fantasma"`: ele pinta o texto de
            `cores.primary`, que some no fundo escuro. No `secondary` nem o
            azul-claro (`inversePrimary`) tem contraste — o link vai em
            `onSecondary`, marcado pelo peso e pela seta.
          */}
          <Pressable
            accessibilityRole="button"
            onPress={aoAbrirBancoHoras}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: espacamento[4],
              minHeight: espacamento[48],
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Texto variante="titleMd" peso={700} cor={cores.onSecondary}>
              Ver banco de horas
            </Texto>
            <Icone nome="chevron_right" tamanho={espacamento[20]} cor={cores.onSecondary} />
          </Pressable>
        </View>
      }
    />
  );
}
