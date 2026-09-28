/**
 * Chave do `pg_advisory_xact_lock` que serializa a geração de NSR (no
 * check-in/check-out) e a selagem de hash das marcações de ponto (AFD) —
 * sem isso, duas transações concorrentes poderiam calcular o mesmo
 * `MAX(nsr)+1` e colidir na constraint única, ou selar hashes fora de ordem.
 * Valor arbitrário; só precisa ser exclusivo deste uso (é o único
 * `pg_advisory_lock` do projeto).
 */
export const CHAVE_LOCK_NSR = 771_465_003;
