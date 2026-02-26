import rawData from './data.json'

type CompactRow = {
  p: string
  f: string
  [key: string]: string | number | undefined
}

type DataStore = {
  meta: { segs: string[] }
  m3: CompactRow[]
  m1: CompactRow[]
}

const store = rawData as DataStore
const SEGS = store.meta.segs  // ['overall','co_site','custom_domain','pro','premium','ultra']
const segIdx = Object.fromEntries(SEGS.map((s, i) => [s, i]))

export type DataRow = {
  partner: string
  feat: string
  get: (type: 'c' | 'r', seg: string) => number | null
}

function expand(row: CompactRow): DataRow {
  return {
    partner: row.p,
    feat: row.f,
    get(type, seg) {
      const i = segIdx[seg]
      if (i === undefined) return null
      const v = row[`${type}${i}`]
      return typeof v === 'number' ? v : null
    }
  }
}

const _m3Expanded: DataRow[] = store.m3.map(expand)
const _m1Expanded: DataRow[] = store.m1.map(expand)

export const m3: DataRow[] = _m3Expanded
export const m1: DataRow[] = _m1Expanded

export const DOMAIN_TYPES = ['overall', 'co_site', 'custom_domain']

export const DOMAIN_LABELS: { [k: string]: string } = {
  overall:       'All Neo',
  co_site:       'Co.site',
  custom_domain: 'Custom Domain',
}

export const SEGMENTS = SEGS
export const SEGMENT_LABELS: { [k: string]: string } = {
  overall:       'Overall',
  co_site:       'Co.site',
  custom_domain: 'Custom Domain',
  pro:           'Pro',
  premium:       'Premium',
  ultra:         'Ultra',
}

export const DOMAIN_SEGMENTS = ['co_site', 'custom_domain']
export const PLAN_SEGMENTS   = ['pro', 'premium', 'ultra']

export const TOTAL_ORDERS = 17538

function orderRow(rows: DataRow[], partner: string) {
  return rows.find(r => r.partner === partner && r.feat === 'paid_order_count') ?? null
}

export function getRenewalRate(rows: DataRow[], partner: string, seg: string) {
  return orderRow(rows, partner)?.get('r', seg) ?? null
}

export function getOrderCount(rows: DataRow[], partner: string, seg: string) {
  return orderRow(rows, partner)?.get('c', seg) ?? null
}

export function getFeatureRows(rows: DataRow[], partner: string) {
  return rows.filter(r => r.partner === partner && r.feat !== 'paid_order_count')
}

export function getCorrelation(row: DataRow, seg: string) { return row.get('c', seg) }
export function getReach(row: DataRow, seg: string)       { return row.get('r', seg) }

export function formatRate(v: number | null) {
  return v === null ? 'N/A' : `${(v * 100).toFixed(1)}%`
}
export function formatCorr(v: number | null) {
  return v === null ? 'N/A' : v.toFixed(3)
}
export function formatReach(v: number | null) {
  return v === null ? 'N/A' : `${(v * 100).toFixed(1)}%`
}

export function cleanFeatLabel(feat: string) {
  const overrides: Record<string, string> = {
    'is_co_site': 'Co.site user',
    'dom_plan_type_pro': 'Plan: Pro',
    'dom_plan_type_premium': 'Plan: Premium',
    'dom_plan_type_ultra': 'Plan: Ultra',
    'neo_site_published': 'Neo site: published',
    'neo_site_unpublished': 'Neo site: unpublished',
    'neo_site_draft': 'Neo site: draft only',
    'neo_site_has_visitor': 'Neo site: has visitor',
    'neo_site_visitors_volume': 'Neo site: visitor volume',
    'titan_client_login_30d': 'Active in Titan app (30d)',
    'third_party_login_30d': 'Active in 3rd-party client (30d)',
    'accounts_created': 'Mailboxes created',
    'accounts_per_order': 'Mailboxes per order',
    'no_of_accounts': 'Mailbox count',
    'arf_tickets': 'ARF tickets',
  }
  if (overrides[feat]) return overrides[feat]

  let s = feat
    .replace(/_usage_usage$/, '').replace(/_usage$/, '')
    .replace(/_import$/, '').replace(/_send_download$/, '')
    .replace(/_creation$/, '').replace(/_enable$/, '')
    .replace(/^toggle_/, '').replace(/^volume_/, '')
    .replace(/_/g, ' ')
    .toLowerCase()

  s = s
    .replace(/\brecv\b/g, 'received')
    .replace(/\btickets\b/g, 'support tickets')
    .replace(/\bsize used\b/g, 'storage used')

  s = s.charAt(0).toUpperCase() + s.slice(1)

  s = s
    .replace(/\bpro\b/g, 'Pro')
    .replace(/\bpremium\b/g, 'Premium')
    .replace(/\bultra\b/g, 'Ultra')
    .replace(/\btitan\b/gi, 'Titan')
    .replace(/\bios\b/gi, 'iOS')
    .replace(/\bai\b/g, 'AI')

  return s
}
