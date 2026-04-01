// Funnel event display names and ordering
export const FUNNEL_EVENTS = [
  { key: 'homepage_and_get_started', label: 'Homepage / Get Started', short: 'Visitors' },
  { key: 'website_get_started_viewed', label: 'Get Started Viewed', short: 'Get Started' },
  { key: 'website_domain_availability_checked', label: 'Domain Availability Checked', short: 'Domain Check' },
  { key: 'website_domain_selected', label: 'Domain Selected', short: 'Domain Selected' },
  { key: 'website_customer_account_linked', label: 'Account Linked', short: 'Account Linked' },
  { key: 'website_mailbox_add_viewed', label: 'Mailbox Add Viewed', short: 'Mailbox View' },
  { key: 'website_mailbox_added', label: 'Mailbox Added', short: 'Mailbox Added' },
  { key: 'website_team_mailbox_add_continued', label: 'Team Mailbox Continued', short: 'Team Mailbox' },
  { key: 'website_generic_mailbox_add_continued', label: 'Generic Mailbox Continued', short: 'Generic Mailbox' },
  { key: 'website_neo_site_previewed', label: 'Site Previewed', short: 'Site Preview' },
  { key: 'website_plan_selected', label: 'Plan Selected', short: 'Plan Selected' },
  { key: 'website_order_summary_reviewed', label: 'Order Summary Reviewed', short: 'Order Summary' },
  { key: 'order_created', label: 'Order Created', short: 'Orders' },
  { key: 'paid_order_created', label: 'Paid Order Created', short: 'Paid Orders' },
] as const

// Key funnel steps for the simplified view
export const KEY_FUNNEL_STEPS = [
  'homepage_and_get_started',
  'website_get_started_viewed',
  'website_domain_availability_checked',
  'website_domain_selected',
  'website_plan_selected',
  'order_created',
  'paid_order_created',
]

export interface FunnelRow {
  event: string
  cohort: string // YYYY-MM-01
  tot_devices: number
  ord: number
}

export interface HealthRow {
  created_at: string
  neo_offering: string
  is_paid: number
  bundles: number
  orders: number
  orders_percent: number
  total_orders: number
}

// Group funnel rows by month
export function groupByMonth(rows: FunnelRow[]): Map<string, Map<string, number>> {
  const months = new Map<string, Map<string, number>>()
  for (const r of rows) {
    if (!months.has(r.cohort)) months.set(r.cohort, new Map())
    months.get(r.cohort)!.set(r.event, r.tot_devices)
  }
  return months
}

// Get sorted month keys (most recent first), excluding current partial month
export function getSortedMonths(months: Map<string, Map<string, number>>): string[] {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  return Array.from(months.keys())
    .filter(m => m !== currentMonth)
    .sort((a, b) => b.localeCompare(a))
}

// Month names for formatting
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Format month string for display (handles "2026-03-01" and "2026-03-01T00:00:00Z")
export function formatMonth(cohort: string): string {
  const parts = cohort.slice(0, 10).split('-')
  if (parts.length < 2) return cohort
  const monthIdx = parseInt(parts[1], 10) - 1
  return `${MONTH_NAMES[monthIdx]} ${parts[0]}`
}

// Compute MoM change percentage
export function momChange(current: number, previous: number): number | null {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}

// Get event label
export function eventLabel(key: string): string {
  return FUNNEL_EVENTS.find(e => e.key === key)?.label || key
}

export function eventShort(key: string): string {
  return FUNNEL_EVENTS.find(e => e.key === key)?.short || key
}

// Format large numbers with K/M suffix
export function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

// Format percentage
export function formatPct(n: number | null): string {
  if (n === null || isNaN(n)) return '-'
  return n.toFixed(1) + '%'
}

// Build query string from filters
export function buildQueryString(filters: Record<string, string | undefined>): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v)
  }
  return params.toString()
}

// Aggregate health rows into monthly paid/total summary
export function aggregateHealthMonthly(rows: HealthRow[]): {
  month: string
  totalOrders: number
  paidOrders: number
  paidPct: number
}[] {
  const byMonth = new Map<string, { paid: number; total: number }>()

  for (const r of rows) {
    if (r.neo_offering !== 'Overall') continue
    const month = r.created_at.slice(0, 7) + '-01'
    if (!byMonth.has(month)) byMonth.set(month, { paid: 0, total: 0 })
    const m = byMonth.get(month)!
    m.total += r.orders
    if (r.is_paid === 1) m.paid += r.orders
  }

  return Array.from(byMonth.entries())
    .map(([month, v]) => ({
      month,
      totalOrders: v.total,
      paidOrders: v.paid,
      paidPct: v.total ? (v.paid / v.total) * 100 : 0,
    }))
    .sort((a, b) => b.month.localeCompare(a.month))
}
