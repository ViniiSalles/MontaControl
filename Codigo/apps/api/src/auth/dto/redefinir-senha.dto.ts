import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RedefinirSenhaDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  token!: string;

  /** Única rota onde política de senha é aplicada — nunca no login. */
  @IsString()
  @MinLength(8)
  novaSenha!: string;
}
