import { useState } from 'react';
import { View } from 'react-native';
import type { VarianteAlerta } from '@montacontrol/ui-contracts/alerta';
import { cores, espacamento, espacamentoNomeado, raio } from '@montacontrol/design-tokens/native';
import { Alerta } from '../ui/Alerta';
import { Botao } from '../ui/Botao';
import { CampoTexto } from '../ui/CampoTexto';
import { Icone } from '../ui/Icone';
import { PulsoAtividade } from '../ui/PulsoAtividade';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';
import { useAuth } from '../auth/AuthContext';
import { ErroAutenticacao } from '../auth/clienteAuth';

const CODIGO_CREDENCIAIS_INVALIDAS = 'CREDENCIAIS_INVALIDAS';

/**
 * Içado para fora do componente: prop não-primitiva recriada a cada render
 * invalidaria qualquer memoização futura de `CampoTexto`
 * (`rerender-memo-with-default-value`).
 */
const ACAO_ESQUECI_SENHA = { texto: 'Esqueci minha senha', aoPressionar: () => {} };

interface EstadoErro {
  variante: VarianteAlerta;
  mensagem: string;
}

/**
 * Ver `login_montador`. Diferenças deliberadas em relação ao Login da web
 * (`apps/web/src/paginas/Login.tsx`):
 *
 * - Sem "Manter conectado": no mobile a sessão sempre persiste no
 *   Keychain/Keystore (ver `armazenamentoSessao.ts`). Um montador em campo
 *   refazendo login a cada abertura do app é atrito sem ganho de segurança
 *   em um aparelho corporativo de uso individual.
 * - "Esqueci minha senha" segue só visual, como na web: o endpoint
 *   (`POST /api/auth/recuperar-senha`) existe, mas a tela de redefinição não
 *   está no escopo da Sprint 1.
 */
export function Login() {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<EstadoErro | null>(null);

  // Derivado no render, sem efeito nem estado espelho
  // (`rerender-derived-state-no-effect`).
  const podeEnviar = email.trim().length > 0 && senha.length > 0 && !carregando;

  async function realizarLogin(): Promise<void> {
    setErro(null);
    setCarregando(true);
    try {
      await entrar(email.trim(), senha);
      // Sem navegação imperativa: `RootNavigator` deriva a tela da sessão,
      // então o sucesso troca de tela sozinho e este componente desmonta.
    } catch (excecao) {
      if (excecao instanceof ErroAutenticacao) {
        setErro({
          // N1T2: credenciais inválidas é `erro`; perfil recusado é `aviso`,
          // porque não há nada de errado com a credencial em si.
          variante: excecao.codigo === CODIGO_CREDENCIAIS_INVALIDAS ? 'erro' : 'aviso',
          mensagem: excecao.message,
        });
      } else {
        setErro({
          variante: 'erro',
          mensagem: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
        });
      }
      setCarregando(false);
    }
  }

  return (
    <Tela evitarTeclado rolavel>
      <View style={{ flex: 1, justifyContent: 'center', gap: espacamentoNomeado.gapPilha }}>
        <View style={{ alignItems: 'center', gap: espacamento[16] }}>
          <View
            style={{
              width: espacamento[64],
              height: espacamento[64],
              borderRadius: raio.lg,
              backgroundColor: cores.primaryContainer,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icone nome="conveyor_belt" tamanho={espacamento[32]} cor={cores.onPrimaryContainer} />
          </View>
          <View style={{ alignItems: 'center', gap: espacamento[4] }}>
            <Texto variante="displaySm" alinhamento="centro">
              MontaControl
            </Texto>
            <Texto variante="labelMd" cor={cores.onSurfaceVariant} alinhamento="centro">
              OPERATIONAL EXCELLENCE
            </Texto>
          </View>
        </View>

        {erro && <Alerta variante={erro.variante} mensagem={erro.mensagem} />}

        <View style={{ gap: espacamentoNomeado.gapPilha }}>
          <CampoTexto
            rotulo="E-mail"
            valor={email}
            aoAlterar={setEmail}
            tipo="email"
            placeholder="nome@empresa.com.br"
            iconeEsquerda="mail"
            obrigatorio
            desabilitado={carregando}
          />
          <CampoTexto
            rotulo="Senha"
            valor={senha}
            aoAlterar={setSenha}
            tipo="senha"
            placeholder="••••••••"
            iconeEsquerda="lock"
            obrigatorio
            desabilitado={carregando}
            acaoRotulo={ACAO_ESQUECI_SENHA}
          />
          <Botao
            variante="primario"
            tamanho={56}
            forma="pilula"
            texto="Entrar"
            larguraTotal
            carregando={carregando}
            desabilitado={!podeEnviar}
            aoPressionar={() => void realizarLogin()}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacamento[8] }}>
          <PulsoAtividade />
          <Texto variante="labelSm" cor={cores.onSurfaceVariant}>
            SISTEMA DE GESTÃO ATIVO
          </Texto>
        </View>
      </View>
    </Tela>
  );
}
