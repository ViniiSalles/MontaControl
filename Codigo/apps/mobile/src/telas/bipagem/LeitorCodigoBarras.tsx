import { useRef, useState } from 'react';
import { View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeScanningResult, BarcodeType } from 'expo-camera';
import { cores, espacamento, espacamentoNomeado, raio } from '@montacontrol/design-tokens/native';
import { Botao } from '../../ui/Botao';
import { CampoTexto } from '../../ui/CampoTexto';
import { Carregando } from '../../ui/Carregando';
import { Texto } from '../../ui/Texto';

interface PropsLeitorCodigoBarras {
  aoLer: (codigoBarras: string) => void;
}

/** Formatos de etiqueta de peça (1D industriais e os 2D comuns). */
const TIPOS_DE_CODIGO: BarcodeType[] = [
  'code128',
  'code39',
  'code93',
  'codabar',
  'ean13',
  'ean8',
  'itf14',
  'upc_a',
  'upc_e',
  'qr',
  'datamatrix',
  'pdf417',
];

/**
 * A câmera entrega o mesmo código dezenas de vezes por segundo enquanto a
 * etiqueta está no quadro; dentro desta janela a repetição é ignorada.
 */
const INTERVALO_MESMO_CODIGO_MS = 3000;

const LADO_CANTO = espacamento[32];
const ESPESSURA_CANTO = espacamento[4];

/** Cantos do quadro de mira (`BipagemDePecas.png`) — só borda, sem preenchimento. */
function CantoDaMira({ vertical, horizontal }: { vertical: 'top' | 'bottom'; horizontal: 'left' | 'right' }) {
  return (
    <View
      style={{
        position: 'absolute',
        [vertical]: 0,
        [horizontal]: 0,
        width: LADO_CANTO,
        height: LADO_CANTO,
        borderColor: cores.tertiaryFixedDim,
        [vertical === 'top' ? 'borderTopWidth' : 'borderBottomWidth']: ESPESSURA_CANTO,
        [horizontal === 'left' ? 'borderLeftWidth' : 'borderRightWidth']: ESPESSURA_CANTO,
      }}
    />
  );
}

function Mira() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: '20%',
        bottom: '20%',
        left: '15%',
        right: '15%',
        justifyContent: 'center',
      }}
    >
      <CantoDaMira vertical="top" horizontal="left" />
      <CantoDaMira vertical="top" horizontal="right" />
      <CantoDaMira vertical="bottom" horizontal="left" />
      <CantoDaMira vertical="bottom" horizontal="right" />
      <View style={{ height: espacamento[2], backgroundColor: cores.tertiaryFixedDim, opacity: 0.6 }} />
    </View>
  );
}

function AreaDaCamera({ aoLer }: PropsLeitorCodigoBarras) {
  const [permissao, pedirPermissao] = useCameraPermissions();
  const ultimaLeitura = useRef<{ codigo: string; em: number } | null>(null);

  function aoEscanear({ data }: BarcodeScanningResult) {
    const codigo = data.trim();
    const agora = Date.now();
    const anterior = ultimaLeitura.current;
    if (!codigo) return;
    if (anterior && anterior.codigo === codigo && agora - anterior.em < INTERVALO_MESMO_CODIGO_MS) return;
    ultimaLeitura.current = { codigo, em: agora };
    aoLer(codigo);
  }

  if (!permissao) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Carregando tamanho={espacamento[32]} />
      </View>
    );
  }

  if (!permissao.granted) {
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: espacamento[16], padding: espacamento[24] }}
      >
        <Texto variante="bodyMd" cor={cores.inverseOnSurface} alinhamento="centro">
          {permissao.canAskAgain
            ? 'Permita o uso da câmera para ler o código de barras das peças.'
            : 'O acesso à câmera foi negado. Libere nas configurações do aparelho ou digite o código.'}
        </Texto>
        {permissao.canAskAgain && (
          <Botao
            variante="primario"
            tamanho={48}
            forma="pilula"
            texto="Permitir câmera"
            aoPressionar={() => void pedirPermissao()}
          />
        )}
      </View>
    );
  }

  return (
    <>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: TIPOS_DE_CODIGO }}
        onBarcodeScanned={aoEscanear}
      />
      <Mira />
    </>
  );
}

/**
 * Leitor da bipagem: câmera traseira com quadro de mira e, para etiqueta
 * rasgada ou sem luz, a digitação manual do código. Só entrega o código lido;
 * validar contra o pedido é de quem usa.
 */
export function LeitorCodigoBarras({ aoLer }: PropsLeitorCodigoBarras) {
  const [digitando, setDigitando] = useState(false);
  const [codigoDigitado, setCodigoDigitado] = useState('');
  const codigoValido = codigoDigitado.trim().length > 0;

  function conferirDigitado() {
    if (!codigoValido) return;
    aoLer(codigoDigitado.trim());
    setCodigoDigitado('');
  }

  return (
    <View style={{ gap: espacamento[12] }}>
      <View
        style={{
          height: espacamentoNomeado.alturaPreviaDocumento,
          borderRadius: raio.lg,
          overflow: 'hidden',
          backgroundColor: cores.scrim,
        }}
      >
        <AreaDaCamera aoLer={aoLer} />
      </View>

      {digitando ? (
        <View style={{ gap: espacamento[8] }}>
          <CampoTexto
            rotulo="Código de barras"
            valor={codigoDigitado}
            aoAlterar={setCodigoDigitado}
            placeholder="Digite o código da etiqueta"
            iconeEsquerda="keyboard"
          />
          <View style={{ flexDirection: 'row', gap: espacamento[8] }}>
            <View style={{ flex: 1 }}>
              <Botao
                variante="fantasma"
                tamanho={48}
                forma="pilula"
                texto="Cancelar"
                larguraTotal
                aoPressionar={() => {
                  setDigitando(false);
                  setCodigoDigitado('');
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Botao
                variante="primario"
                tamanho={48}
                forma="pilula"
                texto="Conferir"
                larguraTotal
                desabilitado={!codigoValido}
                aoPressionar={conferirDigitado}
              />
            </View>
          </View>
        </View>
      ) : (
        <Botao
          variante="tonal"
          tamanho={48}
          forma="pilula"
          icone="keyboard"
          texto="Digitar código manualmente"
          larguraTotal
          aoPressionar={() => setDigitando(true)}
        />
      )}
    </View>
  );
}
