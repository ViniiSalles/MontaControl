import { ArgumentsHost, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function criarHost(respostaMock: { status: jest.Mock; json: jest.Mock }): ArgumentsHost {
  return {
    switchToHttp: () => ({ getResponse: () => respostaMock }),
  } as unknown as ArgumentsHost;
}

describe('HttpExceptionFilter', () => {
  let filtro: HttpExceptionFilter;
  let status: jest.Mock;
  let json: jest.Mock;
  let resposta: { status: jest.Mock; json: jest.Mock };

  beforeEach(() => {
    filtro = new HttpExceptionFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    resposta = { status, json };
  });

  it('formata uma exceção com mensagem simples', () => {
    filtro.catch(new UnauthorizedException('Credenciais inválidas'), criarHost(resposta));

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      codigo: 'UnauthorizedException',
      message: 'Credenciais inválidas',
    });
  });

  it('junta mensagens de validação em array numa única string', () => {
    filtro.catch(
      new BadRequestException(['email must be an email', 'senha should not be empty']),
      criarHost(resposta),
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      codigo: 'BadRequestException',
      message: 'email must be an email; senha should not be empty',
    });
  });
});
