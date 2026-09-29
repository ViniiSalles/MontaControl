interface AbaSimples<Id extends string> {
  id: Id
  rotulo: string
  contador?: number
}

interface PropsSubAbas<Id extends string> {
  abas: AbaSimples<Id>[]
  ativa: Id
  aoMudar: (id: Id) => void
}

/** Abas de texto sublinhadas do cabeçalho (`banco_de_horas`: Resumo Geral / Solicitações). */
export function SubAbas<Id extends string>({ abas, ativa, aoMudar }: PropsSubAbas<Id>) {
  return (
    <div role="tablist" className="flex items-center gap-24">
      {abas.map((aba) => (
        <button
          key={aba.id}
          type="button"
          role="tab"
          aria-selected={aba.id === ativa}
          onClick={() => aoMudar(aba.id)}
          className={[
            'border-b-2 py-4 text-body-md transition-colors',
            aba.id === ativa ? 'border-primary font-semibold text-primary' : 'border-transparent text-on-surface-variant hover:text-primary',
          ].join(' ')}
        >
          {aba.rotulo}
          {aba.contador !== undefined && aba.contador > 0 && (
            <span className="ml-8 rounded-full bg-error px-6 text-label-sm text-on-error">{aba.contador}</span>
          )}
        </button>
      ))}
    </div>
  )
}
