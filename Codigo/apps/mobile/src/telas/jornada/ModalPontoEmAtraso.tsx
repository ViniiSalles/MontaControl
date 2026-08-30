import { useState } from 'react';
import { View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { cores, espacamento } from '@montacontrol/design-tokens/native';
import { Alerta } from '../../ui/Alerta';
import { Botao } from '../../ui/Botao';
import { CampoTexto } from '../../ui/CampoTexto';
import { Modal } from '../../ui/Modal';
import { Texto } from '../../ui/Texto';
import { ErroApi, enviarSolicitacaoPonto } from '../../jornada/clienteJornadas';
import { diaCivilDe } from '../../jornada/formatacao';
import {
  mascararData,
  mascararHora,
  validarPontoEmAtraso,
} from '../../jornada/pontoEmAtraso';
import type { CamposPontoEmAtraso, ErrosPontoEmAtraso } from '../../jornada/pontoEmAtraso';

interface PropsModalPontoEmAtraso {
  token: string;
  /** Dia (`YYYY-MM-DD`) do card que abriu o formulário; vazio quando aberto pelo botão solto. */
  dataInicial?: string | null;
  aoFechar: () => void;
}

/** `"2026-08-26"` → `"26/08/2026"`, para o campo já abrir preenchido. */
function paraCampoData(data: string | null | undefined): string {
  if (!data) return '';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

/**
 * Formulário de solicitação de ponto em atraso (`POST /api/pontos-em-atraso`).
 *
 * Quem controla a abertura é o pai, montando e desmontando este componente —
 * assim os campos nascem do `dataInicial` no próprio `useState` e não é
 * preciso um `useEffect` para ressincronizar a cada reabertura.
 */
export function ModalPontoEmAtraso({ token, dataInicial, aoFechar }: PropsModalPontoEmAtraso) {
  const [campos, setCampos] = useState<CamposPontoEmAtraso>({
    data: paraCampoData(dataInicial),
    horaInicio: '',
    horaFim: '',
    justificativa: '',
  });
  const [erros, setErros] = useState<ErrosPontoEmAtraso>({});
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);

  const alterar = (campo: keyof CamposPontoEmAtraso, valor: string) => {
    setCampos((atuais) => ({ ...atuais, [campo]: valor }));
    // O erro do campo some assim que ele é editado; manter a mensagem antiga
    // enquanto o montador corrige é o que faz um formulário parecer travado.
    setErros((atuais) => ({ ...atuais, [campo]: undefined }));
  };

  async function enviar(): Promise<void> {
    const { erros: encontrados, dados } = validarPontoEmAtraso(
      campos,
      diaCivilDe(new Date().toISOString()),
    );
    setErros(encontrados);
    if (!dados) return;

    setEnviando(true);
    setFalha(null);
    try {
      await enviarSolicitacaoPonto(token, { idCliente: randomUUID(), ...dados });
      setEnviada(true);
    } catch (erro) {
      setFalha(
        erro instanceof ErroApi
          ? erro.message
          : 'A solicitação não chegou ao servidor. Verifique a internet e tente de novo.',
      );
    } finally {
      setEnviando(false);
    }
  }

  const conteudoEnviado = (
    <View style={{ gap: espacamento[16], paddingBottom: espacamento[24] }}>
      <Alerta
        variante="sucesso"
        titulo="Solicitação enviada"
        mensagem="Seu gestor vai analisar o pedido. O ponto entra no histórico assim que for aprovado."
      />
      <Botao
        variante="primario"
        tamanho={48}
        forma="pilula"
        texto="Fechar"
        larguraTotal
        aoPressionar={aoFechar}
      />
    </View>
  );

  const formulario = (
    <View style={{ gap: espacamento[16], paddingBottom: espacamento[24] }}>
      <Texto variante="bodyMd" cor={cores.onSurfaceVariant}>
        Use este pedido quando não deu para bater o ponto na hora. O gestor precisa aprovar.
      </Texto>

      <CampoTexto
        rotulo="Data"
        valor={campos.data}
        aoAlterar={(valor) => alterar('data', mascararData(valor))}
        tipo="numero"
        placeholder="DD/MM/AAAA"
        erro={erros.data}
        obrigatorio
      />

      <View style={{ flexDirection: 'row', gap: espacamento[16] }}>
        <View style={{ flex: 1 }}>
          <CampoTexto
            rotulo="Entrada"
            valor={campos.horaInicio}
            aoAlterar={(valor) => alterar('horaInicio', mascararHora(valor))}
            tipo="numero"
            placeholder="08:00"
            erro={erros.horaInicio}
            obrigatorio
          />
        </View>
        <View style={{ flex: 1 }}>
          <CampoTexto
            rotulo="Saída"
            valor={campos.horaFim}
            aoAlterar={(valor) => alterar('horaFim', mascararHora(valor))}
            tipo="numero"
            placeholder="17:00"
            erro={erros.horaFim}
            obrigatorio
          />
        </View>
      </View>

      <CampoTexto
        rotulo="Justificativa"
        valor={campos.justificativa}
        aoAlterar={(valor) => alterar('justificativa', valor)}
        placeholder="O que impediu de bater o ponto na hora"
        erro={erros.justificativa}
        ajuda="O gestor decide só com este texto."
        obrigatorio
      />

      {falha && <Alerta variante="erro" titulo="Não foi possível enviar" mensagem={falha} />}

      <Botao
        variante="primario"
        tamanho={48}
        forma="pilula"
        texto="Enviar solicitação"
        larguraTotal
        carregando={enviando}
        aoPressionar={() => void enviar()}
      />
      <Botao
        variante="fantasma"
        tamanho={40}
        forma="pilula"
        texto="Cancelar"
        larguraTotal
        desabilitado={enviando}
        aoPressionar={aoFechar}
      />
    </View>
  );

  return (
    <Modal
      visivel
      apresentacao="folha"
      titulo="Ponto em atraso"
      conteudo={enviada ? conteudoEnviado : formulario}
      aoFechar={aoFechar}
    />
  );
}
