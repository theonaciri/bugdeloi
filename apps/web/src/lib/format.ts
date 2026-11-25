/**
 * Formats français, identiques côté serveur et navigateur (fuseau fixé à Europe/Paris pour que
 * l'hydratation ne diffère pas du rendu serveur).
 */
const TZ = 'Europe/Paris'
const intFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const pctFmt = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 })
const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: TZ })
const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: TZ,
})

export function formatInt(n: number): string {
  return intFmt.format(n)
}

/** Part en pourcentage ; `null` si le dénominateur est nul (on n'affiche pas « 0 % » d'un vide). */
export function formatShare(part: number, total: number): string | null {
  if (total <= 0) return null
  return pctFmt.format(part / total)
}

/** Date LEGI (AAAA-MM-JJ). 2999-01-01 = « sans date de fin » (convention DILA). */
export function formatLegiDate(d: string | null | undefined): string {
  if (!d) return '—'
  if (d.startsWith('2999')) return 'sans date de fin'
  const parsed = new Date(`${d}T12:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? d : dateFmt.format(parsed)
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? iso : dateTimeFmt.format(parsed)
}

/** Pluriel simple : `plural(2, 'article')` → « 2 articles ». */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatInt(n)} ${n >= -1 && n <= 1 ? singular : pluralForm}`
}

const ETAT_LABEL: Record<string, string> = {
  VIGUEUR: 'En vigueur',
  VIGUEUR_DIFF: 'En vigueur différée',
  ABROGE: 'Abrogé',
  ABROGE_DIFF: 'Abrogation différée',
  MODIFIE: 'Modifié (version antérieure)',
  MODIFIE_MORT_NE: 'Modification mort-née',
  PERIME: 'Périmé',
  ANNULE: 'Annulé',
  DISJOINT: 'Disjoint',
  TRANSFERE: 'Transféré',
}

export function etatLabel(etat: string | null | undefined): string {
  if (!etat) return 'État inconnu'
  return ETAT_LABEL[etat] ?? etat
}

const EVENT_LABEL: Record<string, string> = {
  'ingest.started': 'Ingestion LEGI démarrée',
  'ingest.finished': 'Ingestion LEGI terminée',
  'ingest.failed': 'Ingestion LEGI en échec',
  'replication.started': 'Rejeu de référence démarré',
  'replication.passed': 'Rejeu de référence réussi',
  'replication.failed': 'Rejeu de référence en échec',
  'replication.finished': 'Rejeu de référence terminé',
  'level.changed': 'Niveau de preuve modifié',
  'coverage.recorded': 'Couverture de référence enregistrée',
  'finding.qualified': 'Anomalie qualifiée par un humain',
  'finding.published': 'Anomalie publiée',
  'site.deployed': 'Site déployé',
}

export function eventLabel(type: string): string {
  return EVENT_LABEL[type] ?? type
}

const LINK_LABEL: Record<string, string> = {
  CITATION: 'Citation',
  MODIFIE: 'Modifié par',
  MODIFICATION: 'Modification',
  CREE: 'Créé par',
  CREATION: 'Création',
  ABROGE: 'Abrogé par',
  ABROGATION: 'Abrogation',
  CODIFIE: 'Codifié par',
  CODIFICATION: 'Codification',
  TRANSFERE: 'Transféré',
  DEPLACE: 'Déplacé',
  DISJOINT: 'Disjoint',
  RATIFIE: 'Ratifié',
  PERIME: 'Périmé',
  PILOTE_SUIVEUR: 'Article pilote / suiveur',
  SPEC_APPLI: 'Mesure d’application',
  TXT_ASSOCIE: 'Texte associé',
  TXT_SOURCE: 'Texte source',
  CONCORDANCE: 'Concordance',
  HISTO: 'Historique',
  CONCORDE: 'Concorde',
  ANNULE: 'Annulé',
}

export function linkTypeLabel(type: string): string {
  return LINK_LABEL[type] ?? type
}

/** « en vigueur depuis le 1 janvier 2026 » ou « du 1 janvier 2019 au 31 décembre 2025 ». */
export function formatPeriod(debut: string | null | undefined, fin: string | null | undefined): string {
  const open = !fin || fin.startsWith('2999')
  if (!debut) return open ? 'dates inconnues' : `jusqu’au ${formatLegiDate(fin)}`
  return open
    ? `depuis le ${formatLegiDate(debut)}, sans date de fin`
    : `du ${formatLegiDate(debut)} au ${formatLegiDate(fin)}`
}
