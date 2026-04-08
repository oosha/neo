'use client'
import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const VERSION = 'v0.4'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#0e1117', panel: '#131b26', card: '#0b0f19',
  border: '#1e2b3c', borderHi: '#2b3f58',
  text: '#c4d0da', textHi: '#dde8f0', sub: '#7a95ae',
  cyan: '#4da898', pink: '#a86070', amber: '#a87a40',
  green: '#407a68', purple: '#6060a0', red: '#a84040',
  blue: '#4070a8', violet: '#8060a0',
}

const CAT_LABEL: Record<string, string> = {
  advanced_one_time_setup: 'One-time setup',
  advanced_regular_use:    'Regular use (last 90d)',
  ultra_features:          'Ultra features (last 90d)',
  email_core_actions:      'Core email actions (last 90d)',
  rarely_used:             'Setup actions',
  toggled_features:        'Settings toggled',
  sending_limit:           'Hit send limits (last 90d)',
}
const CAT_ORDER = [
  'advanced_one_time_setup', 'advanced_regular_use', 'ultra_features',
  'email_core_actions', 'rarely_used', 'toggled_features', 'sending_limit',
]

const OFFERING_COLOR: Record<string, string> = {
  'co.site (free)': C.amber,
  'co.site (paid)': C.green,
  'custom domain':  C.cyan,
}
const STATUS_COLOR: Record<string, string> = {
  active: C.green, deleted: C.red, suspended: C.pink, expired: C.amber,
}
const PLAN_COLOR: Record<string, string> = {
  free: C.sub, trial: C.amber, lite: C.cyan, starter: C.amber,
  basic: C.cyan, standard: C.blue, pro: C.cyan, growth: C.green,
  scale: C.purple, premium: C.purple,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAge(createdAt: string | null | undefined): string {
  if (!createdAt) return '—'
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
  if (days < 1)  return 'today'
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo`
  const years = Math.floor(months / 12)
  const rem   = months % 12
  return rem === 0 ? `${years}yr` : `${years}yr ${rem}mo`
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return String(d).slice(0, 10)
}

function fmtBytes(mb: number | null | undefined): string {
  if (mb == null) return '—'
  if (mb < 1024) return `${mb.toFixed(0)} MB`
  return `${(mb / 1024).toFixed(1)} GB`
}

function cap(s: string | null | undefined): string {
  if (!s) return '—'
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}

function planTier(plan: string | null | undefined): number {
  const p = (plan ?? '').toLowerCase()
  if (p.includes('business') || p.includes('ultra')) return 4
  if (p.includes('growth')   || p.includes('premium')) return 3
  if (p.includes('standard') || p.includes('pro')) return 2
  if (p.includes('starter') || p.includes('lite') || p.includes('basic')) return 1
  return 0
}

function planColor(plan: string | null | undefined): string {
  return PLAN_COLOR[plan?.toLowerCase() ?? ''] ?? C.sub
}
function statusColor(status: string | null | undefined): string {
  return STATUS_COLOR[status?.toLowerCase() ?? ''] ?? C.sub
}
function offeringColor(offering: string | null | undefined): string {
  return OFFERING_COLOR[offering?.toLowerCase() ?? ''] ?? C.sub
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

function Badge({ label, color, small }: { label: string; color: string; small?: boolean }) {
  return (
    <span style={{
      background: color + '22', color, border: `1px solid ${color}44`,
      borderRadius: 4, padding: small ? '1px 6px' : '2px 8px',
      fontSize: small ? 11 : 12, fontWeight: 600, whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

function KV({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ color: C.sub, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ color: color ?? C.textHi, fontSize: 14 }}>{value || '—'}</div>
    </div>
  )
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <div id={id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '18px 22px', marginBottom: 14 }}>
      <div style={{ color: C.textHi, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  )
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: C.sub, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
      {children}
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

interface BundleData {
  bundle:      Row
  mailOrder:   Row | null
  siteOrder:   Row | null
  domainOrder: Row | null
  mailboxes:   Row[]
  note:        string
}

interface FeatureEntry { feature: string; action: string; category: string; device: string; total_usage: number; last_seen: string }
interface WeeklyEntry  { week: string; sent: number; read: number; received: number; calendar: number; search: number; organize: number; nonTitanSent: number; mobileSent: number }
interface AccountInfo  { forwardToCount: number | null; emailAliasCount: number | null }
interface ClientInfo   { hasTitan: boolean; hasNonTitan: boolean; majorDevice: string | null; clientForSending: string | null }

interface SearchResult {
  customer:             Row | null
  customerId:           number | null
  bundles:              BundleData[]
  allBundleStatus:      Array<{ status: unknown; mailStatus: unknown; siteStatus: unknown }>
  activityMap:          Record<number, { sent: number; read: number; received: number }>
  featureMap:           Record<number, FeatureEntry[]>
  weeklyMap:            Record<number, WeeklyEntry[]>
  accountInfoMap:       Record<number, AccountInfo>
  topNonTitanClientMap: Record<number, string>
  clientInfoMap:        Record<number, ClientInfo>
  error?:               string
}

interface PmfEntry {
  id: number; account_id: number | null; customer_id: number | null
  product: string; score: string | null; feedback_text: string | null
  submitted_at: string; tally_form_id: string | null
}

interface CannyAction { type: 'created' | 'voted' | 'commented'; email: string; date: string; comment?: string }
interface CannyPost   { id: string; title: string; details: string | null; score: number; board: string; status: string; url: string | null; actions: CannyAction[] }

// ── Customer summary header ───────────────────────────────────────────────────

function CustomerHeader({
  customer, customerId, allBundleStatus, bundleCount,
}: {
  customer:        Row | null
  customerId:      number | null
  allBundleStatus: SearchResult['allBundleStatus']
  bundleCount:     number
}) {
  const activeBundles   = allBundleStatus.filter(b => String(b.status   ?? '').toLowerCase() === 'active').length
  const activeMail      = allBundleStatus.filter(b => String(b.mailStatus ?? '').toLowerCase() === 'active').length
  const activeSite      = allBundleStatus.filter(b => String(b.siteStatus ?? '').toLowerCase() === 'active').length
  const totalMail       = allBundleStatus.filter(b => b.mailStatus != null).length
  const totalSite       = allBundleStatus.filter(b => b.siteStatus != null).length

  const name = customer?.customer_name ?? customer?.company_name ?? null

  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.borderHi}`, borderRadius: 8,
      padding: '14px 22px', marginBottom: 16,
      display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
    }}>
      <div>
        <div style={{ color: C.textHi, fontWeight: 700, fontSize: 16 }}>
          {name ?? 'Customer'}{' '}
          {customerId && <span style={{ color: C.sub, fontWeight: 400, fontSize: 13 }}>#{customerId}</span>}
        </div>
        {customer?.customer_email && (
          <div style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>{customer.customer_email}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
        <span style={{ color: C.sub }}>
          <span style={{ color: C.textHi, fontWeight: 600 }}>{activeBundles} of {bundleCount}</span> active bundles
        </span>
        {totalMail > 0 && (
          <span style={{ color: C.sub }}>
            <span style={{ color: C.textHi, fontWeight: 600 }}>{activeMail} of {totalMail}</span> active mail orders
          </span>
        )}
        {totalSite > 0 && (
          <span style={{ color: C.sub }}>
            <span style={{ color: C.textHi, fontWeight: 600 }}>{activeSite} of {totalSite}</span> active site orders
          </span>
        )}
        {customer?.country && (
          <span style={{ color: C.sub }}>📍 {customer.country}{customer.city ? `, ${customer.city}` : ''}</span>
        )}
      </div>
    </div>
  )
}

// ── Upgrade path helper ───────────────────────────────────────────────────────

function UpgradePath({ init, current, label }: { init: string | null; current: string | null; label?: string }) {
  if (!init && !current) return <span style={{ color: C.sub }}>—</span>
  if (!init || init === current) {
    return <span style={{ color: planColor(current) }}>{cap(current)}</span>
  }
  return (
    <span style={{ fontSize: 13 }}>
      {label && <span style={{ color: C.sub, fontSize: 11, marginRight: 4 }}>{label}</span>}
      <span style={{ color: planColor(init) }}>{cap(init)}</span>
      <span style={{ color: C.sub, margin: '0 5px' }}>→</span>
      <span style={{ color: planColor(current) }}>{cap(current)}</span>
    </span>
  )
}

// ── Product rows (mail / site / domain) ───────────────────────────────────────

function PlanChanges({ init, current }: { init: string | null; current: string | null }) {
  if (!init || !current || init.toLowerCase() === current.toLowerCase()) return null
  const tier = planTier(current) - planTier(init)
  const up   = tier > 0
  return (
    <span style={{ fontSize: 12, color: C.sub }}>
      · <span style={{ color: planColor(init) }}>{cap(init)}</span>
      <span style={{ color: up ? C.green : C.pink, margin: '0 4px' }}>{up ? '↑' : '↓'}</span>
      <span style={{ color: planColor(current) }}>{cap(current)}</span>
    </span>
  )
}

function MailProductRow({ order }: { order: Row }) {
  const [open, setOpen] = useState(false)
  const ageTxt = fmtAge(order.created_at)

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 8, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: open ? C.card : 'transparent' }}
      >
        <span style={{ fontSize: 16 }}>📧</span>
        <span style={{ color: C.textHi, fontWeight: 600, fontSize: 14 }}>Neo Mail</span>
        <Badge label={cap(order.plan_type ?? order.plan_name)} color={planColor(order.plan_type)} small />
        <Badge label={cap(order.status)} color={statusColor(order.status)} small />
        <span style={{ color: C.sub, fontSize: 12 }}>
          {fmtDate(order.created_at)} · {ageTxt} old
        </span>
        <PlanChanges init={order.init_plan_type} current={order.plan_type} />
        {order.is_mx_verified ? (
          <span style={{ color: C.green, fontSize: 12 }}>· ✓ MX {fmtDate(order.mx_verified_ts)}</span>
        ) : (
          <span style={{ color: C.pink, fontSize: 12 }}>· ✗ MX unverified</span>
        )}
        <span style={{ color: C.sub, fontSize: 14, marginLeft: 'auto' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding: '12px 14px', background: C.card, borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px 20px', marginBottom: 10 }}>
            <KV label="Order ID"     value={order.order_id} />
            <KV label="Created"      value={fmtDate(order.created_at)} />
            <KV label="Expiry"       value={fmtDate(order.expiry_date)} />
            <KV label="Billing"      value={cap(order.billing_cycle)} />
            <KV label="Plan"         value={<UpgradePath init={order.init_plan_type} current={order.plan_type} />} />
            <KV label="Plan name"    value={order.plan_name} />
            <KV label="First paid"   value={cap(order.first_payment_plan_type)} color={planColor(order.first_payment_plan_type)} />
            <KV label="Mailboxes"    value={`${order.active_mailbox_count ?? '—'} active / ${order.mailbox_count ?? '—'} total`} />
            <KV label="Catch-all"    value={order.catch_all_enabled ? '✓ Enabled' : order.catch_all_enabled === 0 ? '✗ Disabled' : '—'} color={order.catch_all_enabled ? C.cyan : undefined} />
            <KV label="Setup type"   value={cap(order.setup_type)} />
            <KV label="Domain type"  value={cap(order.domain_type)} />
            <KV label="MX verified"  value={order.is_mx_verified ? `✓ ${fmtDate(order.mx_verified_ts)}` : '✗'} color={order.is_mx_verified ? C.green : C.pink} />
            <KV label="Domain ownership" value={order.is_domain_ownership_verified ? `✓ ${fmtDate(order.dom_ownership_verified_ts)}` : '✗'} color={order.is_domain_ownership_verified ? C.green : C.pink} />
            <KV label="First sent"   value={fmtDate(order.first_sent_dt ?? order.neo_client_first_sent_dt)} />
            <KV label="Total sent"   value={order.total_mails_sent != null ? Number(order.total_mails_sent).toLocaleString() : '—'} />
            <KV label="Active 7d / 30d / 90d" value={`${order.has_sent_read_last_7d ? '✓' : '✗'} · ${order.has_sent_read_last_30d ? '✓' : '✗'} · ${order.has_sent_read_last_90d ? '✓' : '✗'}`} />
            {order.suspend_date && <KV label="Suspended" value={fmtDate(order.suspend_date)} color={C.pink} />}
            {order.suspension_reason && <KV label="Suspension reason" value={cap(order.suspension_reason)} color={C.pink} />}
          </div>
        </div>
      )}
    </div>
  )
}

function SiteProductRow({ order }: { order: Row }) {
  const [open, setOpen] = useState(false)
  const ageTxt  = fmtAge(order.created_at)

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 8, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: open ? C.card : 'transparent' }}
      >
        <span style={{ fontSize: 16 }}>🌐</span>
        <span style={{ color: C.textHi, fontWeight: 600, fontSize: 14 }}>Neo Site</span>
        <Badge label={cap(order.plan_type)} color={planColor(order.plan_type)} small />
        <Badge label={cap(order.status)} color={statusColor(order.status)} small />
        {order.neo_site_status && <Badge label={cap(order.neo_site_status)} color={C.violet} small />}
        <span style={{ color: C.sub, fontSize: 12 }}>
          {fmtDate(order.created_at)} · {ageTxt} old
        </span>
        <PlanChanges init={order.init_plan_type} current={order.plan_type} />
        {order.first_site_publish_dt && (
          <span style={{ color: '#4caf82', fontSize: 12 }}>· Published {fmtDate(order.first_site_publish_dt)}</span>
        )}
        <span style={{ color: C.sub, fontSize: 14, marginLeft: 'auto' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding: '12px 14px', background: C.card, borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px 20px' }}>
            <KV label="Order ID"     value={order.order_id} />
            <KV label="Created"      value={fmtDate(order.created_at)} />
            <KV label="Expiry"       value={fmtDate(order.expiry_date)} />
            <KV label="Billing"      value={cap(order.billing_cycle)} />
            <KV label="Plan"         value={<UpgradePath init={order.init_plan_type} current={order.plan_type} />} />
            <KV label="Site status"  value={cap(order.neo_site_status)} />
            <KV label="Site state"   value={cap(order.neo_site_state)} />
            <KV label="Product source" value={cap(order.product_source)} />
            <KV label="Theme"        value={cap(order.product_theme)} />
            <KV label="First published" value={fmtDate(order.first_site_publish_dt)} color={order.first_site_publish_dt ? '#4caf82' : undefined} />
            <KV label="A record"     value={order.a_verified ? `✓ ${fmtDate(order.a_verified_ts)}` : '✗'} color={order.a_verified ? C.green : C.pink} />
            <KV label="WWW CNAME"    value={order.www_cname_verified ? `✓ ${fmtDate(order.www_cname_verified_ts)}` : '✗'} color={order.www_cname_verified ? C.green : C.pink} />
            <KV label="First paid"   value={fmtDate(order.first_payment_date)} />
            <KV label="Renewals"     value={order.renewals ?? '—'} />
            <KV label="Trial expiry" value={fmtDate(order.trial_expiry_date)} />
            {order.suspend_date && <KV label="Suspended" value={fmtDate(order.suspend_date)} color={C.pink} />}
          </div>
        </div>
      )}
    </div>
  )
}

function DomainProductRow({ order, offering }: { order: Row | null; offering: string | null }) {
  const [open, setOpen] = useState(false)
  const ofColor = offeringColor(offering)
  const label   = offering ?? 'Neo Domain'

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 8, overflow: 'hidden' }}>
      <div
        onClick={() => order ? setOpen(o => !o) : undefined}
        style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: order ? 'pointer' : 'default', background: open ? C.card : 'transparent' }}
      >
        <span style={{ fontSize: 16 }}>🔗</span>
        <span style={{ color: C.textHi, fontWeight: 600, fontSize: 14 }}>Neo Domain</span>
        <Badge label={cap(label)} color={ofColor} small />
        {order && <Badge label={cap(order.status)} color={statusColor(order.status)} small />}
        {order?.plan_type && <Badge label={cap(order.plan_type)} color={planColor(order.plan_type)} small />}
        <span style={{ color: C.sub, fontSize: 12 }}>No upgrade path</span>
        {order && <span style={{ color: C.sub, fontSize: 14, marginLeft: 'auto' }}>{open ? '▲' : '▼'}</span>}
      </div>
      {open && order && (
        <div style={{ padding: '12px 14px', background: C.card, borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px 20px' }}>
            <KV label="Order ID"   value={order.order_id} />
            <KV label="Created"    value={fmtDate(order.created_at)} />
            <KV label="Expiry"     value={fmtDate(order.expiry_date)} />
            <KV label="Billing"    value={cap(order.billing_cycle)} />
            <KV label="Plan"       value={cap(order.plan_type)} color={planColor(order.plan_type)} />
            <KV label="First paid" value={fmtDate(order.first_payment_date)} />
            {order.trial_expiry_date && <KV label="Trial expiry" value={fmtDate(order.trial_expiry_date)} />}
            {order.suspend_date && <KV label="Suspended" value={fmtDate(order.suspend_date)} color={C.pink} />}
          </div>
        </div>
      )}
    </div>
  )
}

// ── PMF row ───────────────────────────────────────────────────────────────────

const PMF_SCORE_COLOR: Record<string, string> = {
  very_disappointed:     C.pink,
  somewhat_disappointed: C.amber,
  not_disappointed:      C.sub,
}
const PMF_SCORE_LABEL: Record<string, string> = {
  very_disappointed:     'Very disappointed',
  somewhat_disappointed: 'Somewhat disappointed',
  not_disappointed:      'Not disappointed',
}

function PmfRow({ entry }: { entry: PmfEntry }) {
  const [open, setOpen] = useState(false)
  const color    = PMF_SCORE_COLOR[entry.score ?? ''] ?? C.sub
  const scoreLabel = PMF_SCORE_LABEL[entry.score ?? ''] ?? cap(entry.score)
  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px', marginBottom: 6, cursor: 'pointer', background: open ? C.card : 'transparent' }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color, fontWeight: 700, fontSize: 13 }}>{scoreLabel || '—'}</span>
        <Badge label={entry.product === 'mail' ? '📧 Mail' : '🌐 Site'} color={entry.product === 'mail' ? C.cyan : C.violet} small />
        <span style={{ color: C.sub, fontSize: 12 }}>{fmtDate(entry.submitted_at)}</span>
        {entry.account_id && <span style={{ color: C.sub, fontSize: 11 }}>acct {entry.account_id}</span>}
        {!open && entry.feedback_text && (
          <span style={{ color: C.sub, fontSize: 12, flex: 1 }}>{entry.feedback_text.slice(0, 120)}…</span>
        )}
      </div>
      {open && entry.feedback_text && (
        <div style={{ marginTop: 8, color: C.text, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {entry.feedback_text}
        </div>
      )}
    </div>
  )
}

// ── Canny post row ────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = { created: '#6366f1', voted: '#10b981', commented: '#f59e0b' }

function CannyPostRow({ post }: { post: CannyPost }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 12, marginBottom: 12 }}>
      <div onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0, paddingTop: 2 }}>
          {post.actions.map((a, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: ACTION_COLORS[a.type] + '22', color: ACTION_COLORS[a.type], textTransform: 'uppercase', letterSpacing: '0.04em' }}>{a.type}</span>
          ))}
        </div>
        <span style={{ color: C.textHi, fontSize: 14, fontWeight: 600, flex: 1 }}>
          {post.title}
          {post.url && <a href={post.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: C.cyan, marginLeft: 6, fontSize: 11 }}>↗</a>}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <span style={{ color: C.sub, fontSize: 12 }}>👍 {post.score}</span>
          <span style={{ color: C.sub, fontSize: 12, background: C.border + '88', padding: '1px 6px', borderRadius: 3 }}>{post.board}</span>
          {post.status && post.status !== 'open' && <span style={{ color: C.sub, fontSize: 11 }}>{post.status}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
        {post.actions.map((a, i) => (
          <span key={i} style={{ fontSize: 12, color: C.sub }}>
            <span style={{ color: ACTION_COLORS[a.type] }}>{a.type}</span>{' by '}
            <span style={{ color: C.text }}>{a.email}</span>{' on '}
            <span style={{ color: C.text }}>{a.date}</span>
          </span>
        ))}
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          {post.details && <div style={{ fontSize: 13, color: C.text, marginBottom: 8, lineHeight: 1.5 }}>{post.details}</div>}
          {post.actions.filter(a => a.type === 'commented' && a.comment).map((a, i) => (
            <div key={i} style={{ fontSize: 13, color: C.text, background: C.border + '44', borderLeft: `3px solid ${ACTION_COLORS.commented}`, padding: '6px 10px', borderRadius: '0 4px 4px 0', marginBottom: 6 }}>
              <span style={{ color: C.sub, fontSize: 11, display: 'block', marginBottom: 4 }}>Comment by {a.email} on {a.date}</span>
              {a.comment}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Feature usage section (matches titanmail exactly) ────────────────────────

function FeatureUsageSection({ features, featureFloor }: { features: FeatureEntry[]; featureFloor?: string | null }) {
  if (features.length === 0) return <div style={{ color: C.sub, fontSize: 13 }}>No feature usage data.</div>

  const lifetimeLabel = featureFloor === 'last-90d' ? 'last 90d' : featureFloor ? `since ${featureFloor.slice(0,7)}` : 'lifetime'
  const catLabel: Record<string, string> = {
    ...CAT_LABEL,
    advanced_one_time_setup: `One-time setup (${lifetimeLabel})`,
    rarely_used:             `Setup actions (${lifetimeLabel})`,
    toggled_features:        `Settings toggled (${lifetimeLabel})`,
  }

  // ── Summary chips ─────────────────────────────────────────────────────────
  const usedKeys = new Set(features.map(f => f.feature))
  const calendarCount = features
    .filter(f => f.feature === 'calendar_event_creation' || f.feature === 'calendar_invite_received')
    .reduce((sum, f) => sum + Number(f.total_usage), 0)
  const dailyLimitHits  = features.filter(f => f.feature === 'mail_send_daily').reduce((s, f) => s + Number(f.total_usage), 0)
  const hourlyLimitHits = features.filter(f => f.feature === 'mail_send_hourly').reduce((s, f) => s + Number(f.total_usage), 0)

  const summaryItems = [
    { label: 'Read receipts',   used: usedKeys.has('read_receipts') },
    { label: 'Email templates', used: usedKeys.has('email_templates') },
    { label: 'Turbo search',    used: usedKeys.has('advanced_search') },
  ]

  // ── Group by category ──────────────────────────────────────────────────────
  const grouped: Record<string, FeatureEntry[]> = {}
  for (const f of features) {
    const cat = f.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(f)
  }
  const cats = [
    ...CAT_ORDER.filter(c => grouped[c]),
    ...Object.keys(grouped).filter(c => !CAT_ORDER.includes(c) && grouped[c]),
  ]

  const chipBase: React.CSSProperties = { fontSize: 12, padding: '3px 9px', borderRadius: 4, fontWeight: 600 }

  return (
    <div>
      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {summaryItems.map(({ label, used }) => (
          <span key={label} style={{
            ...chipBase,
            background: used ? C.cyan + '22' : C.border,
            color: used ? C.cyan : C.sub,
            border: `1px solid ${used ? C.cyan + '44' : 'transparent'}`,
          }}>
            {used ? '✓ ' : '✗ '}{label}
          </span>
        ))}
        <span style={{
          ...chipBase,
          background: calendarCount > 0 ? C.cyan + '22' : C.border,
          color: calendarCount > 0 ? C.cyan : C.sub,
          border: `1px solid ${calendarCount > 0 ? C.cyan + '44' : 'transparent'}`,
        }}>
          📅 Calendar{calendarCount > 0 ? ` · ${calendarCount.toLocaleString()}` : ' ✗'}
        </span>
        {dailyLimitHits > 0 && (
          <span style={{ ...chipBase, background: C.pink + '22', color: C.pink, border: `1px solid ${C.pink}44` }}>
            ⚠ Daily send limit hit · {dailyLimitHits.toLocaleString()}x
          </span>
        )}
        {hourlyLimitHits > 0 && (
          <span style={{ ...chipBase, background: C.pink + '22', color: C.pink, border: `1px solid ${C.pink}44` }}>
            ⚠ Hourly send limit hit · {hourlyLimitHits.toLocaleString()}x
          </span>
        )}
      </div>

      {/* Category sections */}
      {cats.map(cat => {
        const entries = grouped[cat]
        const label   = catLabel[cat] ?? cat.replace(/_/g, ' ')

        if (cat === 'toggled_features') {
          const byFeature: Record<string, FeatureEntry[]> = {}
          for (const f of entries) {
            if (!byFeature[f.feature]) byFeature[f.feature] = []
            byFeature[f.feature].push(f)
          }
          const toggledItems = Object.entries(byFeature).map(([feat, rows]) => {
            const latest = rows.reduce((a, b) => (a.last_seen ?? '') >= (b.last_seen ?? '') ? a : b)
            return { feat, action: latest.action, last_seen: latest.last_seen }
          })
          return (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div style={{ color: C.sub, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{label}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {toggledItems.map(({ feat, action, last_seen }) => {
                  const isOn = action === 'enable'
                  return (
                    <span key={feat} style={{
                      background: isOn ? C.cyan + '18' : C.border,
                      color: isOn ? C.cyan : C.sub,
                      border: `1px solid ${isOn ? C.cyan + '44' : 'transparent'}`,
                      borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600,
                    }}>
                      {isOn ? '● ' : '○ '}{feat.replace(/_/g, ' ')}
                      <span style={{ fontWeight: 400, marginLeft: 4, fontSize: 11, opacity: 0.7 }}>
                        {isOn ? 'on' : 'off'}{last_seen ? ` · ${fmtDate(last_seen)}` : ''}
                      </span>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        }

        return (
          <div key={cat} style={{ marginBottom: 12 }}>
            <div style={{ color: C.sub, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{label}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {entries.map((f, i) => {
                const dev = String(f.device ?? '').toLowerCase()
                const showDev = dev && dev !== 'unknown' && dev !== 'null' && dev !== ''
                return (
                  <span key={i} style={{ background: C.border, color: C.text, borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>
                    {f.feature.replace(/_/g, ' ')} · {f.action}
                    <span style={{ color: C.sub, marginLeft: 4 }}>{Number(f.total_usage).toLocaleString()}</span>
                    {showDev && <span style={{ color: C.sub, fontSize: 11, marginLeft: 3 }}>({dev})</span>}
                  </span>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Mailbox card ──────────────────────────────────────────────────────────────

function MailboxCard({
  mbx, activity, features, weekly, accountInfo, topNonTitanClient, clientInfo,
}: {
  mbx:               Row
  activity:          { sent: number; read: number; received: number } | undefined
  features:          FeatureEntry[]
  weekly:            WeeklyEntry[]
  accountInfo:       AccountInfo | null
  topNonTitanClient: string | null
  clientInfo:        ClientInfo | null
}) {
  const [open, setOpen] = useState(false)
  const displayName = mbx.name || [mbx.first_name, mbx.last_name].filter(Boolean).join(' ') || null
  const ageTxt = fmtAge(mbx.created_at)

  // Client/device info derived server-side from feature usage + sent_client_classification
  const clientLabel  = clientInfo?.clientForSending ?? null
  const allDevices   = new Set(features.map(f => String(f.device ?? '').toLowerCase()))
  const hasWeb       = allDevices.has('web')
  const hasIos       = allDevices.has('ios')
  const hasAndroid   = allDevices.has('android')
  const hasNonTitan  = clientInfo?.hasNonTitan ?? false
  const majorDevice  = clientInfo?.majorDevice ?? null

  const n = (v: unknown) => v != null ? Number(v) : null

  return (
    <div style={{ border: `1px solid ${mbx.is_admin ? C.cyan + '44' : C.border}`, borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: open ? '#0f1520' : 'transparent' }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: C.textHi, fontWeight: 700, fontSize: 15 }}>{mbx.email ?? `account ${mbx.account_id}`}</span>
            {displayName && <span style={{ color: C.sub, fontSize: 13 }}>· {displayName}</span>}
            {mbx.is_admin ? <span style={{ color: C.cyan, fontSize: 11, fontWeight: 700, background: C.cyan + '18', padding: '1px 6px', borderRadius: 3 }}>ADMIN</span> : null}
            <Badge label={cap(mbx.status)} color={statusColor(mbx.status)} small />
            {mbx.is_generic_lhs ? <Badge label="generic" color={C.sub} small /> : null}
          </div>
          <div style={{ color: C.sub, fontSize: 12, marginTop: 5 }}>
            {ageTxt} old
            {mbx.dom_plan_type && <><span style={{ margin: '0 6px' }}>·</span><span style={{ color: planColor(mbx.dom_plan_type), fontWeight: 600 }}>{cap(mbx.dom_plan_type)}</span></>}
            {clientLabel && <><span style={{ margin: '0 6px' }}>·</span><span>{clientLabel} client user</span></>}
            <span style={{ margin: '0 6px' }}>·</span>
            <span>Last 30d email activity: </span>
            {activity != null ? (
              <>
                <span>📩 <span style={{ color: C.text }}>{activity.received.toLocaleString()}</span> received</span>
                <span style={{ margin: '0 5px' }}>•</span>
                <span>📨 <span style={{ color: C.text }}>{activity.read.toLocaleString()}</span> read</span>
                <span style={{ margin: '0 5px' }}>•</span>
                <span>📧 <span style={{ color: C.text }}>{activity.sent.toLocaleString()}</span> sent</span>
              </>
            ) : (
              <span style={{ color: C.border }}>no data</span>
            )}
          </div>
        </div>
        <span style={{ color: C.sub, fontSize: 14 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '14px 18px', background: C.card, borderTop: `1px solid ${C.border}` }}>
          {/* Basic info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px 20px', marginBottom: 16 }}>
            <KV label="Account ID"         value={mbx.account_id} />
            <KV label="Created"            value={fmtDate(mbx.created_at)} />
            <KV label="Plan"               value={<UpgradePath init={mbx.dom_init_plan_type} current={mbx.dom_plan_type} />} />
            {clientLabel && <KV label="Client for sending" value={clientLabel} />}
            {majorDevice && <KV label="Titan device (major)" value={majorDevice === 'ios' ? 'iOS' : majorDevice === 'android' ? 'Android' : 'Web'} />}
            <KV label="Country"            value={mbx.country} />
            <KV label="Storage used"       value={fmtBytes(mbx.size_used)} />
            <KV label="Neo Offering"       value={cap(mbx.neo_offering)} color={offeringColor(mbx.neo_offering)} />
            <KV label="Domain status"      value={cap(mbx.dom_status)} color={statusColor(mbx.dom_status)} />
            <KV label="External forwards"  value={n(accountInfo?.forwardToCount)  ?? '—'} />
            <KV label="Email aliases"      value={n(accountInfo?.emailAliasCount) ?? '—'} />
            <KV label="Sent or read in"    value={
              <span style={{ display: 'flex', gap: 10 }}>
                {([['W1', mbx.has_sent_read_last_7d], ['W4', mbx.has_sent_read_last_30d], ['W12', mbx.has_sent_read_last_90d]] as [string, unknown][]).map(([lbl, val]) => (
                  <span key={lbl}>
                    <span style={{ color: C.sub }}>{lbl} </span>
                    <span style={{ color: val ? C.green : C.pink, fontWeight: 700 }}>{val ? '✓' : '✗'}</span>
                  </span>
                ))}
              </span>
            } />
            {mbx.referral_code             && <KV label="Referral code"       value={mbx.referral_code} />}
            {mbx.referred_invitee_count > 0 && <KV label="Referrals"          value={`${mbx.referred_invitee_count} sent`} />}
            {mbx.referral_reward_earned > 0 && <KV label="Reward earned"      value={`${mbx.referral_reward_earned}`} />}
            {mbx.suspend_date              && <KV label="Suspended"           value={fmtDate(mbx.suspend_date)} color={C.pink} />}
            {mbx.suspension_reason         && <KV label="Suspension reason"   value={cap(mbx.suspension_reason)} color={C.pink} />}
          </div>

          {/* Clients used */}
          <div style={{ marginBottom: 16 }}>
            <RowLabel>Clients used</RowLabel>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 6 }}>
              {[
                { label: 'Titan Webmail',      active: hasWeb },
                { label: 'Titan Mobile — iOS', active: hasIos },
                { label: 'Titan Mobile — Android', active: hasAndroid },
                { label: `Non-Titan${topNonTitanClient ? ` (${topNonTitanClient.slice(0, 30)})` : ''}`, active: hasNonTitan },
              ].map(({ label, active }) => (
                <span key={label} style={{ fontSize: 13, color: active ? C.textHi : C.sub }}>
                  <span style={{ color: active ? C.green : C.pink, fontWeight: 700, marginRight: 4 }}>{active ? '✓' : '✗'}</span>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Weekly activity table */}
          {weekly.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <RowLabel>Email activity — weekly, last 90d</RowLabel>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
                  <thead>
                    <tr style={{ background: C.panel }}>
                      {(['Week starting', '📧 Sent', '📨 Read', '📩 Received', '📅 Calendar', '🔍 Search', '🗂 Organize/Triage', 'Non-Titan sent', 'Titan Mobile sent'] as const).map((h, i) => (
                        <th key={h} style={{ color: C.sub, fontWeight: 600, textAlign: i === 0 ? 'left' : 'right', padding: '5px 10px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weekly.map((w, i) => {
                      const cell = (v: number) => v > 0 ? <span style={{ color: C.text }}>{v.toLocaleString()}</span> : <span style={{ color: C.sub }}>—</span>
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : '#131f30' }}>
                          <td style={{ color: C.sub, padding: '4px 10px', whiteSpace: 'nowrap' }}>{w.week}</td>
                          <td style={{ textAlign: 'right', padding: '4px 10px' }}>{cell(w.sent)}</td>
                          <td style={{ textAlign: 'right', padding: '4px 10px' }}>{cell(w.read)}</td>
                          <td style={{ textAlign: 'right', padding: '4px 10px' }}>{cell(w.received)}</td>
                          <td style={{ textAlign: 'right', padding: '4px 10px' }}>{cell(w.calendar)}</td>
                          <td style={{ textAlign: 'right', padding: '4px 10px' }}>{cell(w.search)}</td>
                          <td style={{ textAlign: 'right', padding: '4px 10px' }}>{cell(w.organize)}</td>
                          <td style={{ textAlign: 'right', padding: '4px 10px' }}>{cell(w.nonTitanSent)}</td>
                          <td style={{ textAlign: 'right', padding: '4px 10px' }}>{cell(w.mobileSent)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Feature usage */}
          {features.length > 0 && (
            <div>
              <RowLabel>Feature usage (last 90d / lifetime)</RowLabel>
              <div style={{ marginTop: 8 }}>
                <FeatureUsageSection features={features} featureFloor={null} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Notes section ─────────────────────────────────────────────────────────────

function NotesSection({ bundleId, initialNote }: { bundleId: number; initialNote: string }) {
  const [note, setNote]       = useState(initialNote)
  const [editing, setEditing] = useState(!initialNote)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  const save = async () => {
    setSaving(true)
    await fetch('/api/find-user/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bundle_id: bundleId, note }),
    })
    setSaving(false); setSaved(true); setEditing(false)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.borderHi}`, borderRadius: 10, padding: '16px 24px', marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ color: C.sub, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Notes</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {saved && <span style={{ color: C.green, fontSize: 13 }}>✓ Saved</span>}
          {!editing && note && (
            <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', padding: 0, color: C.sub, fontSize: 13, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>Edit</button>
          )}
        </div>
      </div>
      {!editing
        ? <div style={{ color: C.textHi, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{note}</div>
        : (
          <div>
            <textarea
              value={note}
              onChange={e => { setNote(e.target.value); setSaved(false) }}
              placeholder="Pre-interview notes, context, talking points…"
              autoFocus
              style={{ width: '100%', minHeight: 80, background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, color: C.textHi, fontSize: 14, fontFamily: 'inherit', padding: '10px 12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={save} disabled={saving} style={{ background: saving ? C.border : C.cyan, color: saving ? C.sub : '#0e1117', border: 'none', borderRadius: 6, padding: '7px 18px', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving…' : 'Save note'}
              </button>
              {(note !== initialNote || initialNote) && (
                <button onClick={() => { setNote(initialNote); setEditing(false) }} style={{ background: 'none', border: 'none', padding: 0, color: C.sub, fontSize: 13, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>Cancel</button>
              )}
            </div>
          </div>
        )
      }
    </div>
  )
}

// ── Bundle card ───────────────────────────────────────────────────────────────

function BundleCard({
  data, activityMap, featureMap, weeklyMap, accountInfoMap, topNonTitanClientMap, clientInfoMap, pmfData, pmfStatus, cannyPosts, cannyStatus,
}: {
  data:                 BundleData
  activityMap:          SearchResult['activityMap']
  featureMap:           SearchResult['featureMap']
  weeklyMap:            SearchResult['weeklyMap']
  accountInfoMap:       SearchResult['accountInfoMap']
  topNonTitanClientMap: SearchResult['topNonTitanClientMap']
  clientInfoMap:        SearchResult['clientInfoMap']
  pmfData:              PmfEntry[]
  pmfStatus:            'idle' | 'loading' | 'loaded' | 'error'
  cannyPosts:           CannyPost[]
  cannyStatus:          'idle' | 'loading' | 'loaded' | 'error'
}) {
  const { bundle, mailOrder, siteOrder, domainOrder, mailboxes, note } = data
  const [personaOpen, setPersonaOpen] = useState(false)
  const [utmOpen, setUtmOpen]         = useState(false)

  const hasPersona = bundle.role_in_business || bundle.signup_reason || bundle.employee_count || bundle.business_industry
  const hasUtm     = bundle.utm_source || bundle.utm_medium || bundle.utm_campaign || bundle.utm_term

  const bundleStatusColor = statusColor(bundle.status)
  const ofColor           = offeringColor(bundle.neo_offering)

  // PMF: split mail (per account_id) vs site (all)
  const accountIds  = new Set(mailboxes.map(m => Number(m.account_id)))
  const mailPmf     = pmfData.filter(e => e.product === 'mail' && (e.account_id == null || accountIds.has(Number(e.account_id))))
  const sitePmf     = pmfData.filter(e => e.product === 'site')
  const pmfByAcct   = mailPmf.reduce<Record<number, PmfEntry[]>>((acc, e) => {
    const id = Number(e.account_id)
    if (!acc[id]) acc[id] = []
    acc[id].push(e)
    return acc
  }, {})

  return (
    <div id={`bundle-${bundle.bundle_id}`} style={{ marginBottom: 20 }}>
    <div style={{ background: C.panel, border: `1px solid ${C.borderHi}`, borderRadius: 10, padding: '20px 24px' }}>

      {/* ── Bundle header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <a href={`https://${bundle.domain_name}`} target="_blank" rel="noopener noreferrer"
               style={{ color: C.textHi, fontWeight: 800, fontSize: 20, textDecoration: 'none', borderBottom: `1px solid ${C.borderHi}` }}>
              {bundle.domain_name}
            </a>
            <Badge label={cap(bundle.status)} color={bundleStatusColor} />
            {bundle.neo_offering && <Badge label={cap(bundle.neo_offering)} color={ofColor} />}
            {bundle.product_source && (
              <Badge label={`from ${bundle.product_source}`} color={bundle.product_source === 'site' ? C.violet : C.cyan} />
            )}
            {bundle.country && <span style={{ color: C.sub, fontSize: 13 }}>📍 {bundle.country}</span>}
          </div>
          <div style={{ color: C.sub, fontSize: 12, marginTop: 5, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span>Bundle <span style={{ color: C.text }}>{bundle.bundle_id}</span></span>
            {bundle.customer_id && <span>Customer <span style={{ color: C.text }}>{bundle.customer_id}</span></span>}
            <span>Created <span style={{ color: C.text }}>{fmtDate(bundle.created_at)}</span></span>
            {bundle.neo_site_status && <span>Site: <span style={{ color: C.violet }}>{cap(bundle.neo_site_status)}</span></span>}
            {bundle.first_site_publish_dt && <span>Published <span style={{ color: '#4caf82' }}>{fmtDate(bundle.first_site_publish_dt)}</span></span>}
            {bundle.billing_cycle && <span>Billing: <span style={{ color: C.text }}>{cap(bundle.billing_cycle)}</span></span>}
            {bundle.is_paid === 1 && <span style={{ color: C.green }}>✓ Paid</span>}
            {bundle.suspend_date && <span style={{ color: C.pink }}>Suspended {fmtDate(bundle.suspend_date)}</span>}
          </div>
        </div>
      </div>

      {/* ── Products ── */}
      <div style={{ marginBottom: 14 }}>
        <RowLabel>Products</RowLabel>
        {mailOrder   && <MailProductRow   order={mailOrder} />}
        {siteOrder   && <SiteProductRow   order={siteOrder} />}
        {(domainOrder || bundle.neo_domain_order_id) && (
          <DomainProductRow order={domainOrder} offering={bundle.neo_offering} />
        )}
        {!mailOrder && !siteOrder && !domainOrder && (
          <span style={{ color: C.sub, fontSize: 13 }}>No product orders found.</span>
        )}
      </div>

      {/* ── UTM / Visit info (collapsible) ── */}
      {hasUtm && (
        <div style={{ marginBottom: 14 }}>
          <div
            onClick={() => setUtmOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: utmOpen ? 8 : 0 }}
          >
            <RowLabel>Visit / UTM info</RowLabel>
            <span style={{ color: C.sub, fontSize: 12, marginBottom: 5 }}>{utmOpen ? '▲' : '▼'}</span>
          </div>
          {utmOpen && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingLeft: 4 }}>
              {[
                ['Source',    bundle.utm_source],
                ['Medium',    bundle.utm_medium],
                ['Campaign',  bundle.utm_campaign],
                ['Content',   bundle.utm_content],
                ['Term',      bundle.utm_term],
                ['Device',    bundle.signup_device],
              ].filter(([, v]) => v).map(([k, v]) => (
                <span key={k as string} style={{ fontSize: 12, background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, padding: '3px 8px', color: C.text }}>
                  <span style={{ color: C.sub }}>{k}: </span>{v}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Persona survey (collapsible) ── */}
      {hasPersona && (
        <div style={{ marginBottom: 14 }}>
          <div
            onClick={() => setPersonaOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: personaOpen ? 8 : 0 }}
          >
            <RowLabel>Persona survey</RowLabel>
            <span style={{ color: C.sub, fontSize: 12, marginBottom: 5 }}>{personaOpen ? '▲' : '▼'}</span>
          </div>
          {personaOpen && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px 20px', paddingLeft: 4 }}>
              <KV label="Role"          value={cap(bundle.role_in_business)} />
              <KV label="Reason"        value={cap(bundle.signup_reason)} />
              <KV label="Employees"     value={bundle.employee_count != null ? String(bundle.employee_count) : null} />
              <KV label="Industry"      value={cap(bundle.business_industry)} />
              <KV label="Company"       value={bundle.company_name} />
            </div>
          )}
        </div>
      )}

    </div>{/* end panel */}

    {/* ── Notes — independent section ── */}
    <NotesSection bundleId={Number(bundle.bundle_id)} initialNote={note} />

    {/* ── Mailboxes — separate section ── */}
    {mailboxes.length > 0 && (
      <div style={{ marginTop: 12 }}>
        <div style={{ color: C.sub, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, paddingLeft: 4 }}>
          Mailboxes ({mailboxes.length})
        </div>
        {mailboxes.map(mbx => (
          <MailboxCard
            key={mbx.account_id}
            mbx={mbx}
            activity={activityMap[Number(mbx.account_id)]}
            features={featureMap[Number(mbx.account_id)] ?? []}
            weekly={weeklyMap[Number(mbx.account_id)] ?? []}
            accountInfo={accountInfoMap?.[Number(mbx.account_id)] ?? null}
            topNonTitanClient={topNonTitanClientMap?.[Number(mbx.account_id)] ?? null}
            clientInfo={clientInfoMap?.[Number(mbx.account_id)] ?? null}
          />
        ))}
      </div>
    )}

    {/* ── Canny — independent section after mailboxes ── */}
    {cannyStatus !== 'idle' && (
      <div style={{ marginTop: 12, background: C.panel, border: `1px solid ${C.borderHi}`, borderRadius: 10, padding: '16px 24px' }}>
        <div style={{ color: C.sub, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
          Canny feature requests
        </div>
        {cannyStatus === 'loading' && <span style={{ color: C.sub, fontSize: 13 }}>Loading…</span>}
        {cannyStatus === 'error'   && <span style={{ color: C.pink, fontSize: 13 }}>Failed to load Canny data.</span>}
        {cannyStatus === 'loaded' && cannyPosts.length === 0 && <span style={{ color: C.sub, fontSize: 13 }}>No Canny activity found.</span>}
        {cannyStatus === 'loaded' && cannyPosts.map(p => <CannyPostRow key={p.id} post={p} />)}
      </div>
    )}

    {/* ── PMF — independent section after Canny ── */}
    {pmfStatus !== 'idle' && (
      <div style={{ marginTop: 12, background: C.panel, border: `1px solid ${C.borderHi}`, borderRadius: 10, padding: '16px 24px' }}>
        <div style={{ color: C.sub, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
          PMF feedback
          {pmfStatus === 'loaded' && (mailPmf.length + sitePmf.length) > 0 && (
            <span style={{ color: C.sub, fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 6 }}>
              ({mailPmf.length + sitePmf.length})
            </span>
          )}
        </div>
        {pmfStatus === 'loading' && <span style={{ color: C.sub, fontSize: 13 }}>Loading…</span>}
        {pmfStatus === 'error'   && <span style={{ color: C.pink, fontSize: 13 }}>Failed to load PMF data.</span>}
        {pmfStatus === 'loaded' && mailPmf.length === 0 && sitePmf.length === 0 && (
          <span style={{ color: C.sub, fontSize: 13 }}>No PMF responses on record.</span>
        )}
        {pmfStatus === 'loaded' && mailPmf.length > 0 && (
          <div style={{ marginBottom: sitePmf.length > 0 ? 16 : 0 }}>
            <div style={{ color: C.sub, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Mail ({mailPmf.length})
            </div>
            {mailPmf.map(e => <PmfRow key={e.id} entry={e} />)}
          </div>
        )}
        {pmfStatus === 'loaded' && sitePmf.length > 0 && (
          <div>
            <div style={{ color: C.sub, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Site ({sitePmf.length})
            </div>
            {sitePmf.map(e => <PmfRow key={e.id} entry={e} />)}
          </div>
        )}
      </div>
    )}
    </div>
  )
}

// ── Search types ──────────────────────────────────────────────────────────────

type SearchType = 'customer' | 'mailbox' | 'bundle' | 'order' | 'domain'

const SEARCH_TYPES: { value: SearchType; label: string; placeholder: string }[] = [
  { value: 'customer', label: 'Customer', placeholder: 'Enter customer email or ID' },
  { value: 'mailbox',  label: 'Mailbox',  placeholder: 'Enter mailbox email or account ID' },
  { value: 'bundle',   label: 'Bundle',   placeholder: 'Enter bundle ID' },
  { value: 'order',    label: 'Order',    placeholder: 'Enter order ID' },
  { value: 'domain',   label: 'Domain',   placeholder: 'Enter domain name' },
]

// Resolve UI search type + value → API type that the route understands
function resolveApiType(type: SearchType, value: string): string {
  const v = value.trim()
  if (type === 'customer') return v.includes('@') ? 'customer_email' : 'customer_id'
  if (type === 'mailbox')  return v.includes('@') ? 'email'          : 'account_id'
  if (type === 'bundle')   return 'bundle_id'
  if (type === 'order')    return 'order_id'
  return 'domain'
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FindUserPage() {
  return <Suspense><FindUser /></Suspense>
}

function FindUser() {
  const params = useSearchParams()

  const [searchType,  setSearchType]  = useState<SearchType>('domain')
  const [searchValue, setSearchValue] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [result,      setResult]      = useState<SearchResult | null>(null)
  const [error,       setError]       = useState<string | null>(null)

  // PMF — single async load for all resolved bundles
  const [pmfStatus, setPmfStatus] = useState<'idle'|'loading'|'loaded'|'error'>('idle')
  const [pmfData,   setPmfData]   = useState<PmfEntry[]>([])

  // Canny — single async load by mailbox emails
  const [cannyStatus, setCannyStatus] = useState<'idle'|'loading'|'loaded'|'error'>('idle')
  const [cannyPosts,  setCannyPosts]  = useState<CannyPost[]>([])

  const fetchPmf = useCallback(async (accountIds: number[], customerId: number | null, emails: string[]) => {
    if (!accountIds.length && !customerId && !emails.length) return
    setPmfStatus('loading'); setPmfData([])
    try {
      const qs = new URLSearchParams()
      if (accountIds.length) qs.set('account_ids', accountIds.join(','))
      if (customerId)        qs.set('customer_id', String(customerId))
      if (emails.length)     qs.set('emails', emails.join(','))
      const res  = await fetch(`/api/find-user/pmf?${qs}`)
      const data = await res.json()
      if (!res.ok || data.error) { setPmfStatus('error'); return }
      setPmfData(data.pmf ?? [])
      setPmfStatus('loaded')
    } catch { setPmfStatus('error') }
  }, [])

  const fetchCanny = useCallback(async (emails: string[]) => {
    if (!emails.length) return
    setCannyStatus('loading'); setCannyPosts([])
    try {
      const res  = await fetch(`/api/find-user/canny?emails=${encodeURIComponent(emails.join(','))}`)
      const data = await res.json()
      if (!res.ok || data.error) { setCannyStatus('error'); return }
      setCannyPosts(data.posts ?? [])
      setCannyStatus('loaded')
    } catch { setCannyStatus('error') }
  }, [])

  const doSearch = useCallback(async (type: SearchType, value: string) => {
    if (!value.trim()) return
    setLoading(true); setError(null); setResult(null)
    setPmfStatus('idle'); setPmfData([])
    setCannyStatus('idle'); setCannyPosts([])
    try {
      const apiType = resolveApiType(type, value)
      const res  = await fetch('/api/find-user/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: apiType, value: value.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? `Error ${res.status}`)
      } else {
        setResult(data)
        // Fire async loads
        const allMailboxes  = (data.bundles ?? []).flatMap((b: BundleData) => b.mailboxes)
        const allAccountIds = allMailboxes.map((m: Row) => Number(m.account_id)).filter(Boolean)
        const allEmails     = allMailboxes.map((m: Row) => m.email).filter(Boolean) as string[]
        fetchPmf(allAccountIds, data.customerId, allEmails)
        fetchCanny(allEmails)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [fetchPmf, fetchCanny])

  const search = useCallback(() => doSearch(searchType, searchValue), [doSearch, searchType, searchValue])

  // Auto-search from URL params
  useEffect(() => {
    const bundleId   = params.get('bundle_id')
    const customerId = params.get('customer_id')
    const accountId  = params.get('account_id')
    const domain     = params.get('domain')
    const email      = params.get('email')
    const orderId    = params.get('order_id')
    if (bundleId)        { setSearchType('bundle');   setSearchValue(bundleId);   doSearch('bundle',   bundleId)   }
    else if (orderId)    { setSearchType('order');    setSearchValue(orderId);    doSearch('order',    orderId)    }
    else if (customerId) { setSearchType('customer'); setSearchValue(customerId); doSearch('customer', customerId) }
    else if (accountId)  { setSearchType('mailbox');  setSearchValue(accountId);  doSearch('mailbox',  accountId)  }
    else if (email)      { setSearchType('mailbox');  setSearchValue(email);      doSearch('mailbox',  email)      }
    else if (domain)     { setSearchType('domain');   setSearchValue(domain);     doSearch('domain',   domain)     }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selStyle: React.CSSProperties = {
    background: C.panel, color: C.textHi, border: `1px solid ${C.border}`,
    borderRadius: 6, padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  }

  const placeholder = SEARCH_TYPES.find(t => t.value === searchType)?.placeholder ?? ''

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Nunito', system-ui, sans-serif", fontSize: 15, color: C.text }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>

        {/* Header */}
        <div style={{ padding: '28px 0 20px', borderBottom: `1px solid ${C.border}`, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <a href="/" style={{ color: C.sub, fontSize: 12, textDecoration: 'none', letterSpacing: '0.05em', textTransform: 'uppercase' }}>← Neo Analytics</a>
              <div style={{ color: C.textHi, fontWeight: 800, fontSize: 22, marginTop: 8 }}>Neo customer lookup</div>
              <div style={{ color: C.sub, fontSize: 13, marginTop: 3 }}>Look up any Neo customer, bundle, order, or mailbox for pre-interview research</div>
            </div>
            <span style={{ color: C.sub, fontSize: 12, fontWeight: 600, marginTop: 4, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: '3px 8px' }}>{VERSION}</span>
          </div>
        </div>

        {/* Search bar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
          <select value={searchType} onChange={e => setSearchType(e.target.value as SearchType)} style={{ ...selStyle, minWidth: 140 }}>
            {SEARCH_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder={placeholder}
            style={{ ...selStyle, flex: 1, minWidth: 260 }}
          />
          <button
            onClick={search}
            disabled={loading || !searchValue.trim()}
            style={{ background: loading ? C.border : C.cyan, color: loading ? C.sub : '#0e1117', border: 'none', borderRadius: 6, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ color: C.sub, textAlign: 'center', padding: '60px 0', fontSize: 15 }}>
            <div style={{ marginBottom: 8 }}>Querying Athena…</div>
            <div style={{ color: C.border, fontSize: 13 }}>This may take 30–60 seconds</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: C.red + '18', border: `1px solid ${C.red}44`, borderRadius: 8, padding: '14px 18px', color: C.pink, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            {/* Customer header — always shown */}
            <CustomerHeader
              customer={result.customer}
              customerId={result.customerId}
              allBundleStatus={result.allBundleStatus}
              bundleCount={result.bundles.length}
            />

            {/* Bundle cards */}
            {result.bundles.length === 0 && (
              <div style={{ color: C.sub, fontSize: 14 }}>No bundle data found.</div>
            )}
            {result.bundles.map((bundleData) => (
              <BundleCard
                key={bundleData.bundle.bundle_id}
                data={bundleData}
                activityMap={result.activityMap}
                featureMap={result.featureMap ?? {}}
                weeklyMap={result.weeklyMap ?? {}}
                accountInfoMap={result.accountInfoMap ?? {}}
                topNonTitanClientMap={result.topNonTitanClientMap ?? {}}
                clientInfoMap={result.clientInfoMap ?? {}}
                pmfData={pmfStatus === 'loaded' ? pmfData : []}
                pmfStatus={pmfStatus}
                cannyPosts={cannyPosts}
                cannyStatus={cannyStatus}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
