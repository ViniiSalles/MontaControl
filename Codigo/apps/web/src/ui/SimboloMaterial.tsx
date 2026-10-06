import type { NomeIcone } from '@montacontrol/design-tokens/icones';
import accountBalanceWallet from '@material-symbols/svg-400/outlined/account_balance_wallet.svg?raw';
import add from '@material-symbols/svg-400/outlined/add.svg?raw';
import addAPhoto from '@material-symbols/svg-400/outlined/add_a_photo.svg?raw';
import barcodeScanner from '@material-symbols/svg-400/outlined/barcode_scanner.svg?raw';
import calendarMonth from '@material-symbols/svg-400/outlined/calendar_month.svg?raw';
import cancel from '@material-symbols/svg-400/outlined/cancel.svg?raw';
import check from '@material-symbols/svg-400/outlined/check.svg?raw';
import checkCircle from '@material-symbols/svg-400/outlined/check_circle.svg?raw';
import close from '@material-symbols/svg-400/outlined/close.svg?raw';
import chevronLeft from '@material-symbols/svg-400/outlined/chevron_left.svg?raw';
import chevronRight from '@material-symbols/svg-400/outlined/chevron_right.svg?raw';
import conveyorBelt from '@material-symbols/svg-400/outlined/conveyor_belt.svg?raw';
import dashboard from '@material-symbols/svg-400/outlined/dashboard.svg?raw';
import database from '@material-symbols/svg-400/outlined/database.svg?raw';
import description from '@material-symbols/svg-400/outlined/description.svg?raw';
import editDocument from '@material-symbols/svg-400/outlined/edit_document.svg?raw';
import eventNote from '@material-symbols/svg-400/outlined/event_note.svg?raw';
import fingerprint from '@material-symbols/svg-400/outlined/fingerprint.svg?raw';
import groups from '@material-symbols/svg-400/outlined/groups.svg?raw';
import history from '@material-symbols/svg-400/outlined/history.svg?raw';
import homeWork from '@material-symbols/svg-400/outlined/home_work.svg?raw';
import info from '@material-symbols/svg-400/outlined/info.svg?raw';
import locationOn from '@material-symbols/svg-400/outlined/location_on.svg?raw';
import lock from '@material-symbols/svg-400/outlined/lock.svg?raw';
import logout from '@material-symbols/svg-400/outlined/logout.svg?raw';
import mail from '@material-symbols/svg-400/outlined/mail.svg?raw';
import menu from '@material-symbols/svg-400/outlined/menu.svg?raw';
import menuBook from '@material-symbols/svg-400/outlined/menu_book.svg?raw';
import pendingActions from '@material-symbols/svg-400/outlined/pending_actions.svg?raw';
import personOff from '@material-symbols/svg-400/outlined/person_off.svg?raw';
import pictureAsPdf from '@material-symbols/svg-400/outlined/picture_as_pdf.svg?raw';
import report from '@material-symbols/svg-400/outlined/report.svg?raw';
import schedule from '@material-symbols/svg-400/outlined/schedule.svg?raw';
import search from '@material-symbols/svg-400/outlined/search.svg?raw';
import sync from '@material-symbols/svg-400/outlined/sync.svg?raw';
import trendingUp from '@material-symbols/svg-400/outlined/trending_up.svg?raw';
import visibility from '@material-symbols/svg-400/outlined/visibility.svg?raw';
import visibilityOff from '@material-symbols/svg-400/outlined/visibility_off.svg?raw';
import warning from '@material-symbols/svg-400/outlined/warning.svg?raw';

// Os SVGs de @material-symbols/svg-400 não têm `fill` — herdam preto do
// default do SVG. Injeta `fill="currentColor"` na tag raiz (os `<path>`
// filhos não sobrescrevem `fill`, então herdam) para o ícone seguir a cor
// de texto do Tailwind (`text-*`), como no mockup Stitch. Também troca
// `width`/`height`, fixos em 48px no arquivo fonte, por `1em` — sem isso o
// ícone sempre renderiza a 48px e as classes `text-*` (font-size) não têm
// nenhum efeito no tamanho.
const comCorAtual = (bruto: string) =>
  bruto
    .replace('<svg ', '<svg fill="currentColor" ')
    .replace('width="48" height="48"', 'width="1em" height="1em"');

const svgPorIcone: Record<NomeIcone, string> = {
  account_balance_wallet: comCorAtual(accountBalanceWallet),
  add: comCorAtual(add),
  add_a_photo: comCorAtual(addAPhoto),
  barcode_scanner: comCorAtual(barcodeScanner),
  calendar_month: comCorAtual(calendarMonth),
  cancel: comCorAtual(cancel),
  check: comCorAtual(check),
  check_circle: comCorAtual(checkCircle),
  close: comCorAtual(close),
  chevron_left: comCorAtual(chevronLeft),
  chevron_right: comCorAtual(chevronRight),
  conveyor_belt: comCorAtual(conveyorBelt),
  dashboard: comCorAtual(dashboard),
  database: comCorAtual(database),
  description: comCorAtual(description),
  edit_document: comCorAtual(editDocument),
  event_note: comCorAtual(eventNote),
  fingerprint: comCorAtual(fingerprint),
  groups: comCorAtual(groups),
  history: comCorAtual(history),
  home_work: comCorAtual(homeWork),
  info: comCorAtual(info),
  location_on: comCorAtual(locationOn),
  lock: comCorAtual(lock),
  logout: comCorAtual(logout),
  mail: comCorAtual(mail),
  menu: comCorAtual(menu),
  menu_book: comCorAtual(menuBook),
  pending_actions: comCorAtual(pendingActions),
  person_off: comCorAtual(personOff),
  picture_as_pdf: comCorAtual(pictureAsPdf),
  report: comCorAtual(report),
  schedule: comCorAtual(schedule),
  search: comCorAtual(search),
  sync: comCorAtual(sync),
  trending_up: comCorAtual(trendingUp),
  visibility: comCorAtual(visibility),
  visibility_off: comCorAtual(visibilityOff),
  warning: comCorAtual(warning),
};

export interface PropsSimboloMaterial {
  nome: NomeIcone;
  className?: string;
}

/**
 * Ícone Material Symbols (Outlined) como SVG inline — evita auto-hospedar a
 * fonte variável inteira (~4MB) só para os nomes que `NomeIcone` cobre hoje.
 * Não é o `<Icone>` compartilhado do plano (Componentes #6, primitiva
 * mobile-only por ora, ver README de `@montacontrol/ui-contracts`): é
 * detalhe de implementação interno a este app.
 */
export function SimboloMaterial({ nome, className }: PropsSimboloMaterial) {
  return (
    <span
      className={className}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svgPorIcone[nome] }}
    />
  );
}
