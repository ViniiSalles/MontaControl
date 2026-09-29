import type { SolicitacaoPontoDTO } from '@montacontrol/shared'
import { formatarDiaCivil, formatarHora } from '../../formatacao/datas'
import { formatarMinutos } from '../../formatacao/horas'
import { Avatar } from '../../ui/Avatar'
import { Botao } from '../../ui/Botao'
import { TabelaDados, type ColunaTabela } from '../../ui/TabelaDados'

interface PropsAbaSolicitacoes {
  compensacoes: SolicitacaoPontoDTO[]
  aoAprovar: (compensacao: SolicitacaoPontoDTO) => void
  aoRejeitar: (compensacao: SolicitacaoPontoDTO) => void
}

export function AbaSolicitacoes({ compensacoes, aoAprovar, aoRejeitar }: PropsAbaSolicitacoes) {
  const colunas: ColunaTabela<SolicitacaoPontoDTO>[] = [
    {
      titulo: 'Montador',
      render: (item) => (
        <div className="flex items-center gap-12">
          <Avatar nome={item.usuarioNome} />
          <span className="text-title-sm">{item.usuarioNome}</span>
        </div>
      ),
    },
    { titulo: 'Data', render: (item) => formatarDiaCivil(item.data) },
    { titulo: 'Período', render: (item) => `${formatarHora(item.inicio)} – ${formatarHora(item.fim)}` },
    { titulo: 'Horas', alinhamento: 'direita', render: (item) => `${formatarMinutos(item.minutosSolicitados)}h` },
    { titulo: 'Justificativa', render: (item) => <span className="text-on-surface-variant">{item.justificativa}</span> },
    {
      titulo: 'Ações',
      alinhamento: 'direita',
      render: (item) => (
        <div className="flex justify-end gap-8">
          <Botao variante="primario" tamanho={40} forma="pilula" texto="Aprovar" aoPressionar={() => aoAprovar(item)} />
          <Botao variante="fantasma" tamanho={40} forma="pilula" texto="Rejeitar" aoPressionar={() => aoRejeitar(item)} />
        </div>
      ),
    },
  ]
  return (
    <TabelaDados
      rotulo="Compensações aguardando aprovação"
      colunas={colunas}
      linhas={compensacoes}
      chave={(item) => item.id}
      vazio="Nenhuma compensação pendente."
    />
  )
}
