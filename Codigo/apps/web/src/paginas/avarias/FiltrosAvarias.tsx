import { Perfil, StatusAvaria } from '@montacontrol/shared'
import type { TipoAvariaDTO } from '@montacontrol/shared'
import { ROTULO_ORIGEM, ROTULO_STATUS_AVARIA, type FiltroTelaAvarias } from '../../formatacao/avarias'
import { CampoTexto } from '../../ui/CampoTexto'

const classeCampo =
  'h-alturaCampo w-full rounded-lg border-none bg-surface-container-low px-16 text-body-lg text-on-surface focus:bg-surface-container-lowest focus:shadow-elev2 focus:outline-none'
const classeRotulo = 'block px-4 text-label-lg uppercase text-on-surface-variant'

interface PropsFiltrosAvarias {
  filtro: FiltroTelaAvarias
  tipos: TipoAvariaDTO[]
  aoAlterar: (filtro: FiltroTelaAvarias) => void
}

export function FiltrosAvarias({ filtro, tipos, aoAlterar }: PropsFiltrosAvarias) {
  return (
    <div className="grid gap-16 md:grid-cols-2 xl:grid-cols-4">
      <CampoTexto
        rotulo="Buscar"
        iconeEsquerda="search"
        placeholder="Pedido, peça ou código…"
        valor={filtro.busca}
        aoAlterar={(busca) => aoAlterar({ ...filtro, busca })}
      />
      <div className="space-y-6">
        <label htmlFor="filtro-status-avaria" className={classeRotulo}>
          Status
        </label>
        <select
          id="filtro-status-avaria"
          value={filtro.status}
          onChange={(evento) => aoAlterar({ ...filtro, status: evento.target.value as FiltroTelaAvarias['status'] })}
          className={classeCampo}
        >
          <option value="">Todos</option>
          {Object.values(StatusAvaria).map((status) => (
            <option key={status} value={status}>
              {ROTULO_STATUS_AVARIA[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-6">
        <label htmlFor="filtro-origem-avaria" className={classeRotulo}>
          Origem
        </label>
        <select
          id="filtro-origem-avaria"
          value={filtro.origem}
          onChange={(evento) => aoAlterar({ ...filtro, origem: evento.target.value as FiltroTelaAvarias['origem'] })}
          className={classeCampo}
        >
          <option value="">Operador e montador</option>
          <option value={Perfil.DEPOSITO}>{ROTULO_ORIGEM[Perfil.DEPOSITO]}</option>
          <option value={Perfil.MONTADOR}>{ROTULO_ORIGEM[Perfil.MONTADOR]}</option>
        </select>
      </div>
      <div className="space-y-6">
        <label htmlFor="filtro-tipo-avaria" className={classeRotulo}>
          Problema
        </label>
        <select
          id="filtro-tipo-avaria"
          value={filtro.tipoAvariaId ?? ''}
          onChange={(evento) =>
            aoAlterar({ ...filtro, tipoAvariaId: evento.target.value ? Number(evento.target.value) : null })
          }
          className={classeCampo}
        >
          <option value="">Todos</option>
          {tipos.map((tipo) => (
            <option key={tipo.id} value={tipo.id}>
              {tipo.nome}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
