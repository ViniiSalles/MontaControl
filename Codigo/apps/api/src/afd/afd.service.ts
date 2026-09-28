import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { limitesDoMes, periodoDoMes } from '@montacontrol/shared';
import { FUSO_OPERACAO } from '../common/fuso';
import { montarArquivoAfd } from './afd-leiaute';
import { MarcacoesRepository } from './marcacoes.repository';
import { MontadoresSemCpfException } from './exceptions/montadores-sem-cpf.exception';

@Injectable()
export class AfdService {
  constructor(
    private readonly marcacoes: MarcacoesRepository,
    private readonly config: ConfigService,
  ) {}

  async gerar(ano: number, mes: number): Promise<{ conteudo: Buffer; nomeArquivo: string }> {
    const selagem = await this.marcacoes.selarPendentes();
    if (!selagem.ok) throw new MontadoresSemCpfException(selagem.montadoresSemCpf);

    const { inicioIso, fimIso } = limitesDoMes(mes, ano, FUSO_OPERACAO);
    const { inicio, fim } = periodoDoMes(ano, mes);
    const marcacoesDoPeriodo = await this.marcacoes.listarNoPeriodo(inicioIso, fimIso);

    const { conteudo, nomeArquivo } = montarArquivoAfd({
      empresa: {
        cnpj: this.config.getOrThrow<string>('EMPRESA_CNPJ'),
        razaoSocial: this.config.getOrThrow<string>('EMPRESA_RAZAO_SOCIAL'),
        registroInpi: this.config.getOrThrow<string>('REP_P_REGISTRO_INPI'),
        cnpjDesenvolvedor: this.config.getOrThrow<string>('DESENVOLVEDOR_CNPJ'),
      },
      dataInicial: inicio,
      dataFinal: fim,
      geradoEmIso: new Date().toISOString(),
      fuso: FUSO_OPERACAO,
      marcacoes: marcacoesDoPeriodo.map((marcacao) => ({
        nsr: marcacao.nsr,
        cpf: marcacao.cpf,
        marcadoEmIso: marcacao.marcadoEm.toISOString(),
        gravadoEmIso: marcacao.gravadoEm.toISOString(),
        coletor: marcacao.coletor,
        offline: marcacao.offline,
        hash: marcacao.hash,
      })),
    });

    return { conteudo: Buffer.from(conteudo, 'latin1'), nomeArquivo };
  }
}
