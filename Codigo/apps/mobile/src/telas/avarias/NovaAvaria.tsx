import { useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import type { FotoBase64, PedidoDoMontadorDTO, TipoAvariaDTO } from '@montacontrol/shared';
import { cores, espacamento, raio } from '@montacontrol/design-tokens/native';
import { Alerta } from '../../ui/Alerta';
import { Botao } from '../../ui/Botao';
import { CampoTexto } from '../../ui/CampoTexto';
import { Cartao } from '../../ui/Cartao';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';
import { useDatabaseOuFalha } from '../../db/useDatabase';
import { paraFotoBase64 } from '../../atestados/fotoParaBase64';
import { MAXIMO_FOTOS, validarReporteAvaria } from '../../avarias/validarReporteAvaria';
import type { CamposReporteAvaria, ErrosReporteAvaria } from '../../avarias/validarReporteAvaria';
import { executarAcaoAvaria } from '../../sincronizacao/outbox';
import { Opcao } from './Opcao';

interface PropsNovaAvaria {
  pedidos: PedidoDoMontadorDTO[];
  tipos: TipoAvariaDTO[];
  /** Reporte aceito (enviado ou na fila) — o pai mostra o aviso e recarrega o histórico. */
  aoEnviado: (aviso: string) => void;
  /** Um novo envio começou (validação ok) — o pai limpa avisos anteriores. */
  aoIniciarEnvio?: () => void;
}

const CAMPOS_VAZIOS: CamposReporteAvaria = { pecaId: null, tipoAvariaId: null, descricao: '' };
const TAMANHO_MINIATURA = espacamento[80];
const OPCOES_PICKER = { base64: true, quality: 0.7, allowsMultipleSelection: false } as const;

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

/** Reporte de problema na peça pelo montador — entra na outbox, então funciona sem sinal. */
export function NovaAvaria({ pedidos, tipos, aoEnviado, aoIniciarEnvio }: PropsNovaAvaria) {
  const database = useDatabaseOuFalha();
  const [pedidoEscolhido, setPedidoEscolhido] = useState<number | null>(null);
  const [campos, setCampos] = useState<CamposReporteAvaria>(CAMPOS_VAZIOS);
  const [fotos, setFotos] = useState<FotoBase64[]>([]);
  const [previas, setPrevias] = useState<string[]>([]);
  const [erros, setErros] = useState<ErrosReporteAvaria>({});
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  // Com um pedido só, não há o que escolher.
  const pedidoId = pedidoEscolhido ?? (pedidos.length === 1 ? pedidos[0].id : null);
  const pedido = pedidos.find((candidato) => candidato.id === pedidoId) ?? null;

  function escolherPedido(id: number) {
    setPedidoEscolhido(id);
    setCampos((atuais) => ({ ...atuais, pecaId: null }));
  }

  function alterar<C extends keyof CamposReporteAvaria>(campo: C, valor: CamposReporteAvaria[C]) {
    setCampos((atuais) => ({ ...atuais, [campo]: valor }));
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
            preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
          });
    if (resultado.canceled) return;

    const foto = paraFotoBase64(resultado.assets[0]);
    if (!foto) {
      setFalha('Não foi possível usar essa foto. Tente outra.');
      return;
    }

    setFotos((atuais) => [...atuais, foto]);
    setPrevias((atuais) => [...atuais, resultado.assets[0].uri]);
    setErros((atuais) => ({ ...atuais, fotos: undefined }));
  }

  function removerFoto(indice: number) {
    setFotos((atuais) => atuais.filter((_, i) => i !== indice));
    setPrevias((atuais) => atuais.filter((_, i) => i !== indice));
  }

  function aoTocarAdicionarFoto() {
    Alert.alert('Adicionar foto', undefined, [
      { text: 'Tirar foto', onPress: () => void adicionarFoto('camera') },
      { text: 'Escolher da galeria', onPress: () => void adicionarFoto('galeria') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function enviar(): Promise<void> {
    const { erros: encontrados, dados } = validarReporteAvaria(campos, fotos);
    setErros(encontrados);
    if (!dados) return;

    aoIniciarEnvio?.();
    setEnviando(true);
    setFalha(null);
    try {
      const resultado = await executarAcaoAvaria(database, { idCliente: randomUUID(), ...dados });
      if (resultado.tipo === 'recusado') {
        setFalha(resultado.mensagem);
        return;
      }
      setCampos(CAMPOS_VAZIOS);
      setFotos([]);
      setPrevias([]);
      aoEnviado(
        resultado.tipo === 'enviada'
          ? 'Problema enviado. O gestor vai analisar.'
          : 'Sem conexão agora: o problema foi salvo e será enviado automaticamente.',
      );
    } catch {
      setFalha('Não foi possível registrar o problema. Tente de novo.');
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
                aoPressionar={() => escolherPedido(candidato.id)}
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
                      detalhe={[`${peca.quantidade} un.`, peca.codigoBarras].filter(Boolean).join(' · ')}
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

          {fotos.length < MAXIMO_FOTOS && (
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

          {previas.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacamento[8] }}>
              {previas.map((uri, indice) => (
                <View key={uri} style={{ width: TAMANHO_MINIATURA, height: TAMANHO_MINIATURA }}>
                  <Image
                    source={{ uri }}
                    accessibilityLabel={`Foto ${indice + 1} do problema`}
                    style={{ width: '100%', height: '100%', borderRadius: raio.md }}
                  />
                  <Pressable
                    accessibilityLabel={`Remover foto ${indice + 1}`}
                    onPress={() => removerFoto(indice)}
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
        </View>
      }
    />
  );
}
