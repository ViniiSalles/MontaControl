const fs = require('node:fs');
const {
  ajustarAppBuildGradle,
  ajustarGradleProperties,
} = require('../withCaminhoCurtoCxx');

// Recorte fiel do app/build.gradle gerado pelo prebuild (SDK 57).
const buildGradleGerado = `android {
    ndkVersion rootProject.ext.ndkVersion

    namespace 'br.pucminas.montacontrol'
    defaultConfig {
        applicationId 'br.pucminas.montacontrol'
        versionCode 1
    }
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
}
`;

describe('ajustarAppBuildGradle', () => {
  test('acrescenta CMAKE_OBJECT_PATH_MAX dentro do defaultConfig', () => {
    const saida = ajustarAppBuildGradle(buildGradleGerado);

    expect(saida).toMatch(
      /defaultConfig \{\s*\n[^\n]*\n\s*externalNativeBuild \{\s*\n\s*cmake \{ arguments "-DCMAKE_OBJECT_PATH_MAX=250" \}/,
    );
  });

  test('acrescenta o buildStagingDirectory lendo mc.cxxDir, antes do signingConfigs', () => {
    const saida = ajustarAppBuildGradle(buildGradleGerado);

    const staging = saida.indexOf("buildStagingDirectory = file(findProperty('mc.cxxDir')");
    expect(staging).toBeGreaterThan(-1);
    expect(staging).toBeLessThan(saida.indexOf('signingConfigs {'));
  });

  test('é idempotente: aplicar duas vezes não duplica nada', () => {
    const uma = ajustarAppBuildGradle(buildGradleGerado);

    expect(ajustarAppBuildGradle(uma)).toBe(uma);
  });

  test('falha alto se o template do Expo mudar e a âncora sumir', () => {
    expect(() => ajustarAppBuildGradle('android { }')).toThrow(/defaultConfig/);
  });

  test('o build.gradle real gerado (se existir) aceita os ajustes sem perder nada', () => {
    const caminho = `${__dirname}/../../android/app/build.gradle`;
    if (!fs.existsSync(caminho)) return;

    const real = fs.readFileSync(caminho, 'utf8');
    const saida = ajustarAppBuildGradle(real);

    expect(saida).toContain('defaultConfig {');
    expect(ajustarAppBuildGradle(saida)).toBe(saida);
  });
});

describe('ajustarGradleProperties', () => {
  test('no Windows define mc.cxxDir', () => {
    const saida = ajustarGradleProperties([], 'win32');

    expect(saida).toContainEqual({ type: 'property', key: 'mc.cxxDir', value: 'C:/mcx' });
  });

  test('em Linux/macOS não altera nada (o caminho C:/mcx não faz sentido lá)', () => {
    expect(ajustarGradleProperties([], 'linux')).toEqual([]);
    expect(ajustarGradleProperties([], 'darwin')).toEqual([]);
  });

  test('não sobrescreve um mc.cxxDir que o desenvolvedor já definiu', () => {
    const existente = [{ type: 'property', key: 'mc.cxxDir', value: 'D:/cxx' }];

    expect(ajustarGradleProperties(existente, 'win32')).toEqual(existente);
  });
});
