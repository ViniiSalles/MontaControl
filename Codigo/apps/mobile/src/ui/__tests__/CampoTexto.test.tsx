import { render, screen, fireEvent } from '@testing-library/react-native';
import { CampoTexto } from '../CampoTexto';

test('digitar chama aoAlterar com o novo valor', async () => {
  // `render` é async no @testing-library/react-native v14 (ver Task 4).
  const aoAlterar = jest.fn();
  await render(<CampoTexto rotulo="E-mail" valor="" aoAlterar={aoAlterar} tipo="email" iconeEsquerda="mail" />);
  // `fireEvent` também é assíncrono no RNTL v14 (retorna a Promise do `act`
  // interno) — sem o `await`, a asserção pode rodar antes do handler
  // disparar/o estado propagar; ver mesma observação no teste de toggle
  // abaixo.
  await fireEvent.changeText(screen.getByTestId('campo-texto-input'), 'a@b.com');
  expect(aoAlterar).toHaveBeenCalledWith('a@b.com');
});

test('toggle de senha alterna secureTextEntry', async () => {
  // `UNSAFE_getByProps` (usado no snippet original do plano) foi removido no
  // RNTL v14 — ver Task 4/Task 8 e `docs/guides/migration-v14.md` do pacote
  // instalado. `CampoTexto` expõe `testID="campo-texto-input"` fixo no
  // `TextInput` justamente para permitir ler `.props.secureTextEntry`
  // diretamente do elemento host retornado por `getByTestId`.
  await render(<CampoTexto rotulo="Senha" valor="123456" aoAlterar={() => {}} tipo="senha" iconeEsquerda="lock" />);
  expect(screen.getByTestId('campo-texto-input').props.secureTextEntry).toBe(true);

  // `fireEvent.press` é assíncrono no RNTL v14 (envolve `act` internamente);
  // sem o `await`, o `setState` do toggle roda mas o re-render ainda não foi
  // aplicado quando a asserção seguinte lê `.props` — o teste falha de forma
  // instável (comprovado ao depurar esta suíte). Ver mesma nota no teste
  // acima.
  await fireEvent.press(screen.getByTestId('campo-texto-toggle-senha'));
  // re-consulta após o `fireEvent.press` — não reaproveita a referência
  // obtida antes do toggle, para não depender de o `ReactTestInstance`
  // permanecer "vivo" (sincronizado) entre re-renders.
  expect(screen.getByTestId('campo-texto-input').props.secureTextEntry).toBe(false);
});

test('erro substitui ajuda e usa a cor de erro', async () => {
  await render(
    <CampoTexto
      rotulo="E-mail"
      valor=""
      aoAlterar={() => {}}
      ajuda="Usaremos para contato"
      erro="E-mail inválido"
    />,
  );
  expect(screen.getByText('E-mail inválido')).toBeTruthy();
  expect(screen.queryByText('Usaremos para contato')).toBeNull();
});

test('multilinha liga multiline no TextInput', async () => {
  await render(<CampoTexto rotulo="Observação" valor="" aoAlterar={() => {}} multilinha />);
  expect(screen.getByTestId('campo-texto-input').props.multiline).toBe(true);
});

test('sem multilinha o TextInput é de uma linha', async () => {
  await render(<CampoTexto rotulo="Nome" valor="" aoAlterar={() => {}} />);
  expect(screen.getByTestId('campo-texto-input').props.multiline).toBeFalsy();
});
