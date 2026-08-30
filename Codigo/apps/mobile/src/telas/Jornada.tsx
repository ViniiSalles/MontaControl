import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { cores, espacamento, espacamentoNomeado } from '@montacontrol/design-tokens/native';
import type { JornadaDTO } from '@montacontrol/shared';
import { Alerta } from '../ui/Alerta';
import { Botao } from '../ui/Botao';
import { Carregando } from '../ui/Carregando';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';
import { useAuth } from '../auth/AuthContext';
import { registrarCheckin, registrarCheckout } from '../jornada/acoes';
import { avisoDoResultado } from '../jornada/mensagens';
import type { AvisoAcao } from '../jornada/mensagens';
import { derivarUltimoPonto, proximaAcao } from '../jornada/ultimoPonto';
import type { TipoPonto } from '../jornada/ultimoPonto';
import { useJornadaAtual } from '../jornada/useJornadaAtual';
import { CartaoUltimoPonto } from './jornada/CartaoUltimoPonto';

const rotuloBotao: Record<TipoPonto, string> = {
  entrada: 'Bater ponto de entrada',
  saida: 'Bater ponto de saída',
};

interface PropsJornada {
  aoAbrirHistorico: () => void;
  aoLancarEmAtraso: () => void;
}

/**
 * Aba padrão do MONTADOR (`ABA_PADRAO`) e destino de N1T1/TI01 no mobile.
 *
 * A tela responde a duas perguntas, nessa ordem: qual foi o último ponto e
 * qual ponto bater agora. Histórico e ponto em atraso ficam a um toque, mas
 * abaixo do botão principal — o caminho do dedo até "bater o ponto" é o que
 * manda no layout.
 */
export function Jornada({ aoAbrirHistorico, aoLancarEmAtraso }: PropsJornada) {
  const { sessao, sair } = useAuth();

  // `RootNavigator` só monta esta tela com sessão presente; os fallbacks
  // existem para o tipo, não para um estado alcançável.
  const token = sessao?.accessToken ?? '';
  const nome = sessao?.usuario.nome ?? '';

  const { jornada, carregando, erro, recarregar } = useJornadaAtual(token);

  // A jornada devolvida pelo próprio check-in/check-out é mais nova que a do
  // GET e tem precedência até a próxima atualização manual: recarregar logo
  // depois de um check-out traria `null` (não há mais jornada aberta) e
  // apagaria da tela justamente o ponto que o montador acabou de bater.
  const [jornadaRegistrada, setJornadaRegistrada] = useState<JornadaDTO | null>(null);
  const [aviso, setAviso] = useState<AvisoAcao | null>(null);
  const [registrando, setRegistrando] = useState(false);

  const jornadaExibida = jornadaRegistrada ?? jornada;
  const ultimoPonto = derivarUltimoPonto(jornadaExibida);
  const acao = proximaAcao(jornadaExibida);

  const baterPonto = useCallback(async () => {
    setRegistrando(true);
    setAviso(null);
    try {
      const resultado =
        acao === 'saida' ? await registrarCheckout(token) : await registrarCheckin(token);
      if (resultado.tipo === 'ok') setJornadaRegistrada(resultado.jornada);
      setAviso(avisoDoResultado(resultado));
    } finally {
      setRegistrando(false);
    }
  }, [acao, token]);

  const atualizar = useCallback(async () => {
    // Descartar o registro local é o ponto da atualização: a partir daqui
    // quem manda é o servidor de novo.
    setJornadaRegistrada(null);
    setAviso(null);
    await recarregar();
  }, [recarregar]);

  return (
    <Tela rolavel>
      <View style={{ gap: espacamentoNomeado.gapPilha }}>
        <View style={{ gap: espacamento[4] }}>
          <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
            BEM-VINDO
          </Texto>
          <Texto variante="headlineMd">{nome}</Texto>
        </View>

        {carregando && !jornadaExibida ? (
          <View style={{ alignItems: 'center', paddingVertical: espacamento[32] }}>
            <Carregando tamanho={espacamento[32]} />
          </View>
        ) : (
          <CartaoUltimoPonto ponto={ultimoPonto} />
        )}

        {/*
          Falha de leitura NÃO esconde o botão de bater ponto: deixar o
          montador sem registrar por causa de um GET que não voltou é pior
          do que registrar sem saber o estado anterior. Se o palpite estiver
          errado (havia jornada aberta), a API recusa com
          `JORNADA_EM_ANDAMENTO` e o aviso explica o que fazer.
        */}
        {erro && (
          <Alerta
            variante="aviso"
            titulo="Não foi possível carregar sua jornada"
            mensagem="Você ainda pode bater o ponto. Toque em Atualizar para ler o servidor de novo."
          />
        )}

        {aviso && (
          <Alerta variante={aviso.variante} titulo={aviso.titulo} mensagem={aviso.mensagem} />
        )}

        <Botao
          variante="primario"
          tamanho={56}
          forma="pilula"
          texto={rotuloBotao[acao]}
          larguraTotal
          carregando={registrando}
          aoPressionar={() => void baterPonto()}
        />

        <View style={{ flexDirection: 'row', gap: espacamento[12] }}>
          <View style={{ flex: 1 }}>
            <Botao
              variante="tonal"
              tamanho={48}
              forma="pilula"
              texto="Ver histórico"
              larguraTotal
              aoPressionar={aoAbrirHistorico}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Botao
              variante="tonal"
              tamanho={48}
              forma="pilula"
              texto="Ponto em atraso"
              larguraTotal
              aoPressionar={aoLancarEmAtraso}
            />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: espacamento[12] }}>
          <View style={{ flex: 1 }}>
            <Botao
              variante="fantasma"
              tamanho={40}
              forma="pilula"
              texto="Atualizar"
              larguraTotal
              carregando={carregando}
              desabilitado={registrando}
              aoPressionar={() => void atualizar()}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Botao
              variante="fantasma"
              tamanho={40}
              forma="pilula"
              texto="Sair"
              larguraTotal
              aoPressionar={() => void sair()}
            />
          </View>
        </View>
      </View>
    </Tela>
  );
}
