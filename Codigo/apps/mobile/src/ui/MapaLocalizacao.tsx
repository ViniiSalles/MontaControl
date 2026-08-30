import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { cores, espacamento, raio } from '@montacontrol/design-tokens/native';
import type { PropsMapaLocalizacao } from '@montacontrol/ui-contracts';
import { Texto } from './Texto';

const ZOOM_PADRAO = 16;
const ALTURA_PADRAO = 180;

/**
 * A atribuição `© OpenStreetMap contributors` é exigida pela licença dos
 * dados e não pode ser removida. Os tiles vêm de `tile.openstreetmap.org`,
 * que exige uso moderado — este mapa carrega uma vez por ponto exibido.
 */
function montarHtml(
  props: Required<Pick<PropsMapaLocalizacao, 'latitude' | 'longitude'>> & {
    zoom: number;
    interativo: boolean;
  },
): string {
  const { latitude, longitude, zoom, interativo } = props;
  const opcoesInteracao = interativo
    ? ''
    : 'dragging: false, scrollWheelZoom: false, touchZoom: false, doubleClickZoom: false, zoomControl: false,';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>html,body,#mapa{height:100%;margin:0;padding:0;background:transparent}</style>
  </head>
  <body>
    <div id="mapa"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      var mapa = L.map('mapa', { ${opcoesInteracao} attributionControl: true })
        .setView([${latitude}, ${longitude}], ${zoom});
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapa);
      L.marker([${latitude}, ${longitude}]).addTo(mapa);
    </script>
  </body>
</html>`;
}

export function MapaLocalizacao({
  latitude,
  longitude,
  endereco,
  zoom = ZOOM_PADRAO,
  altura = ALTURA_PADRAO,
  interativo = false,
}: PropsMapaLocalizacao) {
  const html = montarHtml({ latitude, longitude, zoom, interativo });
  const coordenadas = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

  return (
    <View style={{ gap: espacamento[8] }}>
      <View
        style={{
          height: altura,
          borderRadius: raio.md,
          overflow: 'hidden',
          backgroundColor: cores.surfaceContainerLow,
        }}
      >
        <WebView
          testID="mapa-webview"
          originWhitelist={['*']}
          source={{ html }}
          scrollEnabled={false}
          // Sem rede os tiles não carregam; o texto abaixo continua dizendo
          // onde o ponto foi batido, em vez de restar um retângulo mudo.
          renderError={() => (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Texto variante="bodySm" cor={cores.onSurfaceVariant}>
                Mapa indisponível offline
              </Texto>
            </View>
          )}
        />
      </View>

      <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
        {coordenadas}
      </Texto>
      <Texto variante="bodyMd">{endereco ?? 'Endereço indisponível'}</Texto>
    </View>
  );
}
