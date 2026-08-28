import { Cartao } from '../ui/Cartao'
import { LayoutAutenticado } from './LayoutAutenticado'

/** Destino N1T1 do perfil DEPOSITO. Conteúdo real (Figura 28) fica para a fase de triagem de peças. */
export default function Triagem() {
  return (
    <LayoutAutenticado aba="Triagem">
      <Cartao
        elevacao="elev1"
        tom="padrao"
        conteudo={
          <div className="space-y-8">
            <h1 className="text-title-lg font-bold text-on-surface">Triagem de Peças</h1>
            <p className="text-body-md text-on-surface-variant">
              Conferência de peças recebidas chega numa fase futura do projeto.
            </p>
          </div>
        }
      />
    </LayoutAutenticado>
  )
}
