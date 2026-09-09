import type { PropsModal } from '@montacontrol/ui-contracts'
import { Botao } from './Botao'
import { SimboloMaterial } from './SimboloMaterial'

/** Implementação Web de `PropsModal`: header (título + fechar) / conteúdo rolável / rodapé de ações. */
export function Modal({ visivel, titulo, conteudo, acoes = [], aoFechar }: PropsModal) {
  if (!visivel) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/60 p-24"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div className="flex max-h-[80vh] w-full max-w-[560px] flex-col rounded-lg bg-surface-container-lowest shadow-elev4">
        <header className="flex items-center justify-between border-b border-outline-variant/30 px-24 py-16">
          <h2 className="text-title-md font-bold text-on-surface">{titulo}</h2>
          <button type="button" onClick={aoFechar} aria-label="Fechar">
            <SimboloMaterial nome="close" className="text-xl text-on-surface-variant" />
          </button>
        </header>
        <div className="overflow-y-auto px-24 py-16">{conteudo}</div>
        {acoes.length > 0 && (
          <footer className="flex justify-end gap-12 border-t border-outline-variant/30 px-24 py-16">
            {acoes.map((acao) => (
              <Botao
                key={acao.texto}
                variante={acao.variante ?? 'primario'}
                tamanho={40}
                forma="retangular"
                texto={acao.texto}
                aoPressionar={acao.aoPressionar}
              />
            ))}
          </footer>
        )}
      </div>
    </div>
  )
}
