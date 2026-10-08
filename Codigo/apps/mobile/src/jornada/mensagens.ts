import type { VarianteAlerta } from '@montacontrol/ui-contracts/alerta';
import { RAIO_TOLERANCIA_PONTO_METROS } from '@montacontrol/shared';
import type { ResultadoAcao } from './acoes';
import { formatarHora } from './formatacao';
import { derivarUltimoPonto, rotuloPonto } from './ultimoPonto';

/** Conteúdo pronto para o `<Alerta>` da tela de jornada. */
export interface AvisoAcao {
  variante: VarianteAlerta;
  titulo: string;
  mensagem: string;
}

/**
 * Recusas de regra que a API devolve no check-in/check-out
 * (`apps/api/src/jornadas/exceptions`). O texto aqui é reescrito para o
 * montador — o `message` da API descreve o estado ("já existe uma jornada em
 * andamento"), e quem está com o celular na mão precisa saber o que fazer.
 */
const mensagemPorCodigo: Record<string, string> = {
  JORNADA_EM_ANDAMENTO:
    'Já existe uma jornada aberta para você. Atualize a tela e registre a saída antes de uma nova entrada.',
  SEM_JORNADA_ABERTA:
    'Não há jornada aberta para encerrar. Atualize a tela para ver o estado real do seu ponto.',
  CHECKOUT_ANTES_DO_CHECKIN:
    'O relógio do aparelho está atrás do horário da entrada. Ajuste a data e a hora do celular e tente de novo.',
  REGISTRO_FORA_DA_JANELA:
    'Este horário está fora da janela aceita. Peça o lançamento pelo ponto em atraso.',
  FORA_DO_RAIO_TOLERADO: `Você precisa estar a até ${RAIO_TOLERANCIA_PONTO_METROS} m do endereço da obra para bater o ponto.`,
  PEDIDO_INVALIDO:
    'Esta obra não está mais atribuída a você. Atualize a tela e escolha a obra de novo, ou fale com o gestor.',
};

const MENSAGEM_RECUSA_PADRAO =
  'O registro foi recusado pelo servidor. Fale com seu gestor antes de tentar de novo.';

const mensagemPorMotivoDeLocalizacao = {
  permissao_negada:
    'O app precisa da sua localização para registrar o ponto. Libere o acesso nos ajustes do aparelho.',
  servico_desligado: 'A localização do aparelho está desligada. Ligue o GPS e toque de novo.',
  indisponivel:
    'Não foi possível obter sua posição. Vá para um lugar mais aberto e tente de novo em instantes.',
} as const;

function formatarDistancia(metros: number): string {
  return metros < 1000 ? `${metros} m` : `${(metros / 1000).toFixed(1).replace('.', ',')} km`;
}

/**
 * Traduz o desfecho de `registrarCheckin`/`registrarCheckout` no aviso que a
 * tela mostra. Fica separado da tela porque cada desfecho tem uma instrução
 * de ação diferente, e é isso que o teste precisa fixar.
 */
export function avisoDoResultado(resultado: ResultadoAcao): AvisoAcao {
  switch (resultado.tipo) {
    case 'ok': {
      const ponto = derivarUltimoPonto(resultado.jornada);
      // `ponto` nulo só existiria com uma jornada sem check-in nem check-out,
      // que a API não devolve como resposta de um registro bem-sucedido.
      const descricao = ponto
        ? `Ponto de ${rotuloPonto(ponto.tipo)} registrado às ${formatarHora(ponto.registradoEm)}.`
        : 'Ponto registrado.';
      return { variante: 'sucesso', titulo: 'Tudo certo', mensagem: descricao };
    }
    case 'sem_localizacao':
      return {
        variante: 'aviso',
        titulo: 'Localização indisponível',
        mensagem: mensagemPorMotivoDeLocalizacao[resultado.motivo],
      };
    case 'fora_do_raio':
      return {
        variante: 'aviso',
        titulo: 'Longe da obra',
        mensagem: `Você está a cerca de ${formatarDistancia(resultado.distanciaMetros)} do endereço da obra. O ponto só pode ser batido a até ${RAIO_TOLERANCIA_PONTO_METROS} m.`,
      };
    case 'recusado':
      return {
        variante: 'erro',
        titulo: 'Ponto não registrado',
        mensagem: mensagemPorCodigo[resultado.codigo] ?? MENSAGEM_RECUSA_PADRAO,
      };
  }
}
