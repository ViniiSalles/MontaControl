import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { cores, espacamento, espacamentoNomeado } from '@montacontrol/design-tokens/native';
import { estadoJornada } from '@montacontrol/shared';
import { Alerta } from '../ui/Alerta';
import { AvisosDeAcoesRecusadas } from './AvisosDeAcoesRecusadas';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Carregando } from '../ui/Carregando';
import { Icone } from '../ui/Icone';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';
import { useAuth } from '../auth/AuthContext';
import { useBancoHoras } from '../banco-horas/useBancoHoras';
import { periodoAtual } from '../banco-horas/periodo';
import { useDatabaseOuFalha } from '../db/useDatabase';
import { registrarCheckin, registrarCheckout } from '../jornada/acoes';
import { diaCivilDe, formatarDataCompleta, formatarDuracao } from '../jornada/formatacao';
import { avisoDoResultado } from '../jornada/mensagens';
import type { AvisoAcao } from '../jornada/mensagens';
import { minutosTrabalhadosHoje, proximaAcao } from '../jornada/ultimoPonto';
import type { TipoPonto } from '../jornada/ultimoPonto';
import { useHistoricoPontos } from '../jornada/useHistoricoPontos';
import { useJornadaAtual } from '../jornada/useJornadaAtual';
import { useObrasDoMontador } from '../pedidos/useObrasDoMontador';
import { useSincronizacaoStore } from '../estado/sincronizacaoStore';
import { BotaoAcaoPrincipal } from './jornada/BotaoAcaoPrincipal';
import { CartaoBancoHoras } from './jornada/CartaoBancoHoras';
import { CartaoUltimoPonto } from './jornada/CartaoUltimoPonto';
import { descreverObra, SeletorObra } from './jornada/SeletorObra';

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
  const { sair } = useAuth();

  const database = useDatabaseOuFalha();

  // A sincronização automática (`useSincronizacaoDoApp`) e o status da fila vêm
  // do app autenticado; esta tela só lê o store.
  const pendentes = useSincronizacaoStore((estado) => estado.pendentes);
  const dispensarAvisos = useSincronizacaoStore((estado) => estado.dispensarAvisos);
  const erroDeSincronizacao = useSincronizacaoStore((estado) => estado.ultimoErro);

  const { jornada, carregando, erro } = useJornadaAtual();
  // Menor período válido (`PeriodoHistorico`): só precisa alcançar hoje, o
  // resto da janela não é usado aqui — quem quer mais dias vai pro Histórico.
  const { dias: diasHistorico } = useHistoricoPontos(5);

  const { obras, carregando: carregandoObras } = useObrasDoMontador(database);
  const [obraEscolhidaId, setObraEscolhidaId] = useState<number | null>(null);
  // Com uma obra só, não há o que escolher.
  const obraEntradaId = obraEscolhidaId ?? (obras.length === 1 ? obras[0].id : null);
  const obraEntrada = obras.find((obra) => obra.id === obraEntradaId) ?? null;

  // Obra do check-in da jornada aberta (`jornadas.pedido_id`, ou o pedido da
  // ação ainda na fila): a saída é validada contra ela, também sem rede.
  const obraDaJornada = obras.find((obra) => obra.id === jornada?.pedidoId) ?? null;

  const [aviso, setAviso] = useState<AvisoAcao | null>(null);
  const [registrando, setRegistrando] = useState(false);

  // Um único `agora` por render: calcular de novo dentro do cartão poderia
  // deixá-lo em desacordo com o rótulo do botão na virada do limite.
  const agoraIso = new Date().toISOString();
  const hojeCivil = diaCivilDe(agoraIso);
  const { mes: mesAtual, ano: anoAtual } = periodoAtual(agoraIso);
  // Todos os dados da tela saem do mesmo pull: o `recarregar` do banco de horas
  // sincroniza (e refaz a consulta do mês, se ele não estiver na réplica).
  const { bancoHoras, recarregar: sincronizarAgora } = useBancoHoras(mesAtual, anoAtual);
  const diaHoje = diasHistorico.find((dia) => dia.data === hojeCivil) ?? null;
  const estado = jornada ? estadoJornada(jornada, agoraIso) : 'finalizada';
  const acao = proximaAcao(jornada, agoraIso);
  const trabalhadasMin = minutosTrabalhadosHoje(diaHoje, jornada, estado, agoraIso);

  const baterPonto = useCallback(async () => {
    const registrar =
      acao === 'saida'
        ? () => registrarCheckout(database, obraDaJornada)
        : obraEntrada && (() => registrarCheckin(database, obraEntrada));
    if (!registrar) {
      setAviso({
        variante: 'aviso',
        titulo: 'Escolha a obra',
        mensagem: 'Selecione em qual obra você está antes de bater o ponto de entrada.',
      });
      return;
    }
    setRegistrando(true);
    setAviso(null);
    try {
      const resultado = await registrar();
      if (resultado.tipo === 'ok') {
        // A marcação já está na tela (a ação fica na fila e a sobreposição a
        // mostra); o pull traz a jornada definitiva, o histórico de hoje e o
        // saldo do mês — sem rede, a tentativa falha e a fila segue pendente.
        void sincronizarAgora();
      }
      setAviso(avisoDoResultado(resultado));
    } finally {
      setRegistrando(false);
    }
  }, [acao, database, obraDaJornada, obraEntrada, sincronizarAgora]);

  const atualizar = useCallback(async () => {
    setAviso(null);
    dispensarAvisos();
    await sincronizarAgora();
  }, [dispensarAvisos, sincronizarAgora]);

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

        {carregando && !jornada ? (
          <View style={{ alignItems: 'center', paddingVertical: espacamento[32] }}>
            <Carregando tamanho={espacamento[32]} />
          </View>
        ) : (
          <CartaoUltimoPonto
            jornada={jornada}
            estado={estado}
            pendenteSincronizacao={pendentes > 0}
          />
        )}

        {/*
          Falha de leitura NÃO esconde o botão de bater ponto: deixar o
          montador sem registrar por causa de um GET que não voltou é pior
          do que registrar sem saber o estado anterior. Se o palpite estiver
          errado (havia jornada aberta), a API recusa com
          `JORNADA_EM_ANDAMENTO` e o aviso explica o que fazer.
        */}
        {erroDeSincronizacao === 'versao_incompativel' && (
          <Alerta
            variante="aviso"
            titulo="Atualize o aplicativo"
            mensagem="Esta versão do app não sincroniza mais com o servidor. Atualize o aplicativo; os pontos que você marcar continuam guardados no aparelho."
          />
        )}

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

        <AvisosDeAcoesRecusadas />

        {acao === 'entrada' ? (
          <SeletorObra
            obras={obras}
            selecionadaId={obraEntradaId}
            aoSelecionar={setObraEscolhidaId}
            carregando={carregandoObras}
          />
        ) : (
          obraDaJornada && (
            <Texto variante="bodyMd" cor={cores.onSurfaceVariant}>
              Obra: {obraDaJornada.cliente.nome} · {descreverObra(obraDaJornada)}
            </Texto>
          )
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
