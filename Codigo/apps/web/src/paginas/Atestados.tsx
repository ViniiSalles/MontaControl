import { Cartao } from '../ui/Cartao'
import { LayoutAutenticado } from './LayoutAutenticado'

/** Destino N1T1 do perfil RH. Conteúdo real (Figura 30) fica para a fase de gestão de atestados. */
export default function Atestados() {
  return (
    <LayoutAutenticado aba="Atestados">
      <Cartao
        elevacao="elev1"
        tom="padrao"
        conteudo={
          <div className="space-y-8">
            <h1 className="text-title-lg font-bold text-on-surface">Gestão de Atestados</h1>
            <p className="text-body-md text-on-surface-variant">
              Fila de validação de atestados chega numa fase futura do projeto.
            </p>
          </div>
        }
      />
    </LayoutAutenticado>
  )
}
