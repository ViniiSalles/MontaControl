import { useRef, useState } from 'react'
import { UFS } from '@montacontrol/shared'
import type { CoordenadasEncontradasDTO, GeocodificarEnderecoRequest, SalvarClienteRequest } from '@montacontrol/shared'
import { buscarEnderecoPorCep } from '../../api/viaCep'
import {
  linkMapa,
  mascararCep,
  mascararTelefone,
  validarRascunhoCliente,
  type ErrosCliente,
  type RascunhoCliente,
} from '../../formatacao/clientes'
import { Alerta } from '../../ui/Alerta'
import { Botao } from '../../ui/Botao'
import { CampoTexto } from '../../ui/CampoTexto'
import { Modal } from '../../ui/Modal'

const classeCampo =
  'h-alturaCampo w-full rounded-lg border-none bg-surface-container-low px-16 text-body-lg text-on-surface focus:bg-surface-container-lowest focus:shadow-elev2 focus:outline-none'

interface PropsModalCliente {
  titulo: string
  inicial: RascunhoCliente
  erro: string | null
  aoFechar: () => void
  /** Rejeita quando falha, para o modal continuar aberto com os dados. */
  aoSalvar: (dados: SalvarClienteRequest) => Promise<void>
  /** Rejeita com a mensagem a exibir quando o endereço não é localizado. */
  aoLocalizar: (endereco: GeocodificarEnderecoRequest) => Promise<CoordenadasEncontradasDTO>
}

/**
 * Cadastro/edição do local da obra. As coordenadas são a referência do
 * check-in do montador, então o gestor localiza pelo endereço e confere no
 * mapa — ou digita à mão se o serviço de mapas não achar.
 */
export function ModalCliente({ titulo, inicial, erro, aoFechar, aoSalvar, aoLocalizar }: PropsModalCliente) {
  const [rascunho, setRascunho] = useState<RascunhoCliente>(inicial)
  const [erros, setErros] = useState<ErrosCliente>({})
  const [salvando, setSalvando] = useState(false)
  const [localizando, setLocalizando] = useState(false)
  const [encontrado, setEncontrado] = useState<string | null>(null)
  const [falhaLocalizacao, setFalhaLocalizacao] = useState<string | null>(null)
  /** Só a resposta do último CEP digitado pode preencher o endereço. */
  const ultimoCepRef = useRef('')

  function alterar(campo: keyof RascunhoCliente, valor: string) {
    setRascunho((atual) => ({ ...atual, [campo]: valor }))
    setErros((atuais) => ({ ...atuais, [campo]: undefined }))
  }

  async function aoAlterarCep(valor: string) {
    const cep = mascararCep(valor)
    alterar('cep', cep)
    if (cep.length !== 9) return
    ultimoCepRef.current = cep
    const achado = await buscarEnderecoPorCep(cep)
    if (!achado || ultimoCepRef.current !== cep) return
    setRascunho((atual) => ({
      ...atual,
      // Mantém o que o gestor já digitou; o número da casa vem dele.
      endereco: atual.endereco || [achado.logradouro, achado.bairro].filter(Boolean).join(', '),
      cidade: achado.cidade || atual.cidade,
      estado: achado.estado || atual.estado,
    }))
  }

  async function localizar() {
    setFalhaLocalizacao(null)
    setEncontrado(null)
    if (!rascunho.endereco.trim() || !rascunho.cidade.trim() || !rascunho.estado) {
      setFalhaLocalizacao('Preencha endereço, cidade e UF para localizar.')
      return
    }
    setLocalizando(true)
    try {
      const coordenadas = await aoLocalizar({
        endereco: rascunho.endereco.trim(),
        cidade: rascunho.cidade.trim(),
        estado: rascunho.estado,
        ...(rascunho.cep.length === 9 ? { cep: rascunho.cep } : {}),
      })
      setRascunho((atual) => ({
        ...atual,
        latitude: String(coordenadas.latitude),
        longitude: String(coordenadas.longitude),
      }))
      setErros((atuais) => ({ ...atuais, latitude: undefined, longitude: undefined }))
      setEncontrado(coordenadas.enderecoEncontrado)
    } catch (causa: unknown) {
      setFalhaLocalizacao(causa instanceof Error ? causa.message : 'Não foi possível localizar o endereço.')
    } finally {
      setLocalizando(false)
    }
  }

  async function aoConfirmar() {
    if (salvando) return
    const { erros: encontrados, dados } = validarRascunhoCliente(rascunho)
    setErros(encontrados)
    if (!dados) return
    setSalvando(true)
    try {
      await aoSalvar(dados)
    } catch {
      // A página guardou a mensagem em `erro`; aqui só mantemos o que foi preenchido.
    } finally {
      setSalvando(false)
    }
  }

  const mapa = linkMapa(rascunho.latitude, rascunho.longitude)

  return (
    <Modal
      visivel
      apresentacao="centro"
      titulo={titulo}
      aoFechar={aoFechar}
      acoes={[
        { texto: 'Cancelar', variante: 'fantasma', aoPressionar: aoFechar },
        { texto: salvando ? 'Salvando…' : 'Salvar', aoPressionar: () => void aoConfirmar() },
      ]}
      conteudo={
        <div className="space-y-16">
          {erro && <Alerta variante="erro" mensagem={erro} />}
          <CampoTexto rotulo="Nome do cliente" valor={rascunho.nome} aoAlterar={(valor) => alterar('nome', valor)} erro={erros.nome} obrigatorio />
          <div className="grid gap-16 md:grid-cols-2">
            <CampoTexto
              rotulo="CEP"
              placeholder="00000-000"
              valor={rascunho.cep}
              aoAlterar={(valor) => void aoAlterarCep(valor)}
              ajuda="Preenche o endereço automaticamente"
              erro={erros.cep}
              obrigatorio
            />
            <CampoTexto
              rotulo="Telefone"
              placeholder="(31) 99999-9999"
              valor={rascunho.telefone}
              aoAlterar={(valor) => alterar('telefone', mascararTelefone(valor))}
              erro={erros.telefone}
              obrigatorio
            />
          </div>
          <CampoTexto
            rotulo="Endereço (rua, número, bairro)"
            valor={rascunho.endereco}
            aoAlterar={(valor) => alterar('endereco', valor)}
            erro={erros.endereco}
            obrigatorio
          />
          <div className="grid gap-16 md:grid-cols-[1fr_120px]">
            <CampoTexto rotulo="Cidade" valor={rascunho.cidade} aoAlterar={(valor) => alterar('cidade', valor)} erro={erros.cidade} obrigatorio />
            <div className="space-y-6">
              <label htmlFor="uf-cliente" className="block px-4 text-label-lg uppercase text-on-surface-variant">
                UF
              </label>
              <select
                id="uf-cliente"
                value={rascunho.estado}
                onChange={(evento) => alterar('estado', evento.target.value)}
                className={classeCampo}
                aria-invalid={erros.estado ? true : undefined}
              >
                <option value="">—</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
              {erros.estado && <p className="px-4 text-body-sm text-error">{erros.estado}</p>}
            </div>
          </div>

          <section className="space-y-12 rounded-lg bg-surface-container-low p-16">
            <div className="flex flex-wrap items-center justify-between gap-12">
              <div>
                <p className="text-title-sm text-on-surface">Localização da obra</p>
                <p className="text-body-sm text-on-surface-variant">Referência para o check-in dos montadores.</p>
              </div>
              <Botao
                variante="tonal"
                tamanho={40}
                forma="pilula"
                icone="location_on"
                texto="Localizar pelo endereço"
                carregando={localizando}
                aoPressionar={() => void localizar()}
              />
            </div>
            {falhaLocalizacao && <Alerta variante="aviso" mensagem={falhaLocalizacao} />}
            {encontrado && <p className="text-body-sm text-on-surface-variant">Encontrado: {encontrado}</p>}
            <div className="grid gap-16 md:grid-cols-2">
              <CampoTexto rotulo="Latitude" placeholder="-19.9325" valor={rascunho.latitude} aoAlterar={(valor) => alterar('latitude', valor)} erro={erros.latitude} obrigatorio />
              <CampoTexto rotulo="Longitude" placeholder="-43.9382" valor={rascunho.longitude} aoAlterar={(valor) => alterar('longitude', valor)} erro={erros.longitude} obrigatorio />
            </div>
            {mapa && (
              <a href={mapa} target="_blank" rel="noreferrer" className="inline-block text-body-md text-primary underline">
                Conferir no mapa
              </a>
            )}
          </section>
        </div>
      }
    />
  )
}
