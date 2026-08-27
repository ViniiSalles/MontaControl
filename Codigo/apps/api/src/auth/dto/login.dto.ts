import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * Nunca usar `@MinLength` em `senha`: transformaria N1T2 (senha incorreta)
 * num 400 de validação em vez do 401 "Credenciais inválidas", vazando
 * política de senha antes mesmo de checar a credencial.
 */
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  senha!: string;
}
