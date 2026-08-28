/**
 * Pacote é só tipos — o teste real é o compilador aceitando estes exemplos
 * (rodar via `tsc --noEmit`). O runtime abaixo só confirma que os
 * subcaminhos e o barril resolvem e que os exemplos são objetos, não
 * `undefined`.
 */
import assert from 'node:assert/strict';
import type { PropsBotao } from '../src/botao';
import type { PropsCampoTexto } from '../src/campoTexto';
import type { PropsCartao } from '../src/cartao';
import type { PropsAlerta } from '../src/alerta';
import type * as barril from '../src/index';

const exemploBotao: PropsBotao = {
  variante: 'primario',
  tamanho: 56,
  forma: 'pilula',
  texto: 'Entrar',
  larguraTotal: true,
  aoPressionar: () => {},
};

const exemploCampoTexto: PropsCampoTexto = {
  rotulo: 'E-mail',
  valor: '',
  aoAlterar: () => {},
  tipo: 'email',
  iconeEsquerda: 'mail',
};

const exemploCartao: PropsCartao = {
  elevacao: 'elev4',
  tom: 'padrao',
  conteudo: null,
};

const exemploAlerta: PropsAlerta = {
  variante: 'erro',
  mensagem: 'Credenciais inválidas.',
};

// Confirma que o barril reexporta os mesmos tipos (checagem de tipo — se
// `barril.PropsBotao` não existisse, esta linha falharia a compilação).
const _viaBarril: barril.PropsBotao = exemploBotao;

for (const exemplo of [exemploBotao, exemploCampoTexto, exemploCartao, exemploAlerta, _viaBarril]) {
  assert.equal(typeof exemplo, 'object');
}

console.log('OK — @montacontrol/ui-contracts smoke test (compilação + resolução) passou.');
