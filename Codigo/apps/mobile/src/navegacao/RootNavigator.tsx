import { AppAutenticado } from './AppAutenticado';
import { Login } from '../telas/Login';
import { useAuth } from '../auth/AuthContext';

/**
 * Roteamento por perfil do app mobile (plano, "Destinos de N1T1").
 *
 * O destino é derivado da sessão no render — não há navegação imperativa
 * nem histórico: autenticar troca a árvore de Login para `AppAutenticado`, e
 * `sair()` (ou uma sessão expirada que não renovou, TI02) traz de volta.
 * Como o app é exclusivo do MONTADOR — os demais perfis são recusados no
 * `AuthContext` antes de qualquer token ser persistido —, "rotear por
 * perfil" aqui é exatamente uma bifurcação: MONTADOR entra na aba padrão
 * (`ABA_PADRAO` = Jornada), qualquer outro nunca chega a ter sessão.
 *
 * A restauração de boot (`restaurando`) não aparece aqui: a splash nativa
 * segue na tela até ela terminar (ver `App.tsx`), então este componente só
 * monta com a decisão já tomada.
 */
export function RootNavigator() {
  const { sessao } = useAuth();

  return sessao ? <AppAutenticado /> : <Login />;
}
