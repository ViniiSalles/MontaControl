import { useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import type { FotoBase64 } from '@montacontrol/shared';
import { cores, espacamento, raio } from '@montacontrol/design-tokens/native';
import { Alerta } from '../../ui/Alerta';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { CampoTexto } from '../../ui/CampoTexto';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';
import { ErroApi } from '../../jornada/clienteJornadas';
import { enviarAtestado } from '../../atestados/clienteAtestados';
import { paraFotoBase64 } from '../../atestados/fotoParaBase64';
import { mascararData, validarEnvioAtestado } from '../../atestados/validarEnvioAtestado';
import type { CamposNovoAtestado, ErrosNovoAtestado } from '../../atestados/validarEnvioAtestado';

interface PropsNovoAtestado {
  token: string;
  /** Atestado criado com sucesso — o pai avisa e recarrega a lista. */
  aoEnviado: () => void;
}

const CAMPOS_VAZIOS: CamposNovoAtestado = { dataInicio: '', dataFim: '', observacao: '' };
const TAMANHO_MINIATURA = espacamento[80];

/** `quality` reduz o peso do upload; o limite de 5 MB/foto é do backend. */
const OPCOES_PICKER = { base64: true, quality: 0.7, allowsMultipleSelection: false } as const;

/** Formulário de envio de atestado (`POST /api/atestados`) — foto por câmera ou galeria. */
export function NovoAtestado({ token, aoEnviado }: PropsNovoAtestado) {
  const [campos, setCampos] = useState<CamposNovoAtestado>(CAMPOS_VAZIOS);
  const [fotos, setFotos] = useState<FotoBase64[]>([]);
  const [previas, setPrevias] = useState<string[]>([]);
  const [erros, setErros] = useState<ErrosNovoAtestado>({});
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  function alterar(campo: keyof CamposNovoAtestado, valor: string) {
    setCampos((atuais) => ({ ...atuais, [campo]: valor }));
    setErros((atuais) => ({ ...atuais, [campo]: undefined }));
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
            // Sem isto, uma foto HEIC da galeria (padrão de câmera iOS) chega
            // sem `mimeType` compatível e `paraFotoBase64` a descarta.
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
    const { erros: encontrados, dados } = validarEnvioAtestado(campos, fotos);
    setErros(encontrados);
    if (!dados) return;

    setEnviando(true);
    setFalha(null);
    try {
      await enviarAtestado(token, { idCliente: randomUUID(), ...dados });
      setCampos(CAMPOS_VAZIOS);
      setFotos([]);
      setPrevias([]);
      aoEnviado();
    } catch (causa: unknown) {
      setFalha(causa instanceof ErroApi ? causa.message : 'Não foi possível enviar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Cartao
      elevacao="elev1"
      tom="padrao"
      conteudo={
        <View style={{ gap: espacamento[16] }}>
          <View style={{ flexDirection: 'row', gap: espacamento[12] }}>
            <View style={{ flex: 1 }}>
              <CampoTexto
                rotulo="Data início"
                valor={campos.dataInicio}
                aoAlterar={(valor) => alterar('dataInicio', mascararData(valor))}
                tipo="numero"
                placeholder="DD/MM/AAAA"
                erro={erros.dataInicio}
                obrigatorio
              />
            </View>
            <View style={{ flex: 1 }}>
              <CampoTexto
                rotulo="Data fim"
                valor={campos.dataFim}
                aoAlterar={(valor) => alterar('dataFim', mascararData(valor))}
                tipo="numero"
                placeholder="DD/MM/AAAA"
                erro={erros.dataFim}
                obrigatorio
              />
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fotografar Atestado"
            onPress={aoTocarAdicionarFoto}
            style={{
              alignItems: 'center',
              gap: espacamento[8],
              padding: espacamento[24],
              borderRadius: raio.lg,
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: cores.outlineVariant,
              backgroundColor: cores.primaryFixed,
            }}
          >
            <Icone nome="add_a_photo" cor={cores.primary} />
            <Texto variante="titleMd">Fotografar Atestado</Texto>
            <Texto variante="bodySm" cor={cores.onSurfaceVariant}>
              JPG ou PNG
            </Texto>
          </Pressable>

          {previas.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacamento[8] }}>
              {previas.map((uri, indice) => (
                <View key={uri} style={{ width: TAMANHO_MINIATURA, height: TAMANHO_MINIATURA }}>
                  <Image
                    source={{ uri }}
                    accessibilityLabel={`Foto ${indice + 1} do atestado`}
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

          <CampoTexto
            rotulo="Observação"
            valor={campos.observacao}
            aoAlterar={(valor) => alterar('observacao', valor)}
            placeholder="Descreva brevemente o motivo…"
            erro={erros.observacao}
            multilinha
          />

          {falha && <Alerta variante="erro" titulo="Não foi possível enviar" mensagem={falha} />}

          <Botao
            variante="primario"
            tamanho={48}
            forma="pilula"
            texto="Enviar Atestado"
            larguraTotal
            carregando={enviando}
            aoPressionar={() => void enviar()}
          />
        </View>
      }
    />
  );
}
