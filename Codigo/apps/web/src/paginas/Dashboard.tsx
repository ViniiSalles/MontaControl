import { Cartao } from '../ui/Cartao'
import { LayoutAutenticado } from './LayoutAutenticado'

/** Destino N1T1 do perfil GESTOR. Conteúdo real (Figura 37) fica para a fase de dashboards. */
export default function Dashboard() {
  return (
    <LayoutAutenticado aba="Dashboard">
      <Cartao
        elevacao="elev1"
        tom="padrao"
        conteudo={
          <div className="space-y-8">
            <h1 className="text-title-lg font-bold text-on-surface">Dashboard Gerencial</h1>
            <p className="text-body-md text-on-surface-variant">
              Indicadores operacionais chegam numa fase futura do projeto.
            </p>
          </div>
        }
      />
    </LayoutAutenticado>
  )
}
