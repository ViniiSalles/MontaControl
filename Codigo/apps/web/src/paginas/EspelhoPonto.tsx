import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { EspelhoPontoDTO } from '@montacontrol/shared'
import { useAuth } from '../auth/AuthContext'
import { ErroApi } from '../api/clienteHttp'
import { buscarEspelhoPonto } from '../api/espelhoPonto'
import { Alerta } from '../ui/Alerta'
import { Cartao } from '../ui/Cartao'
import { LayoutAutenticado } from './LayoutAutenticado'

/** Minutos → `HH:mm`; hora do dia a partir do ISO, no fuso do navegador do RH. */
function formatarMinutos(minutos: number): string {
  const sinal = minutos < 0 ? '-' : ''
  const total = Math.abs(minutos)
  return `${sinal}${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`
}

function formatarHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/** US14/UC19 — espelho de ponto completo do montador, mês a mês. */
export default function EspelhoPonto() {
  const { sessao } = useAuth()
  const token = sessao?.accessToken ?? ''
  const { usuarioId } = useParams<{ usuarioId: string }>()
  const [parametros] = useSearchParams()
  const agora = new Date()
  const ano = Number(parametros.get('ano') ?? agora.getFullYear())
  const mes = Number(parametros.get('mes') ?? agora.getMonth() + 1)
  const [espelho, setEspelho] = useState<EspelhoPontoDTO | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    buscarEspelhoPonto(token, Number(usuarioId), ano, mes)
      .then((dados) => {
        if (ativo) setEspelho(dados)
      })
      .catch((causa: unknown) => {
        if (ativo) setErro(causa instanceof ErroApi ? causa.message : 'Falha ao carregar o espelho.')
      })
    return () => {
      ativo = false
    }
  }, [token, usuarioId, ano, mes])

  return (
    <LayoutAutenticado aba="Banco de Horas">
      <Cartao
        elevacao="elev1"
        tom="padrao"
        conteudo={
          <div className="space-y-16">
            <h1 className="text-title-lg font-bold text-on-surface">Espelho de Ponto</h1>
            {erro && <Alerta variante="erro" mensagem={erro} />}
            {espelho && (
              <>
                <p className="text-body-md text-on-surface-variant">
                  {espelho.usuarioNome} — {String(espelho.mes).padStart(2, '0')}/{espelho.ano}
                </p>
                <table className="w-full text-body-md text-on-surface">
                  <thead className="text-label-md uppercase text-on-surface-variant">
                    <tr>
                      <th className="py-8 text-left">Dia</th>
                      <th className="py-8 text-left">Entrada</th>
                      <th className="py-8 text-left">Saída</th>
                      <th className="py-8 text-right">Horas</th>
                      <th className="py-8 text-left">Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {espelho.dias.map((dia) => (
                      <tr key={dia.data} className="border-t border-outline-variant/30">
                        <td className="py-8">{dia.data.slice(8, 10)}</td>
                        <td className="py-8">{formatarHora(dia.inicio)}</td>
                        <td className="py-8">{formatarHora(dia.fim)}</td>
                        <td className="py-8 text-right">{formatarMinutos(dia.minutosTrabalhados)}</td>
                        <td className="py-8 text-on-surface-variant">
                          {[
                            dia.abonado ? 'Abonado' : null,
                            dia.lancadoEmAtraso ? 'Lançado em atraso' : null,
                            dia.emAndamento ? 'Sem check-out' : null,
                            !dia.diaUtil ? 'Não útil' : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <dl className="flex gap-32 text-body-md text-on-surface">
                  <div>
                    <dt className="text-label-md uppercase text-on-surface-variant">Trabalhadas</dt>
                    <dd>{formatarMinutos(espelho.minutosTrabalhados)}</dd>
                  </div>
                  <div>
                    <dt className="text-label-md uppercase text-on-surface-variant">Previstas</dt>
                    <dd>{formatarMinutos(espelho.minutosPrevistos)}</dd>
                  </div>
                  <div>
                    <dt className="text-label-md uppercase text-on-surface-variant">Abonadas</dt>
                    <dd>{formatarMinutos(espelho.minutosAbonados)}</dd>
                  </div>
                  <div>
                    <dt className="text-label-md uppercase text-on-surface-variant">Saldo do mês</dt>
                    <dd className="font-bold">{formatarMinutos(espelho.saldoMinutos)}</dd>
                  </div>
                </dl>
              </>
            )}
          </div>
        }
      />
    </LayoutAutenticado>
  )
}
