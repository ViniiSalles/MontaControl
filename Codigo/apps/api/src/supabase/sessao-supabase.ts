/** Sessão devolvida pelo GoTrue após login, refresh ou recuperação de senha. */
export interface SessaoSupabase {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  authUserId: string;
  email: string;
}
