import { StatusAtestado } from '@montacontrol/shared';
import { montarAtestadosExibidos } from '../atestadosComPendentes';
import type { AtestadoDaReplica, AtestadoNaFila } from '../atestadosComPendentes';

function daReplica(parcial: Partial<AtestadoDaReplica> = {}): AtestadoDaReplica {
  return {
    id: '9',
    idCliente: 'id-9',
    dataInicio: '2026-09-22',
    dataFim: '2026-09-23',
    observacao: 'Consulta e repouso.',
    status: StatusAtestado.REJEITADO,
    motivoRejeicao: 'Documento ilegível.',
    criadoEm: '2026-09-24T12:00:00.000Z',
    ...parcial,
  };
}

function naFila(parcial: Partial<AtestadoNaFila> = {}): AtestadoNaFila {
  return {
    idCliente: 'id-novo',
    status: 'pendente',
    criadoEm: '2026-10-17T10:00:00.000Z',
    payload: {
      idCliente: 'id-novo',
      dataInicio: '2026-10-15',
      dataFim: '2026-10-16',
      observacao: 'Gripe',
      fotosCaminhos: ['file:///a.jpg', 'file:///b.jpg'],
    },
    ...parcial,
  };
}

describe('montarAtestadosExibidos', () => {
  it('o atestado da réplica traz a análise do RH', () => {
    expect(montarAtestadosExibidos({ replica: [daReplica()], acoes: [] })).toEqual([
      {
        chave: 'id-9',
        dataInicio: '2026-09-22',
        dataFim: '2026-09-23',
        observacao: 'Consulta e repouso.',
        status: StatusAtestado.REJEITADO,
        motivoRejeicao: 'Documento ilegível.',
        criadoEm: '2026-09-24T12:00:00.000Z',
        aguardandoEnvio: false,
      },
    ]);
  });

  it('atestado ainda na fila aparece em análise, aguardando envio, com período e observação do payload', () => {
    const [atestado] = montarAtestadosExibidos({ replica: [], acoes: [naFila()] });

    expect(atestado).toEqual({
      chave: 'id-novo',
      dataInicio: '2026-10-15',
      dataFim: '2026-10-16',
      observacao: 'Gripe',
      status: StatusAtestado.PENDENTE,
      motivoRejeicao: null,
      criadoEm: '2026-10-17T10:00:00.000Z',
      aguardandoEnvio: true,
    });
  });

  it('sem observação no payload a observação é nula', () => {
    const { observacao: _, ...semObservacao } = naFila().payload;

    const [atestado] = montarAtestadosExibidos({
      replica: [],
      acoes: [naFila({ payload: semObservacao })],
    });

    expect(atestado.observacao).toBeNull();
  });

  it('já aceito pelo servidor e aguardando o pull: continua na lista, sem o selo', () => {
    const [atestado] = montarAtestadosExibidos({ replica: [], acoes: [naFila({ status: 'enviada' })] });

    expect(atestado.aguardandoEnvio).toBe(false);
    expect(atestado.status).toBe(StatusAtestado.PENDENTE);
  });

  it('quando o pull traz o atestado (mesmo idCliente) o da fila some: nunca há dois', () => {
    const resultado = montarAtestadosExibidos({
      replica: [
        daReplica({ idCliente: 'id-novo', status: StatusAtestado.PENDENTE, motivoRejeicao: null }),
      ],
      acoes: [naFila({ status: 'enviada' })],
    });

    expect(resultado).toHaveLength(1);
    expect(resultado[0].aguardandoEnvio).toBe(false);
  });

  it('mais recente primeiro, misturando réplica e fila', () => {
    const resultado = montarAtestadosExibidos({
      replica: [daReplica({ criadoEm: '2026-09-24T12:00:00.000Z' })],
      acoes: [naFila()],
    });

    expect(resultado.map((atestado) => atestado.chave)).toEqual(['id-novo', 'id-9']);
  });
});
