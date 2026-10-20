import { useEffect, useState } from 'react'
import type { DashboardDTO } from '@montacontrol/shared'
import { useAuth } from '../auth/AuthContext'
import { buscarDashboard } from '../api/dashboard'
import { ErroApi } from '../api/clienteHttp'
import { formatarHora } from '../formatacao/datas'
import { filtrarPedidos, temPendencia, type FiltroPedidos } from '../formatacao/dashboard'
import { Alerta } from '../ui/Alerta'
import { Botao } from '../ui/Botao'
import { CartaoIndicador } from '../ui/CartaoIndicador'
import { SubAbas } from '../ui/SubAbas'
import { LayoutAutenticado } from './LayoutAutenticado'
import { CartaoPedido } from './dashboard/CartaoPedido'
import { FeedAlertas } from './dashboard/FeedAlertas'
import { GraficoProdutividade } from './dashboard/GraficoProdutividade'

/**
 * "Tempo real" por consulta periódica: enquanto não há WebSocket na API, o
 * dashboard se atualiza sozinho neste intervalo (e no botão Atualizar).
 */
const INTERVALO_ATUALIZACAO_MS = 30_000

const mensagemDe = (causa: unknown) =>
  causa instanceof ErroApi ? causa.message : 'Falha ao carregar o dashboard.'

/**
 * Destino N1T1 do GESTOR (US08/US09, Figura 37): onde está cada pedido — no
 * estoque (bipado pelo operador na triagem) e no cliente (bipado pelo
 * montador no descarregamento) —, o que aconteceu nas últimas 24 h e a
 * produtividade da semana.
 */
export default function Dashboard() {
  const { sessao } = useAuth()
  const token = sessao?.accessToken ?? ''
  const [dados, setDados] = useState<DashboardDTO | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<FiltroPedidos>('andamento')
  const [recarregar, setRecarregar] = useState(0)

  useEffect(() => {
    let ativo = true
    function carregar() {
      // Aba em segundo plano não consulta: a próxima volta ao foco já busca de novo.
      if (document.hidden) return
      setCarregando(true)
      buscarDashboard(token)
        .then((resposta) => {
          if (!ativo) return
          setDados(resposta)
          setErro(null)
        })
        .catch((causa: unknown) => {
          if (ativo) setErro(mensagemDe(causa))
        })
        .finally(() => {
          if (ativo) setCarregando(false)
        })
    }

    carregar()
    const intervalo = window.setInterval(carregar, INTERVALO_ATUALIZACAO_MS)
    document.addEventListener('visibilitychange', carregar)
    return () => {
      ativo = false
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', carregar)
    }
  }, [token, recarregar])

  const pedidos = dados ? filtrarPedidos(dados.pedidos, filtro) : []
  const comPendencia = dados ? dados.pedidos.filter(temPendencia).length : 0
  const indicadores = dados?.indicadores

  return (
    <LayoutAutenticado
      itemAtivo="/dashboard"
      titulo="Dashboard"
      complementoTitulo={
        <div className="flex items-center gap-8">
          {dados && (
            <span className="hidden text-body-sm text-on-surface-variant sm:inline">
              Atualizado às {formatarHora(dados.geradoEm)}
            </span>
          )}
          <Botao
            variante="icone"
            tamanho={40}
            forma="pilula"
            icone="sync"
            rotuloAcessivel="Atualizar dashboard"
            carregando={carregando}
            aoPressionar={() => setRecarregar((valor) => valor + 1)}
          />
        </div>
      }
    >
      <div className="space-y-32">
        {erro && <Alerta variante="erro" mensagem={erro} />}

        {indicadores && (
          <div className="grid gap-24 md:grid-cols-2 xl:grid-cols-4">
            <CartaoIndicador icone="groups" rotulo="Montadores em campo" valor={String(indicadores.montadoresEmCampo)} />
            <CartaoIndicador
              icone="conveyor_belt"
              rotulo="Chegaram ao estoque hoje"
              valor={String(indicadores.pecasTriadasHoje)}
              complemento="peças"
            />
            <CartaoIndicador
              icone="home_work"
              tom="destaque"
              rotulo="Descarregadas no cliente hoje"
              valor={String(indicadores.pecasDescarregadasHoje)}
              complemento="peças"
            />
            <CartaoIndicador
              icone="report"
              tom={indicadores.avariasHoje > 0 ? 'erro' : 'padrao'}
              rotulo="Avarias hoje"
              valor={String(indicadores.avariasHoje)}
              complemento={`${indicadores.avariasAbertas} em aberto`}
            />
          </div>
        )}

        {indicadores && indicadores.pecasInconsistentes > 0 && (
          <Alerta
            variante="aviso"
            titulo="Peças na obra errada"
            mensagem={`${indicadores.pecasInconsistentes} ${indicadores.pecasInconsistentes === 1 ? 'peça foi bipada' : 'peças foram bipadas'} no descarregamento de outro pedido. Confira os pedidos com pendência.`}
          />
        )}

        {dados && (
          <div className="flex flex-col gap-32 xl:flex-row xl:items-start">
            <section aria-labelledby="titulo-pedidos" className="min-w-0 flex-1 space-y-24">
              <div className="space-y-16">
                <div>
                  <h2 id="titulo-pedidos" className="text-headline-sm text-on-surface">
                    Acompanhamento de pedidos
                  </h2>
                  <p className="text-body-md text-on-surface-variant">
                    Peças bipadas no estoque pelo operador e no cliente pelo montador.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <SubAbas<FiltroPedidos>
                  abas={[
                    { id: 'andamento', rotulo: 'Em andamento' },
                    { id: 'pendencias', rotulo: 'Com pendência', contador: comPendencia },
                    { id: 'concluidos', rotulo: 'Entregues' },
                    { id: 'todos', rotulo: 'Todos' },
                  ]}
                    ativa={filtro}
                    aoMudar={setFiltro}
                  />
                </div>
              </div>

              {pedidos.length === 0 ? (
                <p className="rounded-xl bg-surface-container-low p-24 text-body-md text-on-surface-variant">
                  Nenhum pedido neste filtro.
                </p>
              ) : (
                <div className="space-y-16">
                  {pedidos.map((pedido) => (
                    <CartaoPedido key={pedido.pedidoId} pedido={pedido} />
                  ))}
                </div>
              )}
            </section>

            <div className="xl:w-larguraPainelLateral xl:shrink-0">
              <FeedAlertas alertas={dados.alertas} agora={new Date(dados.geradoEm)} />
            </div>
          </div>
        )}

        {dados && <GraficoProdutividade dias={dados.produtividade} />}

        {indicadores && (
          <div className="grid gap-24 md:grid-cols-3">
            <CartaoIndicador
              icone="warning"
              tom={indicadores.pecasInconsistentes > 0 ? 'alerta' : 'padrao'}
              rotulo="Peças na obra errada"
              valor={String(indicadores.pecasInconsistentes)}
            />
            <CartaoIndicador
              icone="report"
              tom={indicadores.avariasAbertas > 0 ? 'erro' : 'padrao'}
              rotulo="Avarias em aberto"
              valor={String(indicadores.avariasAbertas)}
            />
            <CartaoIndicador
              icone="schedule"
              tom={indicadores.episVencendo > 0 ? 'alerta' : 'padrao'}
              rotulo="EPIs vencendo em 30 dias"
              valor={String(indicadores.episVencendo)}
            />
          </div>
        )}
      </div>
    </LayoutAutenticado>
  )
}
