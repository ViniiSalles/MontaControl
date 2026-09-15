import { useEffect, useState } from 'react'
import { Perfil } from '@montacontrol/shared'
import type { UsuarioDTO } from '@montacontrol/shared'
import { useAuth } from '../auth/AuthContext'
import { alterarAtivoUsuario, cadastrarUsuario, listarUsuarios } from '../api/usuarios'
import { ErroApi } from '../api/clienteHttp'
import { Alerta } from '../ui/Alerta'
import { Botao } from '../ui/Botao'
import { CampoTexto } from '../ui/CampoTexto'
import { Cartao } from '../ui/Cartao'
import { LayoutAutenticado } from './LayoutAutenticado'

const FORMULARIO_VAZIO = { nome: '', email: '', senha: '', telefone: '' }

/** US12/UC17 — cadastro e desligamento de montadores pelo RH (Figura 31). */
export default function Montadores() {
  const { sessao } = useAuth()
  const token = sessao?.accessToken ?? ''
  const [montadores, setMontadores] = useState<UsuarioDTO[]>([])
  const [formulario, setFormulario] = useState(FORMULARIO_VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let ativo = true
    listarUsuarios(token)
      .then((usuarios) => {
        if (ativo) setMontadores(usuarios.filter((usuario) => usuario.perfil === Perfil.MONTADOR))
      })
      .catch((causa: unknown) => {
        if (ativo) setErro(causa instanceof ErroApi ? causa.message : 'Falha ao carregar montadores.')
      })
    return () => {
      ativo = false
    }
  }, [token])

  async function aoCadastrar() {
    setErro(null)
    setAviso(null)
    setSalvando(true)

    try {
      const criado = await cadastrarUsuario(token, {
        ...formulario,
        telefone: formulario.telefone.trim() || undefined,
        perfil: Perfil.MONTADOR,
      })
      setMontadores((atuais) => [...atuais, criado].sort((a, b) => a.nome.localeCompare(b.nome)))
      setFormulario(FORMULARIO_VAZIO)
      setAviso(`Montador ${criado.nome} cadastrado.`)
    } catch (causa: unknown) {
      setErro(causa instanceof ErroApi ? causa.message : 'Falha ao cadastrar montador.')
    } finally {
      setSalvando(false)
    }
  }

  async function aoAlternarSituacao(montador: UsuarioDTO) {
    setErro(null)
    try {
      const atualizado = await alterarAtivoUsuario(token, montador.id, !montador.ativo)
      setMontadores((atuais) =>
        atuais.map((item) => (item.id === atualizado.id ? atualizado : item)),
      )
    } catch (causa: unknown) {
      setErro(causa instanceof ErroApi ? causa.message : 'Falha ao alterar a situação.')
    }
  }

  return (
    <LayoutAutenticado aba="Montadores">
      <div className="space-y-24">
        <Cartao
          elevacao="elev1"
          tom="padrao"
          conteudo={
            <div className="space-y-16">
              <h1 className="text-title-lg font-bold text-on-surface">Cadastro de Montadores</h1>
              {erro && <Alerta variante="erro" mensagem={erro} />}
              {aviso && <Alerta variante="sucesso" mensagem={aviso} />}
              <div className="grid grid-cols-4 gap-16">
                <CampoTexto
                  rotulo="Nome"
                  valor={formulario.nome}
                  aoAlterar={(valor) => setFormulario((atual) => ({ ...atual, nome: valor }))}
                />
                <CampoTexto
                  rotulo="E-mail"
                  tipo="email"
                  valor={formulario.email}
                  aoAlterar={(valor) => setFormulario((atual) => ({ ...atual, email: valor }))}
                />
                <CampoTexto
                  rotulo="Senha"
                  tipo="senha"
                  valor={formulario.senha}
                  aoAlterar={(valor) => setFormulario((atual) => ({ ...atual, senha: valor }))}
                />
                <CampoTexto
                  rotulo="Telefone"
                  placeholder="(11) 91234-5678"
                  valor={formulario.telefone}
                  aoAlterar={(valor) => setFormulario((atual) => ({ ...atual, telefone: valor }))}
                />
              </div>
              <Botao
                variante="primario"
                tamanho={40}
                forma="retangular"
                texto={salvando ? 'Cadastrando…' : 'Cadastrar'}
                aoPressionar={() => void aoCadastrar()}
              />
            </div>
          }
        />

        <Cartao
          elevacao="elev1"
          tom="padrao"
          conteudo={
            <table className="w-full text-body-md text-on-surface">
              <thead className="text-label-md uppercase text-on-surface-variant">
                <tr>
                  <th className="py-8 text-left">Nome</th>
                  <th className="py-8 text-left">E-mail</th>
                  <th className="py-8 text-left">Telefone</th>
                  <th className="py-8 text-left">Situação</th>
                  <th className="py-8 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {montadores.map((montador) => (
                  <tr key={montador.id} className="border-t border-outline-variant/30">
                    <td className="py-8">{montador.nome}</td>
                    <td className="py-8">{montador.email}</td>
                    <td className="py-8">{montador.telefone ?? '—'}</td>
                    <td className="py-8">{montador.ativo ? 'Ativo' : 'Inativo'}</td>
                    <td className="py-8 text-right">
                      <Botao
                        variante="fantasma"
                        tamanho={40}
                        forma="retangular"
                        texto={montador.ativo ? 'Inativar' : 'Reativar'}
                        aoPressionar={() => void aoAlternarSituacao(montador)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        />
      </div>
    </LayoutAutenticado>
  )
}
