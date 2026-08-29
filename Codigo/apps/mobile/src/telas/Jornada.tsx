import { View } from 'react-native';
import { cores, espacamento, espacamentoNomeado } from '@montacontrol/design-tokens/native';
import { Badge } from '../ui/Badge';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';
import { useAuth } from '../auth/AuthContext';

/**
 * Aba padrão do MONTADOR (`ABA_PADRAO`) e destino de N1T1/TI01 no mobile.
 *
 * Escopo da Sprint 1: provar que a sessão chegou íntegra até a tela inicial
 * — nome e perfil vêm de `GET /api/auth/me`, não de nada guardado no
 * aparelho. Check-in/check-out com GPS e o card de jornada em andamento são
 * da Sprint 2, junto do WatermelonDB (#7).
 */
export function Jornada() {
  const { sessao, sair } = useAuth();

  // `RootNavigator` só monta esta tela com sessão presente; o fallback
  // existe para o tipo, não para um estado alcançável.
  const nome = sessao?.usuario.nome ?? '';

  return (
    <Tela rolavel>
      <View style={{ gap: espacamentoNomeado.gapPilha }}>
        <View style={{ gap: espacamento[4] }}>
          <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
            BEM-VINDO
          </Texto>
          <Texto variante="headlineMd">{nome}</Texto>
        </View>

        <Cartao
          elevacao="elev2"
          tom="padrao"
          conteudo={
            <View style={{ gap: espacamento[12] }}>
              <Badge variante="info" texto="Montador" />
              <Texto variante="titleLg">Nenhuma jornada em andamento</Texto>
              <Texto variante="bodyMd" cor={cores.onSurfaceVariant}>
                O check-in com registro de localização chega na Sprint 2.
              </Texto>
            </View>
          }
        />

        <Botao
          variante="fantasma"
          tamanho={48}
          forma="pilula"
          texto="Sair"
          larguraTotal
          aoPressionar={() => void sair()}
        />
      </View>
    </Tela>
  );
}
