# Gerando o APK do `@montacontrol/mobile`

Guia de comandos para gerar um `.apk` instalável do app do montador. O build é **local**, via Gradle
(`expo prebuild` + `gradlew`) — não usamos EAS Build.

Caminhos relativos a `Codigo/apps/mobile/`, salvo quando indicado.

---

## 1. Pré-requisitos

| Item           | Versão / onde                                                       |
| -------------- | ------------------------------------------------------------------- |
| Node           | ver `.nvmrc` na raiz de `Codigo/`                                   |
| pnpm           | gerenciador do monorepo                                             |
| JDK            | 17–21 (validado com JDK 23; **JDK 24+ quebra o build**, ver seção 11) |
| Android SDK    | `C:\Users\<voce>\AppData\Local\Android\Sdk`                         |
| Android NDK    | instalado junto com o SDK — obrigatório, o RN compila código nativo |
| Build Tools 36 | `build-tools/36.0.0`                                                |
| Platform 36    | `platforms/android-36`                                              |
| CMake          | `cmake/3.22.1` (vem do SDK)                                         |

O Gradle descobre o SDK por `android/local.properties`:

```properties
sdk.dir=C:/Users/David/AppData/Local/Android/Sdk
```

Esse arquivo é **local e não versionado** — em outra máquina, gere-o de novo (ou defina
`ANDROID_HOME`).

## 2. Instalar dependências (uma vez, na raiz de `Codigo/`)

```bash
pnpm install
```

`nodeLinker: hoisted` no `pnpm-workspace.yaml` é obrigatório: o Metro e o autolinking do Expo não
resolvem o `node_modules` simbolicado padrão do pnpm.

**Nunca rode `pnpm install` em paralelo com o build** (nem dois installs ao mesmo tempo): a árvore de
`node_modules` fica momentaneamente incompleta e o Gradle quebra com erros que parecem outra coisa.
Ver seção 11.

## 3. Gerar o projeto nativo (`android/`)

**`android/` não é versionado** (`.gitignore` do app, linha `/android`) — é saída do `expo
prebuild`. Num clone novo ela não existe; gere com:

```bash
cd Codigo/apps/mobile
pnpm exec expo prebuild --platform android
```

Rode de novo só se alterar `app.json` (nome, `package`, permissões, plugins nativos, ícone/splash).

> ⚠️ **Depois de todo prebuild, reaplique os ajustes locais** — o prebuild reescreve
> `android/gradle.properties` e `android/app/build.gradle` do zero, e sem eles o build no Windows
> não passa:
>
> - os dois ajustes de MAX_PATH (seção 4);
> - `reactNativeArchitectures` (seção 6), se quiser o build rápido de emulador.
>
> Pra não ter que passar `-Pmc.cxxDir` toda hora na linha de comando (o que importa quando você usa
> `expo run:android`/`pnpm android`, que não deixa passar `-P` customizado), dá pra fixar os dois
> ajustes direto em `android/gradle.properties` em vez de só na CLI:
>
> ```properties
> org.gradle.java.home=C:/Program Files/Java/jdk-21.0.12
> mc.cxxDir=C:/mcx
> ```
>
> (ajuste o caminho do JDK pro que você tiver instalado — ver seção 11 sobre por que isso é
> necessário no Windows).

## 4. Windows: o limite de 260 caracteres

O `ninja` do `cmake/3.22.1` do SDK (versão 1.10.2) aborta em caminho acima de `MAX_PATH`:

```
ninja: error: Stat(rnsvg_autolinked_build/CMakeFiles/react_codegen_rnsvg.dir/D_/Codes/.../ComponentDescriptors.cpp.o): Filename longer than 260 characters
```

O caminho estoura porque o nome do objeto **espelha o caminho absoluto do fonte** dentro do
diretório de build — o caminho do repositório entra duas vezes. Com o repositório em
`D:\Codes\Faculdade\pmg-es-2026-1-tcci-6583100-dev-montacontrol-3\`, passa de 300 caracteres.

Habilitar `LongPathsEnabled` no registro **não resolve**: esse `ninja` não é long-path aware.

Dois ajustes em `android/app/build.gradle` (bloco `android { ... }`) resolvem, mais a propriedade
`mc.cxxDir=C:/mcx` no `android/gradle.properties`. **Tudo isso é aplicado automaticamente a cada
`expo prebuild`** pelo config plugin `plugins/withCaminhoCurtoCxx.js` (registrado em `app.json`) — no
Windows; em Linux/macOS o `mc.cxxDir` não é definido. O restante desta seção explica o que o plugin
faz, caso o template do Expo mude e o prebuild reclame de âncora ausente (aí o ajuste manual abaixo
serve de referência):

**4.1 — `CMAKE_OBJECT_PATH_MAX`** (o que de fato conserta). Com o limite explícito, o CMake troca o
caminho espelhado do fonte por um diretório curto com hash em vez de deixar o nome estourar. Vai
dentro de `defaultConfig`:

```groovy
defaultConfig {
    // ...
    externalNativeBuild {
        cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=250" }
    }
}
```

**4.2 — `mc.cxxDir`**, para tirar o diretório nativo (`.cxx`) de dentro do repositório e ganhar mais
folga. Vai direto em `android { ... }`, ao lado de `defaultConfig`:

```groovy
externalNativeBuild {
    cmake {
        buildStagingDirectory = file(findProperty('mc.cxxDir') ?: "${projectDir}/.cxx")
    }
}
```

É a única coisa que precisa ir na linha de comando:

```
-Pmc.cxxDir=C:/mcx
```

Em Linux/macOS nada disso é necessário (nem atrapalha) — pode omitir o `-Pmc.cxxDir`.

> **Não use `subst` para encurtar o caminho.** Foi tentado e não funciona aqui: o Windows resolve a
> unidade virtual de volta para o caminho real, então parte do build enxerga `M:\...` e parte
> `D:\...`, e o codegen morre com
> `this and base files have different roots`.

**4.3 — o mesmo problema existe fora de `android/app`.** O WatermelonDB compila um módulo nativo
próprio (`watermelondb-jsi`, JSI/SQLite) cujo `.cxx` fica em
`node_modules/@nozbe/watermelondb/native/android-jsi/`, mais fundo ainda no caminho do repositório —
aqui o build falha de verdade (não é só warning): `ninja: error: mkdir(...): No such file or
directory`. Precisa dos mesmos dois ajustes (4.1 e 4.2) no `build.gradle` desse módulo. Só que esse
arquivo mora em `node_modules`, não em `android/` — reaplicar à mão a cada `pnpm install` não é
viável, então isso é persistido via `pnpm patch`:

```bash
pnpm patch @nozbe/watermelondb
# edita o build.gradle do "native/android-jsi" na pasta temporária que o comando imprime
pnpm patch-commit <caminho-temporário>
```

O patch fica em `patches/@nozbe__watermelondb.patch` e é referenciado em
`pnpm-workspace.yaml` (`patchedDependencies`) — se aplica sozinho em todo `pnpm install`, sem passo
manual. Se o WatermelonDB for atualizado de versão, o patch pode parar de aplicar (o `pnpm install`
avisa) e precisa ser refeito.

## 5. Gerar o APK

### Release — o que você entrega/instala

```powershell
cd Codigo\apps\mobile\android
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a "-Pmc.cxxDir=C:/mcx"
```

Linux/macOS:

```bash
cd Codigo/apps/mobile/android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Saída (~30 MB, JS já embutido em `assets/index.android.bundle`):

```
android/app/build/outputs/apk/release/app-release.apk
```

Build completo do zero leva alguns minutos (compila o nativo com o NDK); incremental, ~1min30.

### Debug — com dev menu, precisa do Metro para recarregar o JS

```powershell
.\gradlew.bat assembleDebug -PreactNativeArchitectures=arm64-v8a "-Pmc.cxxDir=C:/mcx"
```

Saída: `android/app/build/outputs/apk/debug/app-debug.apk`.

### Atalho: compilar e já instalar no dispositivo/emulador conectado

```bash
cd Codigo/apps/mobile
pnpm android            # expo run:android (debug, sobe o Metro junto)
```

## 6. ABIs — por que passar `-PreactNativeArchitectures`

`android/gradle.properties` (local, não versionado — reaplicar após prebuild) está fixado em:

```properties
reactNativeArchitectures=x86_64
```

Isso corta a compilação nativa (NDK/CMake) de 3 das 4 ABIs e deixa o build de iteração no emulador
bem mais rápido. O preço: **o APK gerado sem a flag só roda em emulador x86_64** — instalar num
celular real falha com `INSTALL_FAILED_NO_MATCHING_ABIS`.

| Alvo                          | Flag                                                          |
| ----------------------------- | ------------------------------------------------------------- |
| Celular Android moderno       | `-PreactNativeArchitectures=arm64-v8a`                        |
| Emulador (Pixel_5 local)      | `-PreactNativeArchitectures=x86_64` (ou nenhuma flag)         |
| APK universal (entrega final) | `-PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86,x86_64` |

O universal compila as 4 ABIs — bem mais lento e APK bem maior. Use só na versão final que precisa
rodar em qualquer aparelho.

Conferir o que entrou no APK:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\36.0.0\aapt.exe" list app-release.apk | Select-String "^lib/"
```

## 7. Assinatura

O `release` está assinado com a **debug keystore** (`android/app/debug.keystore`), configurado em
`android/app/build.gradle`:

```groovy
release {
    signingConfig signingConfigs.debug
}
```

Conferir:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\36.0.0\apksigner.bat" verify --print-certs app-release.apk
# Signer #1 certificate DN: CN=Android Debug, OU=Android, O=Unknown, ...
```

Só assinatura v2/v3 (sem `META-INF/*.RSA`), que é o padrão do AGP — instala normalmente.

Isso basta para `adb`/sideload e para a banca do TCC. **Não serve para a Play Store** — publicar
exige keystore própria (`keytool -genkeypair`) e um `signingConfig release`.

## 8. Instalar no aparelho

Com depuração USB ligada e o aparelho autorizado:

```bash
adb devices                                                   # tem que aparecer "device"
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

`-r` reinstala por cima mantendo os dados. Se der `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, a assinatura
difere da versão já instalada — desinstale antes:

```bash
adb uninstall br.pucminas.montacontrol
```

Sem cabo: copie o `.apk` para o aparelho e instale pelo gerenciador de arquivos (é preciso liberar
"instalar de fontes desconhecidas").

## 9. Apontar o app para a API

Antes de gerar um APK para aparelho físico, ajuste `expo.extra.apiUrl` em `app.json`:

```json
"extra": { "apiUrl": "http://192.168.x.y:3000" }
```

O padrão (`http://10.0.2.2:3000`) só funciona no emulador Android — num celular real, nem
`localhost` nem `10.0.2.2` alcançam a máquina de desenvolvimento. Detalhes em `README.md`.

Mudar `app.json` não exige prebuild novo nesse caso, mas o valor é embutido no bundle JS — é preciso
**recompilar o APK**.

## 10. Limpeza / quando o build trava

```bash
cd Codigo/apps/mobile/android
./gradlew clean                 # limpa artefatos de build
./gradlew --stop                # mata os daemons do Gradle
```

Casos mais graves (após trocar versão de RN/Expo, ou erro de CMake persistente):

```bash
rm -rf android/app/build android/.gradle android/.kotlin
rm -rf /c/mcx                   # o .cxx apontado por mc.cxxDir
```

Se nem isso resolver, apague `android/` e rode o prebuild da seção 3 — lembrando de reaplicar os
ajustes das seções 4 e 6.

## 11. Problemas comuns

**`ninja: error: ... Filename longer than 260 characters`**
Faltam os ajustes da seção 4 (provavelmente o `build.gradle` foi regenerado por um `expo prebuild`).

**`Execution failed for task ':...:configureCMakeDebug[...]'. > WARNING: A restricted method in java.lang.System has been called`**
JDK 24+ (o JBR embutido em versões recentes do Android Studio já é a 25) faz a JVM imprimir esse
aviso, e o Android Gradle Plugin (`GeneratePrefabPackages.kt`, ao empacotar Prefab pra módulos
nativos) trata qualquer linha com "WARNING" na saída como erro fatal — não é um problema no código
do projeto. Corrige usando um JDK 17–21 pra rodar o Gradle: instale um (ex. Temurin/Adoptium) e fixe
`org.gradle.java.home` em `android/gradle.properties` (seção 3) em vez de depender do JBR do Android
Studio.

**`this and base files have different roots: M:\... and D:\...`**
Você está compilando por uma unidade `subst`. Compile pelo caminho real (`D:\...`). Ver seção 4.

**`Unable to resolve module expo from .../index.ts`** (task `createBundleReleaseJsAndAssets`)
ou **`Process 'command 'node'' finished with non-zero exit value 1`** no `settings.gradle`
`node_modules` incompleto — quase sempre um `pnpm install` rodando ao mesmo tempo que o build.
Espere terminar e confira antes de recompilar:

```powershell
Get-Process pnpm -ErrorAction SilentlyContinue     # tem que voltar vazio
node -e "console.log(require.resolve('react-native/package.json'))"
```

**`INSTALL_FAILED_NO_MATCHING_ABIS`** ao instalar no celular
APK compilado só para `x86_64`. Recompile com `-PreactNativeArchitectures=arm64-v8a` (seção 6).

---

## Resumo — o caminho curto

```powershell
pnpm install                        # na raiz de Codigo/ — espere terminar
cd Codigo\apps\mobile\android
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a "-Pmc.cxxDir=C:/mcx"
adb install -r app\build\outputs\apk\release\app-release.apk
```
