import { registerDecorator, ValidationOptions } from 'class-validator';
import { cpfValido } from '@montacontrol/shared';

export function IsCpf(opcoes?: ValidationOptions) {
  return (objeto: object, propriedade: string) => {
    registerDecorator({
      name: 'isCpf',
      target: objeto.constructor,
      propertyName: propriedade,
      options: { message: 'CPF inválido', ...opcoes },
      validator: { validate: (valor: unknown) => typeof valor === 'string' && cpfValido(valor) },
    });
  };
}
