/**
 * Nomes de ícones Material Symbols (Outlined) realmente usados pelos
 * consumidores. Não pré-popular um catálogo — mais nomes entram aqui
 * conforme novas telas forem construídas. É um array em runtime (não só um
 * union) porque o gerador do mobile (`apps/mobile/scripts/gerar-icones.ts`)
 * itera sobre ele.
 */
export const NOMES_ICONE = [
  'account_balance_wallet',
  'add',
  'add_a_photo',
  'barcode_scanner',
  'calendar_month',
  'cancel',
  'check',
  'check_circle',
  'chevron_left',
  'chevron_right',
  'close',
  'conveyor_belt',
  'dashboard',
  'database',
  'description',
  'edit_document',
  'event_note',
  'fingerprint',
  'groups',
  'history',
  'info',
  'lock',
  'logout',
  'mail',
  'menu',
  'menu_book',
  'pending_actions',
  'person_off',
  'picture_as_pdf',
  'report',
  'schedule',
  'search',
  'sync',
  'trending_up',
  'visibility',
  'visibility_off',
  'warning',
] as const;

export type NomeIcone = (typeof NOMES_ICONE)[number];
