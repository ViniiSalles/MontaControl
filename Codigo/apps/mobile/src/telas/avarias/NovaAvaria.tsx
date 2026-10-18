import { useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import type { PedidoDoMontadorDTO, TipoAvariaDTO } from '@montacontrol/shared';
import { cores, espacamento, raio } from '@montacontrol/design-tokens/native';
import { Alerta } from '../../ui/Alerta';
import { Botao } from '../../ui/Botao';
import { CampoTexto } from '../../ui/CampoTexto';
import { Cartao } from '../../ui/Cartao';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';
import { useDatabaseOuFalha } from '../../db/useDatabase';
import { mimeTypeSuportado, uriDaFoto } from '../../fotos/armazenamentoFotos';
import { useRascunhoDeAvaria } from '../../avarias/useRascunhoDeAvaria';
import { MAXIMO_FOTOS, validarReporteAvaria } from '../../avarias/validarReporteAvaria';
import type { CamposReporteAvaria, ErrosReporteAvaria } from '../../avarias/validarReporteAvaria';
import { ErroAoEnfileirar, executarAcaoAvaria } from '../../sincronizacao/outbox';
import { Opcao } from './Opcao';

interface PropsNovaAvaria {
  pedidos: PedidoDoMontadorDTO[];
  tipos: TipoAvariaDTO[];
  /** Reporte aceito (enviado ou na fila) — o pai mostra o aviso e recarrega o histórico. */
  aoEnviado: (aviso: string) => void;
  /** Um novo envio começou (validação ok) — o pai limpa avisos anteriores. */
  aoIniciarEnvio?: () => void;
}

const TAMANHO_MINIATURA = espacamento[80];
/** Sem `base64`: a foto vira arquivo no aparelho e só é convertida na hora do envio. */
const OPCOES_PICKER = { quality: 0.7, allowsMultipleSelection: false } as const;

function Secao({ titulo, erro, children }: { titulo: string; erro?: string; children: ReactNode }) {
  return (
    <View style={{ gap: espacamento[8] }}>
      <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
        {titulo}
      </Texto>
      {children}
      {erro && (
        <Texto variante="labelMd" cor={cores.error}>
          {erro}
        </Texto>
      )}
    </View>
  );
}

/** Recusa e falha de registro apagam as fotos (a fila não as guarda): o montador precisa saber. */
function comAvisoDeFotos(mensagem: string, tinhaFotos: boolean): string {
  return tinhaFotos
    ? `${mensagem}
As fotos anexadas foram descartadas; anexe de novo se precisar.`
    : mensagem;
}

/** Reporte de problema na peça pelo montador — entra na outbox, então funciona sem sinal. */
export function NovaAvaria({ pedidos, tipos, aoEnviado, aoIniciarEnvio }: PropsNovaAvaria) {
  const database = useDatabaseOuFalha();
  // Pedido, campos e fotos vivem no rascunho persistido: sobrevivem a trocar de aba e a fechar o app.
  const rascunho = useRascunhoDeAvaria();
  const [erros, setErros] = useState<ErrosReporteAvaria>({});
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  // O rascunho pode ter ids de uma réplica anterior (pedido, peça ou tipo que
  // deixou de existir): só vale o que ainda está na lista.
  const pedidoEscolhido = pedidos.some((candidato) => candidato.id === rascunho.pedidoEscolhido)
    ? rascunho.pedidoEscolhido
    : null;
  // Com um pedido só, não há o que escolher.
  const pedidoId = pedidoEscolhido ?? (pedidos.length === 1 ? pedidos[0].id : null);
  const pedido = pedidos.find((candidato) => candidato.id === pedidoId) ?? null;
  const campos: CamposReporteAvaria = {
    ...rascunho.campos,
    pecaId: pedido?.ambientes.some((ambiente) =>
      ambiente.pecas.some((peca) => peca.id === rascunho.campos.pecaId),
    )
      ? rascunho.campos.pecaId
      : null,
    tipoAvariaId: tipos.some((tipo) => tipo.id === rascunho.campos.tipoAvariaId)
      ? rascunho.campos.tipoAvariaId
      : null,
  };

  function alterar<C extends keyof CamposReporteAvaria>(campo: C, valor: CamposReporteAvaria[C]) {
    rascunho.alterar(campo, valor);
    const chaveErro = campo === 'pecaId' ? 'peca' : campo === 'tipoAvariaId' ? 'tipo' : 'descricao';
    setErros((atuais) => ({ ...atuais, [chaveErro]: undefined }));
  }

  async function adicionarFoto(origem: 'camera' | 'galeria') {
    const permissao =
      origem === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) {
      setFalha('Sem permissão de acesso. Ative nas configurações do aparelho.');
      return;
    }

    const resultado =
      origem === 'camera'
        ? await ImagePicker.launchCameraAsync(OPCOES_PICKER)
        : await ImagePicker.launchImageLibraryAsync({
            ...OPCOES_PICKER,
            preferredAssetRepresentationMode:
              ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
          });
    if (resultado.canceled) return;

    const [asset] = resultado.assets;
    const mimeType = mimeTypeSuportado(asset.mimeType);
    if (!mimeType) {
      setFalha('Não foi possível usar essa foto. Tente outra.');
      return;
    }

    try {
      await rascunho.adicionarFoto(asset.uri, mimeType);
    } catch {
      setFalha('Não foi possível guardar essa foto. Tente outra.');
      return;
    }
    setErros((atuais) => ({ ...atuais, fotos: undefined }));
  }

  function aoTocarAdicionarFoto() {
    Alert.alert('Adicionar foto', undefined, [
      { text: 'Tirar foto', onPress: () => void adicionarFoto('camera') },
      { text: 'Escolher da galeria', onPress: () => void adicionarFoto('galeria') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function enviar(): Promise<void> {
    const { erros: encontrados, dados } = validarReporteAvaria(campos, rascunho.caminhos);
    setErros(encontrados);
    if (!dados) return;

    aoIniciarEnvio?.();
    setEnviando(true);
    setFalha(null);
    // As fotos passam a ser da fila ao chamar o outbox: o formulário as solta
    // JÁ, antes da rede. Se a tela fechar com o envio pendurado, o cleanup do
    // formulário não pode apagar arquivos que a linha da fila referencia.
    const tinhaFotos = rascunho.caminhos.length > 0;
    rascunho.esquecerFotos();
    try {
      const resultado = await executarAcaoAvaria(database, { idCliente: randomUUID(), ...dados });
      if (resultado.tipo === 'recusado') {
        setFalha(comAvisoDeFotos(resultado.mensagem, tinhaFotos));
        return;
      }
      rascunho.limparCampos();
      aoEnviado(
        resultado.tipo === 'enviada'
          ? 'Problema enviado. O gestor vai analisar.'
          : 'Sem conexão agora: o problema foi salvo e será enviado automaticamente.',
      );
    } catch (erro) {
      // Só o enfileiramento que falhou apagou as fotos; qualquer outra falha deixa a linha (e as fotos) na fila.
      const mensagem = 'Não foi possível registrar o problema. Tente de novo.';
      setFalha(erro instanceof ErroAoEnfileirar ? comAvisoDeFotos(mensagem, tinhaFotos) : mensagem);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Cartao
      elevacao="elev1"
      tom="padrao"
      conteudo={
        <View style={{ gap: espacamento[20] }}>
          {/* Sempre visível, mesmo com um pedido só: é como o montador confere a obra. */}
          <Secao titulo="PEDIDO">
            {pedidos.map((candidato) => (
              <Opcao
                key={candidato.id}
                forma="linha"
                rotulo={`${candidato.numeroPedido} · ${candidato.cliente.nome}`}
                detalhe={`${candidato.cliente.endereco} · ${candidato.cliente.cidade}/${candidato.cliente.estado}`}
                selecionada={candidato.id === pedidoId}
                aoPressionar={() => rascunho.escolherPedido(candidato.id)}
              />
            ))}
          </Secao>

          <Secao titulo={pedido ? `PEÇA · ${pedido.numeroPedido}` : 'PEÇA'} erro={erros.peca}>
            {!pedido ? (
              <Texto variante="bodyMd" cor={cores.onSurfaceVariant}>
                Escolha o pedido para ver as peças.
              </Texto>
            ) : pedido.ambientes.length === 0 ? (
              <Texto variante="bodyMd" cor={cores.onSurfaceVariant}>
                Este pedido ainda não tem peças cadastradas.
              </Texto>
            ) : (
              pedido.ambientes.map((ambiente) => (
                <View key={ambiente.id} style={{ gap: espacamento[6] }}>
                  <Texto variante="titleSm">{ambiente.nome}</Texto>
                  {ambiente.pecas.map((peca) => (
                    <Opcao
                      key={peca.id}
                      forma="linha"
                      rotulo={peca.descricao}
                      detalhe={[`${peca.quantidade} un.`, peca.codigoBarras]
                        .filter(Boolean)
                        .join(' · ')}
                      selecionada={campos.pecaId === peca.id}
                      aoPressionar={() => alterar('pecaId', peca.id)}
                    />
                  ))}
                </View>
              ))
            )}
          </Secao>

          <Secao titulo="PROBLEMA" erro={erros.tipo}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacamento[8] }}>
              {tipos.map((tipo) => (
                <Opcao
                  key={tipo.id}
                  rotulo={tipo.nome}
                  selecionada={campos.tipoAvariaId === tipo.id}
                  aoPressionar={() => alterar('tipoAvariaId', tipo.id)}
                />
              ))}
            </View>
          </Secao>

          <CampoTexto
            rotulo="Descrição"
            valor={campos.descricao}
            aoAlterar={(valor) => alterar('descricao', valor)}
            placeholder="O que aconteceu com a peça?"
            erro={erros.descricao}
            multilinha
            obrigatorio
          />

          {rascunho.caminhos.length < MAXIMO_FOTOS && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fotografar problema"
              onPress={aoTocarAdicionarFoto}
              style={{
                alignItems: 'center',
                gap: espacamento[8],
                padding: espacamento[20],
                borderRadius: raio.lg,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: cores.outlineVariant,
                backgroundColor: cores.primaryFixed,
              }}
            >
              <Icone nome="add_a_photo" cor={cores.primary} />
              <Texto variante="titleMd">Fotografar problema</Texto>
              <Texto variante="bodySm" cor={cores.onSurfaceVariant}>
                Opcional · até {MAXIMO_FOTOS} fotos
              </Texto>
            </Pressable>
          )}

          {rascunho.caminhos.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacamento[8] }}>
              {rascunho.caminhos.map((caminho, indice) => (
                <View key={caminho} style={{ width: TAMANHO_MINIATURA, height: TAMANHO_MINIATURA }}>
                  <Image
                    source={{ uri: uriDaFoto(caminho) }}
                    accessibilityLabel={`Foto ${indice + 1} do problema`}
                    style={{ width: '100%', height: '100%', borderRadius: raio.md }}
                  />
                  <Pressable
                    accessibilityLabel={`Remover foto ${indice + 1}`}
                    disabled={enviando}
                    onPress={() => void rascunho.remover(indice)}
                    style={{
                      position: 'absolute',
                      top: -espacamento[6],
                      right: -espacamento[6],
                      backgroundColor: cores.surfaceContainerLowest,
                      borderRadius: raio.full,
                    }}
                  >
                    <Icone nome="close" tamanho={espacamento[20]} cor={cores.error} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          {erros.fotos && (
            <Texto variante="labelMd" cor={cores.error}>
              {erros.fotos}
            </Texto>
          )}

          {falha && <Alerta variante="erro" titulo="Não foi possível enviar" mensagem={falha} />}

          <Botao
            variante="primario"
            tamanho={48}
            forma="pilula"
            texto="Enviar problema"
            larguraTotal
            carregando={enviando}
            aoPressionar={() => void enviar()}
          />

          {rascunho.temConteudo && !enviando && (
            <Botao
              variante="fantasma"
              tamanho={40}
              forma="pilula"
              texto="Descartar rascunho"
              larguraTotal
              aoPressionar={() => void rascunho.descartar()}
            />
          )}
        </View>
      }
    />
  );
}
