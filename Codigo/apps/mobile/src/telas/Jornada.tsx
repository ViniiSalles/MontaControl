import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Q } from '@nozbe/watermelondb';
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
import { AcaoPendente } from '../db/AcaoPendente';
import { useDatabaseOuFalha } from '../db/useDatabase';
import { registrarCheckin, registrarCheckout } from '../jornada/acoes';
import { diaCivilDe, formatarDataCompleta, formatarDuracao } from '../jornada/formatacao';
import { avisoDoResultado } from '../jornada/mensagens';
import type { AvisoAcao } from '../jornada/mensagens';
import { minutosTrabalhadosHoje, proximaAcao } from '../jornada/ultimoPonto';
import type { TipoPonto } from '../jornada/ultimoPonto';
import { useHistoricoPontos } from '../jornada/useHistoricoPontos';
import { useJornadaAtual } from '../jornada/useJornadaAtual';
import { lembrarObraDaJornada, lerObraDaJornada } from '../pedidos/obrasLocais';
import { useObrasDoMontador } from '../pedidos/useObrasDoMontador';
import { iniciarSincronizacao } from '../sincronizacao/syncManager';
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

  // `RootNavigator` só monta esta tela com sessão presente; o token vem da
  // fonte única (`auth/tokenSessao`), buscado a cada sincronização.
  useEffect(() => iniciarSincronizacao(database), [database]);

  const [pendentes, setPendentes] = useState(0);
  const [avisosDescartados, setAvisosDescartados] = useState<string[]>([]);

  useEffect(() => {
    const colecao = database.get<AcaoPendente>('acoes_pendentes');

    const assinaturaPendentes = colecao
      .query(Q.where('status', 'pendente'))
      .observeCount()
      .subscribe(setPendentes);

    const assinaturaDescartadas = colecao
      .query(Q.where('status', 'descartada'))
      .observe()
      .subscribe((registros) => {
        if (registros.length === 0) return;
        setAvisosDescartados(registros.map((registro) => registro.mensagemDescarte ?? ''));
        void database.write(() =>
          database.batch(...registros.map((registro) => registro.prepareDestroyPermanently())),
        );
      });

    return () => {
      assinaturaPendentes.unsubscribe();
      assinaturaDescartadas.unsubscribe();
    };
  }, [database]);

  const { jornada, carregando, erro, recarregar } = useJornadaAtual();
  // Menor período válido (`PeriodoHistorico`): só precisa alcançar hoje, o
  // resto da janela não é usado aqui — quem quer mais dias vai pro Histórico.
  const { dias: diasHistorico, recarregar: recarregarHistorico } = useHistoricoPontos(5);

  // A jornada devolvida pelo próprio check-in/check-out é mais nova que a do
  // GET e tem precedência até a próxima atualização manual: recarregar logo
  // depois de um check-out traria `null` (não há mais jornada aberta) e
  // apagaria da tela justamente o ponto que o montador acabou de bater.
  const [jornadaRegistrada, setJornadaRegistrada] = useState<JornadaDTO | null>(null);

  const {
    obras,
    carregando: carregandoObras,
    recarregar: recarregarObras,
  } = useObrasDoMontador(database);
  const [obraEscolhidaId, setObraEscolhidaId] = useState<number | null>(null);
  // Com uma obra só, não há o que escolher.
  const obraEntradaId = obraEscolhidaId ?? (obras.length === 1 ? obras[0].id : null);
  const obraEntrada = obras.find((obra) => obra.id === obraEntradaId) ?? null;

  // Obra do check-in da jornada aberta, guardada no aparelho para a saída.
  const [obraDaJornadaId, setObraDaJornadaId] = useState<number | null>(null);
  const obraDaJornada = obras.find((obra) => obra.id === obraDaJornadaId) ?? null;
  useEffect(() => {
    void lerObraDaJornada(database)
      .then(setObraDaJornadaId)
      .catch(() => undefined);
  }, [database]);

  const [aviso, setAviso] = useState<AvisoAcao | null>(null);
  const [registrando, setRegistrando] = useState(false);

  const jornadaExibida = jornadaRegistrada ?? jornada;
  // Um único `agora` por render: calcular de novo dentro do cartão poderia
  // deixá-lo em desacordo com o rótulo do botão na virada do limite.
  const agoraIso = new Date().toISOString();
  const hojeCivil = diaCivilDe(agoraIso);
  const { mes: mesAtual, ano: anoAtual } = periodoAtual(agoraIso);
  const { bancoHoras, recarregar: recarregarBancoHoras } = useBancoHoras(mesAtual, anoAtual);
  const diaHoje = diasHistorico.find((dia) => dia.data === hojeCivil) ?? null;
  const estado = jornadaExibida ? estadoJornada(jornadaExibida, agoraIso) : 'finalizada';
  const acao = proximaAcao(jornadaExibida, agoraIso);
  const trabalhadasMin = minutosTrabalhadosHoje(diaHoje, jornadaExibida, estado, agoraIso);

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
        setJornadaRegistrada(resultado.jornada);
        if (acao === 'entrada' && obraEntrada) {
          setObraDaJornadaId(obraEntrada.id);
          void lembrarObraDaJornada(database, obraEntrada.id).catch(() => undefined);
        }
        // O turno que acabou de fechar/abrir precisa entrar na soma de hoje
        // assim que o histórico for consultado de novo — sem isto, o próximo
        // turno recalcularia "trabalhadas hoje" com um histórico desatualizado.
        void recarregarHistorico();
        void recarregarBancoHoras();
      }
      setAviso(avisoDoResultado(resultado));
    } finally {
      setRegistrando(false);
    }
  }, [acao, database, obraDaJornada, obraEntrada, recarregarHistorico, recarregarBancoHoras]);

  const atualizar = useCallback(async () => {
    // Descartar o registro local é o ponto da atualização: a partir daqui
    // quem manda é o servidor de novo.
    setJornadaRegistrada(null);
    setAviso(null);
    await Promise.all([recarregar(), recarregarHistorico(), recarregarBancoHoras(), recarregarObras()]);
  }, [recarregar, recarregarHistorico, recarregarBancoHoras, recarregarObras]);

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
          <CartaoUltimoPonto
            jornada={jornadaExibida}
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

        {avisosDescartados.map((mensagem, indice) => (
          <Alerta
            key={`${mensagem}-${indice}`}
            variante="erro"
            titulo="Uma ação não foi sincronizada"
            mensagem={mensagem}
          />
        ))}

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
