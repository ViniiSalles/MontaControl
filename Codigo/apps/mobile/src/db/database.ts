import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { migrations } from './migrations';
import { Jornada } from './Jornada';
import { BancoHoras } from './BancoHoras';
import { AcaoPendente } from './AcaoPendente';
import { Pedido } from './Pedido';
import { Ambiente } from './Ambiente';
import { Peca } from './Peca';
import { TipoAvaria } from './TipoAvaria';
import { Avaria } from './Avaria';
import { Atestado } from './Atestado';
import { contarAcoesNaFila, lerDonoNoBanco, registrarDonoNoBanco } from './donoDaFila';
import { limparBancoCompleto } from './limparBanco';
import { limparEspelhoLocal } from './limparEspelho';

const adapter = new SQLiteAdapter({
  schema,
  // Obrigatório: sem migração, subir `schema.version` reseta o banco e apaga `acoes_pendentes`.
  migrations,
  jsi: true,
  onSetUpError: () => {
    // Falha ao abrir o banco local — o app continua funcionando (a leitura
    // reativa simplesmente não emite nada), sem ação de recuperação melhor
    // possível aqui além do próximo boot.
  },
});

export const database = new Database({
  adapter,
  modelClasses: [
    Jornada,
    BancoHoras,
    AcaoPendente,
    Pedido,
    Ambiente,
    Peca,
    TipoAvaria,
    Avaria,
    Atestado,
  ],
});

/**
 * Apaga TUDO, inclusive a fila de ações pendentes, o `localStorage` do banco
 * (o `lastPulledAt` do `synchronize()` e o dono da fila) e as fotos em
 * arquivo (ver `db/limparBanco`). Chamado no logout explícito
 * (`AuthContext.sair`) e quando outro usuário entra no aparelho — sem isto, um
 * segundo montador veria o espelho de jornada do anterior (ou enviaria as
 * ações dele).
 */
export const limparBancoLocal = () => limparBancoCompleto(database);

/**
 * Apaga a réplica do servidor e mantém a fila de ações pendentes. Usado na
 * expiração forçada da sessão (refresh recusado), ver `db/limparEspelho`.
 */
export async function limparEspelhoBancoLocal(): Promise<void> {
  await limparEspelhoLocal(database);
}

/** Dono e tamanho da fila no banco real (ver `db/donoDaFila`). */
export const contarAcoesNaFilaLocal = () => contarAcoesNaFila(database);
export const lerDonoNoBancoLocal = () => lerDonoNoBanco(database);
export const registrarDonoNoBancoLocal = (usuarioId: number) =>
  registrarDonoNoBanco(database, usuarioId);
