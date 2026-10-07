const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

/**
 * Evita o estouro de caminho (MAX_PATH) do `ninja` no Windows ao compilar o
 * código nativo. O nome do objeto espelha o caminho absoluto do fonte dentro
 * do diretório de build, então um repositório em caminho longo passa de 260
 * caracteres — e o `ninja` do NDK não é long-path aware (ver BUILD-APK.md,
 * seção 4). `android/` é gerado e não versionado: sem este plugin, os ajustes
 * somem a cada `expo prebuild`.
 *
 * - `CMAKE_OBJECT_PATH_MAX=250`: o CMake troca o caminho espelhado por um
 *   diretório curto com hash (é o que de fato conserta).
 * - `mc.cxxDir`: tira o `.cxx` de dentro do repositório. Também é lido pelo
 *   patch do WatermelonDB (`patches/@nozbe__watermelondb.patch`).
 *
 * Em Linux/macOS o `mc.cxxDir` não é definido e o `build.gradle` cai no
 * `.cxx` padrão — nada disso atrapalha lá.
 */

const MARCADOR = 'montacontrol: caminho curto do .cxx';
const CHAVE_CXX_DIR = 'mc.cxxDir';
const CXX_DIR_WINDOWS = 'C:/mcx';

const BLOCO_DEFAULT_CONFIG = `
        // ${MARCADOR}
        externalNativeBuild {
            cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=250" }
        }`;

const BLOCO_STAGING = `    // ${MARCADOR}
    externalNativeBuild {
        cmake {
            buildStagingDirectory = file(findProperty('${CHAVE_CXX_DIR}') ?: "\${projectDir}/.cxx")
        }
    }
`;

function exigirAncora(contents, regex, nome) {
  if (!regex.test(contents)) {
    throw new Error(
      `withCaminhoCurtoCxx: não encontrei "${nome}" no app/build.gradle. ` +
        'O template do Expo mudou; ajuste o plugin em plugins/withCaminhoCurtoCxx.js.',
    );
  }
}

function ajustarAppBuildGradle(contents) {
  if (contents.includes(MARCADOR)) return contents;

  const defaultConfig = /^([ \t]*)defaultConfig \{[ \t]*$/m;
  const signingConfigs = /^([ \t]*)signingConfigs \{[ \t]*$/m;
  exigirAncora(contents, defaultConfig, 'defaultConfig {');
  exigirAncora(contents, signingConfigs, 'signingConfigs {');

  return contents
    .replace(defaultConfig, (linha) => `${linha}${BLOCO_DEFAULT_CONFIG}`)
    .replace(signingConfigs, (linha) => `${BLOCO_STAGING}${linha}`);
}

function ajustarGradleProperties(itens, plataforma = process.platform) {
  if (plataforma !== 'win32') return itens;
  if (itens.some((item) => item.type === 'property' && item.key === CHAVE_CXX_DIR)) return itens;

  return [...itens, { type: 'property', key: CHAVE_CXX_DIR, value: CXX_DIR_WINDOWS }];
}

function withCaminhoCurtoCxx(config) {
  config = withGradleProperties(config, (cfg) => {
    cfg.modResults = ajustarGradleProperties(cfg.modResults);
    return cfg;
  });
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = ajustarAppBuildGradle(cfg.modResults.contents);
    return cfg;
  });
}

module.exports = withCaminhoCurtoCxx;
module.exports.ajustarAppBuildGradle = ajustarAppBuildGradle;
module.exports.ajustarGradleProperties = ajustarGradleProperties;
