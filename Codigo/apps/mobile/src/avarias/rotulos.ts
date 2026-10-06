import { StatusAvaria } from '@montacontrol/shared';
import type { VarianteBadge } from '@montacontrol/ui-contracts/badge';

export const ROTULO_STATUS_AVARIA: Record<StatusAvaria, string> = {
  [StatusAvaria.REPORTADA]: 'Enviada',
  [StatusAvaria.EM_ANALISE]: 'Em análise',
  [StatusAvaria.REPOSICAO_SOLICITADA]: 'Reposição solicitada',
  [StatusAvaria.RESOLVIDA]: 'Resolvida',
};

export const VARIANTE_STATUS_AVARIA: Record<StatusAvaria, VarianteBadge> = {
  [StatusAvaria.REPORTADA]: 'neutro',
  [StatusAvaria.EM_ANALISE]: 'aviso',
  [StatusAvaria.REPOSICAO_SOLICITADA]: 'info',
  [StatusAvaria.RESOLVIDA]: 'sucesso',
};
