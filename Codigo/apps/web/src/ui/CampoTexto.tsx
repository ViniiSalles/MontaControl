import { useId, useState } from 'react'
import type { PropsCampoTexto } from '@montacontrol/ui-contracts/campo-texto'
import { SimboloMaterial } from './SimboloMaterial'

const tipoNativoPorTipo: Record<NonNullable<PropsCampoTexto['tipo']>, string> = {
  texto: 'text',
  email: 'email',
  senha: 'password',
  numero: 'number',
}

/** Ver `login_montacontrol:107-133` — contrato completo em `@montacontrol/ui-contracts/campo-texto`. */
export function CampoTexto({
  rotulo,
  valor,
  aoAlterar,
  tipo = 'texto',
  placeholder,
  iconeEsquerda,
  acaoRotulo,
  erro,
  ajuda,
  obrigatorio = false,
  desabilitado = false,
}: PropsCampoTexto) {
  const id = useId()
  const [senhaVisivel, setSenhaVisivel] = useState(false)
  const ehSenha = tipo === 'senha'
  const tipoNativo = ehSenha && senhaVisivel ? 'text' : tipoNativoPorTipo[tipo]
  const mensagem = erro ?? ajuda

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-4">
        <label htmlFor={id} className="text-label-lg uppercase text-on-surface-variant">
          {rotulo}
          {obrigatorio && <span aria-hidden="true"> *</span>}
        </label>
        {acaoRotulo && (
          <button
            type="button"
            onClick={acaoRotulo.aoPressionar}
            className="text-label-sm font-semibold text-primary hover:text-on-primary-fixed-variant"
          >
            {acaoRotulo.texto}
          </button>
        )}
      </div>
      <div className="group relative">
        {iconeEsquerda && (
          <SimboloMaterial
            nome={iconeEsquerda}
            className="pointer-events-none absolute left-16 top-1/2 -translate-y-1/2 text-xl text-outline transition-colors group-focus-within:text-primary"
          />
        )}
        <input
          id={id}
          type={tipoNativo}
          value={valor}
          placeholder={placeholder}
          disabled={desabilitado}
          required={obrigatorio}
          aria-invalid={Boolean(erro)}
          onChange={(evento) => aoAlterar(evento.target.value)}
          className={[
            'h-alturaCampo w-full rounded-lg border-none bg-surface-container-low text-on-surface shadow-sm',
            'placeholder:text-outline/50 transition-all focus:bg-white focus:shadow-md focus:outline-none focus:ring-0',
            'disabled:opacity-50',
            iconeEsquerda ? 'pl-48' : 'pl-16',
            ehSenha ? 'pr-48' : 'pr-16',
          ].join(' ')}
        />
        {ehSenha && (
          <button
            type="button"
            onClick={() => setSenhaVisivel((visivel) => !visivel)}
            className="absolute right-16 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant"
            aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
          >
            <SimboloMaterial nome={senhaVisivel ? 'visibility_off' : 'visibility'} className="text-xl" />
          </button>
        )}
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-2 w-0 -translate-x-1/2 bg-primary transition-all duration-300 group-focus-within:w-full" />
      </div>
      {mensagem && (
        <p className={erro ? 'text-label-md text-error' : 'text-label-md text-on-surface-variant'}>{mensagem}</p>
      )}
    </div>
  )
}
