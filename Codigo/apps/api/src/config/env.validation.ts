import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, Min, validateSync } from 'class-validator';

enum Ambiente {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/** Ref do projeto Supabase de produção — nunca pode ser o alvo de NODE_ENV=test. */
const REF_SUPABASE_PRODUCAO = 'mfmtpffowurgfsowsgur';

/**
 * Variáveis de ambiente validadas na borda do processo. Falhar aqui, no
 * boot, é preferível a falhar em runtime com `undefined` silencioso.
 */
class EnvironmentVariables {
  @IsOptional()
  @IsEnum(Ambiente)
  NODE_ENV: Ambiente = Ambiente.Development;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  DIRECT_URL!: string;

  @IsUrl({ require_tld: false })
  SUPABASE_URL!: string;

  @IsString()
  SUPABASE_ANON_KEY!: string;

  @IsString()
  SUPABASE_SERVICE_ROLE_KEY!: string;

  @IsUrl({ require_tld: false })
  SUPABASE_JWT_ISSUER!: string;

  /** `redirectTo` do `resetPasswordForEmail` — o fluxo usa o código OTP do e-mail, não o link. */
  @IsUrl({ require_tld: false })
  PASSWORD_RESET_REDIRECT_URL!: string;

  /** Bucket privado das fotos de atestado. Nunca público: o acesso é só por URL assinada. */
  @IsString()
  SUPABASE_BUCKET_ATESTADOS!: string;
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Configuração de ambiente inválida: ${errors.toString()}`);
  }

  // Guarda contra o pior acidente possível: suíte e2e criando/apagando dados
  // no projeto de produção porque um .env foi copiado errado.
  if (
    validatedConfig.NODE_ENV === Ambiente.Test &&
    validatedConfig.DATABASE_URL.includes(REF_SUPABASE_PRODUCAO)
  ) {
    throw new Error(
      'NODE_ENV=test não pode apontar para o projeto Supabase de produção ' +
        `(${REF_SUPABASE_PRODUCAO}). Aponte DATABASE_URL/DIRECT_URL para o MontaControlDev.`,
    );
  }

  return validatedConfig;
}
