import { render, screen } from '@testing-library/react-native';
import { MapaLocalizacao } from '../MapaLocalizacao';

describe('MapaLocalizacao', () => {
  it('exibe as coordenadas formatadas com 6 casas', async () => {
    await render(<MapaLocalizacao latitude={-19.9325} longitude={-43.9382} endereco="Rua X, 10" />);

    expect(screen.getByText('-19.932500, -43.938200')).toBeTruthy();
  });

  it('exibe o endereço quando há um', async () => {
    await render(<MapaLocalizacao latitude={-19.9325} longitude={-43.9382} endereco="Rua X, 10" />);

    expect(screen.getByText('Rua X, 10')).toBeTruthy();
  });

  it('sem endereço, avisa que está indisponível em vez de deixar em branco', async () => {
    await render(<MapaLocalizacao latitude={-19.9325} longitude={-43.9382} endereco={null} />);

    expect(screen.getByText('Endereço indisponível')).toBeTruthy();
  });

  it('injeta a coordenada no HTML do mapa', async () => {
    await render(<MapaLocalizacao latitude={-19.9325} longitude={-43.9382} />);

    const webview = screen.getByTestId('mapa-webview');
    expect(webview.props.source.html).toContain('-19.9325');
    expect(webview.props.source.html).toContain('-43.9382');
  });

  it('mantém a atribuição do OpenStreetMap, exigida pela licença', async () => {
    await render(<MapaLocalizacao latitude={-19.9325} longitude={-43.9382} />);

    expect(screen.getByTestId('mapa-webview').props.source.html).toContain('OpenStreetMap');
  });
});
