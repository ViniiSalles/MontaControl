import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { cores, espacamento, espacamentoNomeado } from '@montacontrol/design-tokens/native';
import { estadoJornada } from '@montacontrol/shared';
import type { JornadaDTO } from '@montacontrol/shared';
import { Alerta } from '../ui/Alerta';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Carregando } from '../ui/Carregando';
import { Icone } from '../ui/Icone';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';
import { useAuth } from '../auth/AuthContext';
import { useBancoHoras } from '../banco-horas/useBancoHoras';
import { periodoAtual } from '../banco-horas/periodo';
import { registrarCheckin, registrarCheckout } from '../jornada/acoes';
import { diaCivilDe, formatarDataCompleta, formatarDuracao } from '../jornada/formatacao';
import { avisoDoResultado } from '../jornada/mensagens';
import type { AvisoAcao } from '../jornada/mensagens';
import { minutosTrabalhadosHoje, proximaAcao } from '../jornada/ultimoPonto';
import type { TipoPonto } from '../jornada/ultimoPonto';
import { useHistoricoPontos } from '../jornada/useHistoricoPontos';
import { useJornadaAtual } from '../jornada/useJornadaAtual';
import { BotaoAcaoPrincipal } from './jornada/BotaoAcaoPrincipal';
import { CartaoBancoHoras } from './jornada/CartaoBancoHoras';
import { CartaoUltimoPonto } from './jornada/CartaoUltimoPonto';

const rotuloBotao: Record<TipoPonto, string> = {
  entrada: 'Bater ponto de entrada',
  saida: 'Bater ponto de saída',
};

interface PropsJornada {
  aoAbrirHistorico: () => void;
  aoAbrirBancoHoras: () => void;
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
export function Jornada({ aoAbrirHistorico, aoAbrirBancoHoras, aoLancarEmAtraso }: PropsJornada) {
  const { sessao, sair } = useAuth();

  // `RootNavigator` só monta esta tela com sessão presente; os fallbacks
  // existem para o tipo, não para um estado alcançável.
  const token = sessao?.accessToken ?? '';

  const { jornada, carregando, erro, recarregar } = useJornadaAtual(token);
  // Menor período válido (`PeriodoHistorico`): só precisa alcançar hoje, o
  // resto da janela não é usado aqui — quem quer mais dias vai pro Histórico.
  const { dias: diasHistorico, recarregar: recarregarHistorico } = useHistoricoPontos(token, 5);

  // A jornada devolvida pelo próprio check-in/check-out é mais nova que a do
  // GET e tem precedência até a próxima atualização manual: recarregar logo
  // depois de um check-out traria `null` (não há mais jornada aberta) e
  // apagaria da tela justamente o ponto que o montador acabou de bater.
  const [jornadaRegistrada, setJornadaRegistrada] = useState<JornadaDTO | null>(null);
  const [aviso, setAviso] = useState<AvisoAcao | null>(null);
  const [registrando, setRegistrando] = useState(false);

  const jornadaExibida = jornadaRegistrada ?? jornada;
  // Um único `agora` por render: calcular de novo dentro do cartão poderia
  // deixá-lo em desacordo com o rótulo do botão na virada do limite.
  const agoraIso = new Date().toISOString();
  const hojeCivil = diaCivilDe(agoraIso);
  const { mes: mesAtual, ano: anoAtual } = periodoAtual(agoraIso);
  const { bancoHoras, recarregar: recarregarBancoHoras } = useBancoHoras(token, mesAtual, anoAtual);
  const diaHoje = diasHistorico.find((dia) => dia.data === hojeCivil) ?? null;
  const estado = jornadaExibida ? estadoJornada(jornadaExibida, agoraIso) : 'finalizada';
  const acao = proximaAcao(jornadaExibida, agoraIso);
  const trabalhadasMin = minutosTrabalhadosHoje(diaHoje, jornadaExibida, estado, agoraIso);

  const baterPonto = useCallback(async () => {
    setRegistrando(true);
    setAviso(null);
    try {
      const resultado =
        acao === 'saida' ? await registrarCheckout(token) : await registrarCheckin(token);
      if (resultado.tipo === 'ok') {
        setJornadaRegistrada(resultado.jornada);
        // O turno que acabou de fechar/abrir precisa entrar na soma de hoje
        // assim que o histórico for consultado de novo — sem isto, o próximo
        // turno recalcularia "trabalhadas hoje" com um histórico desatualizado.
        void recarregarHistorico();
      }
      setAviso(avisoDoResultado(resultado));
    } finally {
      setRegistrando(false);
    }
  }, [acao, recarregarHistorico, token]);

  const atualizar = useCallback(async () => {
    // Descartar o registro local é o ponto da atualização: a partir daqui
    // quem manda é o servidor de novo.
    setJornadaRegistrada(null);
    setAviso(null);
    await Promise.all([recarregar(), recarregarHistorico(), recarregarBancoHoras()]);
  }, [recarregar, recarregarHistorico, recarregarBancoHoras]);

  return (
    <Tela rolavel>
      <View style={{ gap: espacamentoNomeado.gapPilha }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: espacamento[12] }}>
          <View style={{ flex: 1, gap: espacamento[4] }}>
            <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
              {formatarDataCompleta(hojeCivil)}
            </Texto>
            <Texto variante="headlineMd">Jornada de Trabalho</Texto>
          </View>
          <Botao
            variante="icone"
            tamanho={40}
            forma="pilula"
            icone="sync"
            rotuloAcessivel="Atualizar"
            carregando={carregando}
            desabilitado={registrando}
            aoPressionar={() => void atualizar()}
          />
        </View>

        {carregando && !jornadaExibida ? (
          <View style={{ alignItems: 'center', paddingVertical: espacamento[32] }}>
            <Carregando tamanho={espacamento[32]} />
          </View>
        ) : (
          <CartaoUltimoPonto jornada={jornadaExibida} estado={estado} />
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

        <BotaoAcaoPrincipal
          texto={rotuloBotao[acao]}
          carregando={registrando}
          aoPressionar={() => void baterPonto()}
        />

        {trabalhadasMin !== null && (
          <Cartao
            elevacao="elev2"
            tom="padrao"
            conteudo={
              <View style={{ gap: espacamento[8] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[8] }}>
                  <Icone nome="schedule" tamanho={espacamento[16]} cor={cores.primary} />
                  <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
                    TRABALHADAS HOJE
                  </Texto>
                </View>
                <Texto variante="headlineMd" tabular>
                  {formatarDuracao(trabalhadasMin)}
                </Texto>
              </View>
            }
          />
        )}

        <CartaoBancoHoras bancoHoras={bancoHoras} aoAbrirBancoHoras={aoAbrirBancoHoras} />

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

        <Botao
          variante="fantasma"
          tamanho={40}
          forma="pilula"
          texto="Sair"
          larguraTotal
          aoPressionar={() => void sair()}
        />
      </View>
    </Tela>
  );
}
