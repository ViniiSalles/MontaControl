import { useEffect, useState } from 'react'
import type { RastreioPecaDTO } from '@montacontrol/shared'
import { rastrearPecasPedido } from '../../api/dashboard'
import { ErroApi } from '../../api/clienteHttp'
import { formatarDataHoraCurta } from '../../formatacao/datas'
import { ROTULO_STATUS_PECA, VARIANTE_STATUS_PECA } from '../../formatacao/dashboard'
import { Alerta } from '../../ui/Alerta'
import { BadgeStatus } from '../../ui/BadgeStatus'
import { TabelaDados, type ColunaTabela } from '../../ui/TabelaDados'

function Bipagem({ quem, em }: { quem: string | null; em: string | null }) {
  if (!em) return <span className="text-on-surface-variant">—</span>
  return (
    <div>
      <p className="text-body-sm text-on-surface">{quem ?? 'Não identificado'}</p>
      <p className="whitespace-nowrap text-body-sm text-on-surface-variant">{formatarDataHoraCurta(em)}</p>
    </div>
  )
}

const COLUNAS: ColunaTabela<RastreioPecaDTO>[] = [
  {
    titulo: 'Peça',
    ordenacao: { tipo: 'texto', valor: (peca) => peca.descricao },
    render: (peca) => (
      <div>
        <p className="text-title-sm text-on-surface">
          {peca.descricao}
          {peca.quantidade > 1 && <span className="text-on-surface-variant"> ×{peca.quantidade}</span>}
        </p>
        <p className="text-body-sm text-on-surface-variant">
          {peca.ambiente}
          {peca.codigoBarras ? ` · ${peca.codigoBarras}` : ''}
        </p>
      </div>
    ),
  },
  {
    titulo: 'Situação',
    ordenacao: { tipo: 'texto', valor: (peca) => ROTULO_STATUS_PECA[peca.status] },
    render: (peca) => <BadgeStatus variante={VARIANTE_STATUS_PECA[peca.status]} texto={ROTULO_STATUS_PECA[peca.status]} />,
  },
  {
    titulo: 'Triagem (estoque)',
    ordenacao: { tipo: 'data', valor: (peca) => peca.triadaEm },
    render: (peca) => <Bipagem quem={peca.triadaPor} em={peca.triadaEm} />,
  },
  {
    titulo: 'Descarregamento (cliente)',
    ordenacao: { tipo: 'data', valor: (peca) => peca.conferidaEm },
    render: (peca) => <Bipagem quem={peca.conferidaPor} em={peca.conferidaEm} />,
  },
]

/** Quem bipou cada peça do pedido — carregado só quando o gestor abre o rastreio. */
export function RastreioPecas({ token, pedidoId }: { token: string; pedidoId: number }) {
  const [pecas, setPecas] = useState<RastreioPecaDTO[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    rastrearPecasPedido(token, pedidoId)
      .then((resposta) => {
        if (ativo) setPecas(resposta)
      })
      .catch((causa: unknown) => {
        if (ativo) setErro(causa instanceof ErroApi ? causa.message : 'Falha ao carregar o rastreio das peças.')
      })
    return () => {
      ativo = false
    }
  }, [token, pedidoId])

  if (erro) return <Alerta variante="erro" mensagem={erro} />
  if (!pecas) return <p className="text-body-sm text-on-surface-variant">Carregando bipagens…</p>
  return (
    <TabelaDados
      rotulo="Rastreio das peças"
      colunas={COLUNAS}
      linhas={pecas}
      chave={(peca) => peca.pecaId}
      vazio="Nenhuma peça cadastrada para este pedido."
    />
  )
}
