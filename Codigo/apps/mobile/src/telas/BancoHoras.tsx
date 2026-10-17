import { useState } from 'react';
import { View } from 'react-native';
import { cores, espacamento, espacamentoNomeado } from '@montacontrol/design-tokens/native';
import { Alerta } from '../ui/Alerta';
import { Badge } from '../ui/Badge';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Carregando } from '../ui/Carregando';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';
import { formatarHoras, formatarMesAno, formatarSaldoHoras } from '../banco-horas/formatacao';
import { ehMesCorrente, mesAnterior, mesSeguinte, periodoAtual } from '../banco-horas/periodo';
import type { Periodo } from '../banco-horas/periodo';
import { useBancoHoras } from '../banco-horas/useBancoHoras';

interface PropsBancoHoras {
  aoVoltar: () => void;
}

/** Mesmo padrão de `SeloSaldo` em `CartaoBancoHoras.tsx` (Task 5) — mantido igual de propósito. */
function SeloSaldo({ saldo }: { saldo: number }) {
  if (saldo > 0) return <Badge variante="sucesso" texto="Saldo positivo" />;
  if (saldo < 0) return <Badge variante="erro" texto="Saldo negativo" />;
  return <Badge variante="neutro" texto="Em dia" />;
}

/** Consulta do banco de horas por mês (issue #19). Não deixa navegar além do mês corrente. */
export function BancoHoras({ aoVoltar }: PropsBancoHoras) {
  const agoraIso = new Date().toISOString();
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoAtual(agoraIso));
  const { bancoHoras, carregando, erro, recarregar } = useBancoHoras(periodo.mes, periodo.ano);
  const noMesCorrente = ehMesCorrente(periodo, agoraIso);

  return (
    <Tela rolavel>
      <View style={{ gap: espacamentoNomeado.gapPilha }}>
        <View style={{ gap: espacamento[4] }}>
          <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
            JORNADA
          </Texto>
          <Texto variante="headlineMd">Banco de horas</Texto>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Botao
            variante="icone"
            tamanho={40}
            forma="pilula"
            icone="chevron_left"
            rotuloAcessivel="Mês anterior"
            aoPressionar={() => setPeriodo((atual) => mesAnterior(atual))}
          />
          <Texto variante="titleMd">{formatarMesAno(periodo.mes, periodo.ano)}</Texto>
          <Botao
            variante="icone"
            tamanho={40}
            forma="pilula"
            icone="chevron_right"
            rotuloAcessivel="Próximo mês"
            desabilitado={noMesCorrente}
            aoPressionar={() => setPeriodo((atual) => mesSeguinte(atual))}
          />
        </View>

        {carregando ? (
          <View style={{ alignItems: 'center', paddingVertical: espacamento[32] }}>
            <Carregando tamanho={espacamento[32]} />
          </View>
        ) : erro ? (
          <>
            <Alerta
              variante="erro"
              titulo="Não foi possível carregar o banco de horas"
              mensagem="Verifique a internet e tente de novo."
            />
            <Botao
              variante="tonal"
              tamanho={48}
              forma="pilula"
              texto="Tentar de novo"
              larguraTotal
              aoPressionar={() => void recarregar()}
            />
          </>
        ) : (
          bancoHoras && (
            <Cartao
              elevacao="elev1"
              tom="baixo"
              conteudo={
                <View style={{ gap: espacamento[16] }}>
                  <View style={{ gap: espacamento[4] }}>
                    <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
                      SALDO DO MÊS
                    </Texto>
                    <Texto variante="headlineLg" tabular>
                      {formatarSaldoHoras(bancoHoras.saldo)}
                    </Texto>
                    <SeloSaldo saldo={bancoHoras.saldo} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: espacamento[24] }}>
                    <View style={{ gap: espacamento[4] }}>
                      <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
                        TRABALHADAS
                      </Texto>
                      <Texto variante="titleLg" tabular>
                        {formatarHoras(bancoHoras.horasTrabalhadas)}
                      </Texto>
                    </View>
                    <View style={{ gap: espacamento[4] }}>
                      <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
                        PREVISTAS
                      </Texto>
                      <Texto variante="titleLg" tabular>
                        {formatarHoras(bancoHoras.horasPrevistas)}
                      </Texto>
                    </View>
                  </View>
                </View>
              }
            />
          )
        )}

        <Botao
          variante="fantasma"
          tamanho={48}
          forma="pilula"
          texto="Voltar"
          larguraTotal
          aoPressionar={aoVoltar}
        />
      </View>
    </Tela>
  );
}
