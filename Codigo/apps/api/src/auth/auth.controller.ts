import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LoginResponse, Perfil as PerfilCompartilhado, UsuarioDTO } from '@montacontrol/shared';
import { SessaoSupabase } from '../supabase/sessao-supabase';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RecuperarSenhaDto } from './dto/recuperar-senha.dto';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto';
import { RefreshDto } from './dto/refresh.dto';
import { UsuarioAutenticado } from './usuario-autenticado';

const MENSAGEM_RECUPERACAO_ENVIADA =
  'Se o e-mail informado existir em nossa base, um código de recuperação foi enviado.';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** N1T1/N1T2/TI01. 10 tentativas/min — protege contra força bruta de senha. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<LoginResponse> {
    const { sessao, usuario } = await this.auth.login(dto.email, dto.senha);
    return this.mapearResposta(sessao, usuario);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto): Promise<LoginResponse> {
    const { sessao, usuario } = await this.auth.refresh(dto.refreshToken);
    return this.mapearResposta(sessao, usuario);
  }

  /**
   * Sempre 202 com corpo fixo, exista ou não o e-mail — sem isso a resposta
   * vira um oráculo de enumeração de contas.
   */
  @Public()
  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  @Post('recuperar-senha')
  @HttpCode(HttpStatus.ACCEPTED)
  async recuperarSenha(@Body() dto: RecuperarSenhaDto): Promise<{ message: string }> {
    await this.auth.solicitarRecuperacaoSenha(dto.email);
    return { message: MENSAGEM_RECUPERACAO_ENVIADA };
  }

  @Public()
  @Post('redefinir-senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  async redefinirSenha(@Body() dto: RedefinirSenhaDto): Promise<void> {
    await this.auth.redefinirSenha(dto.email, dto.token, dto.novaSenha);
  }

  /** TI02: única rota autenticada de leitura pura usada pela suíte de token expirado. */
  @Get('me')
  me(@CurrentUser() usuario: UsuarioAutenticado): UsuarioDTO {
    return this.mapearUsuario(usuario);
  }

  @Post('sair')
  @HttpCode(HttpStatus.NO_CONTENT)
  async sair(@Headers('authorization') authorization: string): Promise<void> {
    await this.auth.sair(authorization.slice('Bearer '.length));
  }

  private mapearResposta(sessao: SessaoSupabase, usuario: UsuarioAutenticado): LoginResponse {
    return {
      accessToken: sessao.accessToken,
      refreshToken: sessao.refreshToken,
      expiresIn: sessao.expiresIn,
      usuario: this.mapearUsuario(usuario),
    };
  }

  /** `Perfil` existe em dois lugares (Prisma e shared) por design — ver contrato-enums.spec.ts. */
  private mapearUsuario(usuario: UsuarioAutenticado): UsuarioDTO {
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil as unknown as PerfilCompartilhado,
      ativo: usuario.ativo,
    };
  }
}
