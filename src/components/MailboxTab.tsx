'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import {
  MAILBOX_FEATURES, BUCKET_LABELS, BUCKET_ORDERS,
  type BucketKey,
} from '@/lib/mailboxCorrelations'
import { cleanFeatLabel } from '@/lib/dataUtils'

const C = {
  card: '#131b26', border: '#1e2b3c', grid: '#172030',
  text: '#8d9baa', bright: '#a8b5c0', sub: '#3e5268',
  cyan: '#4da898', pink: '#a86070', purple: '#6060a0',
  amber: '#a87a40', green: '#407a68',
}

const polarityFlips = [
  { label: 'Third-party login (30d)',      seat_1: -0.014, seat_6_20: +0.255, delta: +0.269 },
  { label: 'Rate limits bounce',           seat_1: -0.031, seat_6_20: +0.154, delta: +0.185 },
  { label: 'Mark as unread',               seat_1: -0.010, seat_6_20: +0.170, delta: +0.180 },
  { label: 'Total bounces',                seat_1: -0.039, seat_6_20: +0.135, delta: +0.174 },
  { label: 'Email templates creation',     seat_1: -0.008, seat_6_20: +0.147, delta: +0.156 },
  { label: 'Contact groups creation',      seat_1: -0.028, seat_6_20: +0.112, delta: +0.139 },
  { label: 'AI insert usage',              seat_1: -0.016, seat_6_20: +0.101, delta: +0.118 },
]

const BUCKETS: BucketKey[] = ['overall','seat_1','seat_2','seat_3_5','seat_6_20','seat_21_50']

function Block({ title, insight, children }: { title: string; insight?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.bright, marginBottom: insight ? 5 : 0 }}>{title}</div>
        {insight && <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.65, maxWidth: 700 }}>{insight}</div>}
      </div>
      {children}
    </div>
  )
}

function CorrBadge({ v }: { v: number }) {
  return (
    <span style={{
      display: 'inline-block', minWidth: 54, textAlign: 'center', fontWeight: 700, fontSize: 12,
      background: v >= 0 ? 'rgba(77,168,152,0.1)' : 'rgba(168,96,112,0.1)',
      color: v >= 0 ? C.cyan : C.pink, borderRadius: 4, padding: '1px 6px',
    }}>{v >= 0 ? '+' : ''}{v.toFixed(3)}</span>
  )
}

const SelectStyle: React.CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px',
  fontSize: 13, background: C.card, cursor: 'pointer', color: C.text,
}

function FeatureExplorer() {
  const [bucket,   setBucket]   = useState<BucketKey>('seat_1')
  const [showMode, setShowMode] = useState<'top' | 'bottom' | 'both'>('both')
  const [topN,     setTopN]     = useState(20)
  const [view,     setView]     = useState<'visual' | 'table'>('visual')

  const ranked = useMemo(() =>
    MAILBOX_FEATURES
      .map(f => ({ feat: f.feat, displayLabel: cleanFeatLabel(f.feat), corr: f[bucket].c, reach: f[bucket].r }))
      .filter(r => r.corr !== null)
      .sort((a, b) => (b.corr ?? 0) - (a.corr ?? 0)),
  [bucket])

  const displayed = useMemo(() => {
    const half = Math.floor(topN / 2)
    if (showMode === 'top')    return ranked.slice(0, topN)
    if (showMode === 'bottom') return [...ranked].reverse().slice(0, topN).reverse()
    return [...ranked.slice(0, half), ...ranked.slice(-half)].sort((a, b) => (b.corr ?? 0) - (a.corr ?? 0))
  }, [ranked, topN, showMode])

  const chartData = displayed.map(r => ({
    name: r.displayLabel,
    corr: Math.round((r.corr ?? 0) * 1000) / 1000,
    reach: Math.round((r.reach ?? 0) * 1000) / 1000,
  }))

  const orders = BUCKET_ORDERS[bucket]
  const bucketLabel = bucket === 'overall' ? 'All Neo Users' : BUCKET_LABELS[bucket]

  const ExplorerTip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px', fontSize: 13, maxWidth: 260 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, wordBreak: 'break-word', color: C.text }}>{d?.name}</div>
        <div style={{ color: d?.corr >= 0 ? C.cyan : C.pink }}>Correlation: <strong>{d?.corr >= 0 ? '+' : ''}{d?.corr}</strong></div>
        <div style={{ color: C.sub }}>Reach: <strong>{((d?.reach ?? 0) * 100).toFixed(1)}%</strong></div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
        {[
          {
            label: 'Seat Bucket',
            el: (
              <select style={SelectStyle} value={bucket} onChange={e => setBucket(e.target.value as BucketKey)}>
                {BUCKETS.map(b => (
                  <option key={b} value={b}>{bucketLabel === 'All Neo Users' && b === 'overall' ? 'All Neo Users' : BUCKET_LABELS[b]} — {BUCKET_ORDERS[b].toLocaleString()} orders</option>
                ))}
              </select>
            ),
          },
          {
            label: 'Show',
            el: (
              <select style={SelectStyle} value={showMode} onChange={e => setShowMode(e.target.value as any)}>
                <option value="both">Top &amp; Bottom</option>
                <option value="top">Top Positive</option>
                <option value="bottom">Top Negative</option>
              </select>
            ),
          },
          {
            label: 'Features',
            el: (
              <select style={SelectStyle} value={topN} onChange={e => setTopN(Number(e.target.value))}>
                {[10, 20, 30, 40].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            ),
          },
        ].map(({ label, el }) => (
          <div key={label}>
            <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
            {el}
          </div>
        ))}

        <div style={{ marginLeft: 'auto' }}>
          <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>View</label>
          <div style={{ display: 'flex', gap: 2 }}>
            {(['visual', 'table'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 5, cursor: 'pointer',
                border: `1px solid ${view === v ? C.cyan : C.border}`,
                background: view === v ? 'rgba(77,168,152,0.12)' : 'transparent',
                color: view === v ? C.cyan : C.sub,
              }}>
                {v === 'visual' ? '▮ Visual' : '≡ Table'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: C.bright, marginBottom: 2 }}>
        Feature Correlations with M3 Renewal — {bucketLabel}
      </div>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 16 }}>
        {orders.toLocaleString()} orders · Pearson correlation between first-30-day feature usage and M3 renewal.
        {bucket === 'seat_21_50' ? ' ⚠ Small sample — interpret with caution.' : ''}
      </div>

      {view === 'visual' && (
        <ResponsiveContainer width="100%" height={Math.max(380, chartData.length * 26)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
            <XAxis type="number" domain={[-0.5, 0.5]} tickFormatter={(v: number) => v.toFixed(2)} tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false} />
            <YAxis type="category" dataKey="name" width={220} tick={{ fontSize: 11, fill: C.sub }} axisLine={false} tickLine={false} />
            <Tooltip content={<ExplorerTip />} wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }} />
            <ReferenceLine x={0} stroke={C.border} strokeWidth={1} />
            <Bar dataKey="corr" radius={[0, 3, 3, 0]}>
              {chartData.map((entry, i) => <Cell key={i} fill={entry.corr >= 0 ? C.cyan : C.pink} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {view === 'table' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['#', 'Feature', 'Correlation', 'Reach'].map((h, i) => (
                  <th key={h} style={{
                    textAlign: i > 1 ? 'right' : i === 0 ? 'center' : 'left',
                    padding: '8px 12px', fontWeight: 600,
                    color: i === 2 ? C.cyan : C.sub,
                    fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((r, i) => (
                <tr key={r.feat} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                  <td style={{ padding: '6px 12px', color: C.sub, textAlign: 'center', width: 36 }}>{i + 1}</td>
                  <td style={{ padding: '6px 12px', color: C.text }}>{r.displayLabel}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right' }}><CorrBadge v={r.corr ?? 0} /></td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: C.sub }}>
                    {r.reach !== null ? `${(r.reach * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function MailboxTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

      <Block
        title="Explore Feature Correlations"
        insight="Select a seat bucket to explore how feature correlations with M3 renewal shift across solo users, small teams, and larger organisations. Switch between the visual bar chart and the detail table."
      >
        <FeatureExplorer />
      </Block>

      <div style={{ borderTop: `1px solid ${C.border}` }} />

      <Block
        title="Signal Polarity Flip — Solo vs Team"
        insight="These features are churn signals for 1-seat users and retention signals for 6–20 seat users. The same behaviour has opposite meaning depending on business context. A solo user encountering third-party login issues is likely a casual tester; a 6-person team using SSO/third-party clients is deeply onboarded."
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 640, fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ textAlign: 'left', padding: '6px 12px 6px 0', fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: 0.5 }}>Feature</th>
                <th style={{ textAlign: 'right', padding: '6px 12px', fontSize: 11, fontWeight: 700, color: C.pink, textTransform: 'uppercase', letterSpacing: 0.5 }}>1 seat</th>
                <th style={{ textAlign: 'right', padding: '6px 12px', fontSize: 11, fontWeight: 700, color: C.cyan, textTransform: 'uppercase', letterSpacing: 0.5 }}>6–20 seats</th>
                <th style={{ textAlign: 'right', padding: '6px 0 6px 12px', fontSize: 11, fontWeight: 700, color: C.amber, textTransform: 'uppercase', letterSpacing: 0.5 }}>Δ</th>
              </tr>
            </thead>
            <tbody>
              {polarityFlips.map((r, i) => (
                <tr key={r.label} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                  <td style={{ padding: '7px 12px 7px 0', color: C.text }}>{r.label}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: C.pink, fontWeight: 700 }}>{r.seat_1.toFixed(3)}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: C.cyan, fontWeight: 700 }}>{r.seat_6_20 >= 0 ? '+' : ''}{r.seat_6_20.toFixed(3)}</td>
                  <td style={{ padding: '7px 0 7px 12px', textAlign: 'right', color: C.amber, fontWeight: 700 }}>+{r.delta.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 14, padding: '12px 16px', border: `1px solid ${C.border}`, borderRadius: 8, background: C.card, maxWidth: 640 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, marginBottom: 4 }}>Key interpretation</div>
          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.7 }}>
            <span style={{ color: C.cyan, fontWeight: 600 }}>Third-party login is the biggest team signal</span> — SSO/Google login at 6+ seats (+0.255) suggests the account is embedded in a team workflow. Solo users who attempt third-party auth are often trying to escape, while teams actively integrating it are settling in. This single feature captures whether a Neo account is a true team tool or a personal experiment.
          </div>
        </div>
      </Block>

      <div style={{ borderTop: `1px solid ${C.border}` }} />

      <Block
        title="Neo Site & Team Seats — Retention Signal"
        insight="neo_site_published is a strong retention signal for 6–20 seat accounts (+0.291) — teams that publish their Neo site renew at a much higher rate."
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 560, fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Seat Bucket', 'Neo site: published', 'Reach'].map((h, i) => (
                  <th key={h} style={{
                    textAlign: i === 0 ? 'left' : 'right', padding: '8px 12px',
                    fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5,
                    color: i === 1 ? C.green : C.sub,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { bucket: '1 Seat', corr: 0.0066, reach: 5.4 },
                { bucket: '2 Seats', corr: 0.0100, reach: 5.4 },
                { bucket: '3–5 Seats', corr: 0.0033, reach: 4.2 },
                { bucket: '6–20 Seats', corr: 0.0890, reach: 6.1 },
              ].map((r, i) => (
                <tr key={r.bucket} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                  <td style={{ padding: '7px 12px', color: C.text, fontWeight: 600 }}>{r.bucket}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: r.corr > 0.05 ? C.green : C.sub, fontWeight: r.corr > 0.05 ? 700 : 400 }}>
                    +{r.corr.toFixed(4)}
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: C.sub }}>{r.reach.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 14, padding: '12px 16px', border: `1px solid ${C.border}`, borderRadius: 8, background: C.card, maxWidth: 640 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 4 }}>Action</div>
          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.65 }}>
            For 6–20 seat accounts, neo_site_published is a high-retention signal. Encourage team admins to build and publish their Neo site as a shared team resource. For solo/2-seat users, publishing predicts retention too but at a lower coefficient — focus team-building efforts on growing to 6+ seats where site engagement becomes critical.
          </div>
        </div>
      </Block>

    </div>
  )
}
