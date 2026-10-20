import { useState } from 'react';
import { View } from 'react-native';
import { cores, espacamento } from '@montacontrol/design-tokens/native';
import { useAuth } from '../../auth/AuthContext';
import { Botao } from '../../ui/Botao';
import { Modal } from '../../ui/Modal';
import { Texto } from '../../ui/Texto';

/**
 * Conta do montador no cabeçalho da Jornada. O "Sair" morava solto no fim da
 * tela, a um toque acidental de deslogar quem só queria rolar até os atalhos;
 * aqui ele fica atrás de um painel que mostra quem está logado.
 */
export function BotaoConta() {
  const { sessao, sair } = useAuth();
  const [aberto, setAberto] = useState(false);
  const usuario = sessao?.usuario;

  return (
    <>
      <Botao
        variante="icone"
        tamanho={40}
        forma="pilula"
        icone="account_circle"
        rotuloAcessivel="Conta"
        aoPressionar={() => setAberto(true)}
      />
      <Modal
        visivel={aberto}
        apresentacao="folha"
        titulo="Sua conta"
        aoFechar={() => setAberto(false)}
        conteudo={
          <View style={{ gap: espacamento[4], paddingBottom: espacamento[8] }}>
            <Texto variante="titleMd">{usuario?.nome ?? ''}</Texto>
            <Texto variante="bodyMd" cor={cores.onSurfaceVariant}>
              {usuario?.email ?? ''}
            </Texto>
          </View>
        }
        acoes={[
          {
            texto: 'Sair',
            variante: 'fantasma',
            aoPressionar: () => {
              setAberto(false);
              void sair();
            },
          },
        ]}
      />
    </>
  );
}
