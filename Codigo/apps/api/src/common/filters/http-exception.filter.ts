import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';

interface CorpoErroPadrao {
  codigo: string;
  message: string;
}

/** Padroniza o corpo de toda resposta de erro HTTP como `{ codigo, message }`. */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus();

    const corpo: CorpoErroPadrao = {
      codigo: exception.constructor.name,
      message: this.extrairMensagem(exception.getResponse(), exception.message),
    };

    response.status(status).json(corpo);
  }

  private extrairMensagem(respostaExcecao: string | object, mensagemPadrao: string): string {
    if (typeof respostaExcecao === 'string') return respostaExcecao;
    const mensagem = (respostaExcecao as { message?: string | string[] }).message;
    if (Array.isArray(mensagem)) return mensagem.join('; ');
    return mensagem ?? mensagemPadrao;
  }
}
