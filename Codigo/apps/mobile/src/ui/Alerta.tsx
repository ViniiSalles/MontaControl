import { View } from 'react-native';
import type { PropsAlerta, VarianteAlerta } from '@montacontrol/ui-contracts/alerta';
import type { NomeIcone } from '@montacontrol/design-tokens/icones';
import { cores, raio, espacamento } from '@montacontrol/design-tokens/native';
import { Texto } from './Texto';
import { Icone } from './Icone';

const iconePorVariante: Record<VarianteAlerta, NomeIcone> = {
  sucesso: 'check_circle',
  aviso: 'warning',
  erro: 'cancel',
  info: 'info',
};

const corPorVariante = {
  sucesso: { fundo: cores.successContainer, texto: cores.onSuccessContainer },
  aviso: { fundo: cores.tertiaryFixed, texto: cores.onTertiaryFixedVariant },
  erro: { fundo: cores.errorContainer, texto: cores.onErrorContainer },
  info: { fundo: cores.primaryFixed, texto: cores.onPrimaryFixedVariant },
} as const;

/**
 * Porta direta de `apps/web/src/ui/Alerta.tsx` — mesma lógica de mapeamento
 * variante -> ícone/cor, `classesPorVariante` (Tailwind) vira objeto de
 * estilo RN. Ver plano §"Fluxos de aceite": `erro` (senha incorreta, N1T2),
 * `aviso` (sessão expirada, TI02; perfil não-Montador negado), `info`/`sucesso`
 * para os demais casos.
 */
export function Alerta({ variante, mensagem, titulo }: PropsAlerta) {
  const cor = corPorVariante[variante];
  return (
    <View
      testID="alerta-container"
      style={{
        flexDirection: 'row',
        gap: espacamento[12],
        backgroundColor: cor.fundo,
        borderRadius: raio.lg,
        padding: espacamento[16],
      }}
    >
      <Icone nome={iconePorVariante[variante]} cor={cor.texto} />
      <View style={{ flex: 1, gap: espacamento[4] }}>
        {titulo && (
          <Texto variante="titleSm" cor={cor.texto}>
            {titulo}
          </Texto>
        )}
        <Texto variante="bodyMd" cor={cor.texto}>
          {mensagem}
        </Texto>
      </View>
    </View>
  );
}
