import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min, validateSync } from 'class-validator';

enum Ambiente {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Variáveis de ambiente validadas na borda do processo. Falhar aqui, no
 * boot, é preferível a falhar em runtime com `undefined` silencioso — este
 * arquivo cresce nas Fases seguintes (DATABASE_URL, SUPABASE_*, etc.).
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
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Configuração de ambiente inválida: ${errors.toString()}`);
  }

  return validatedConfig;
}
