import { Cartao } from '../ui/Cartao'
import { LayoutAutenticado } from './LayoutAutenticado'

/** Destino N1T1 do perfil DEPOSITO. Conteúdo real (Figura 28) fica para a fase de triagem de peças. */
export default function Triagem() {
  return (
    <LayoutAutenticado itemAtivo="/triagem" titulo="Triagem de Peças">
      <Cartao
        elevacao="elev1"
        tom="padrao"
        conteudo={
          <div className="space-y-8">
            <h2 className="text-title-lg font-bold text-on-surface">Leitura de peças</h2>
            <p className="text-body-md text-on-surface-variant">
              Conferência de peças recebidas chega numa fase futura do projeto.
            </p>
          </div>
        }
      />
    </LayoutAutenticado>
  )
}
