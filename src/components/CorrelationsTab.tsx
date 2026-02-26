'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from 'recharts'
import {
  m3, getFeatureRows, getCorrelation, getReach,
  DOMAIN_TYPES, DOMAIN_LABELS, SEGMENTS, SEGMENT_LABELS,
  cleanFeatLabel, formatCorr, formatReach
} from '@/lib/dataUtils'

const C = {
  card: '#131b26', border: '#1e2b3c', grid: '#172030',
  text: '#8d9baa', bright: '#a8b5c0', sub: '#3e5268', dim: '#1e2b3c',
  cyan: '#4da898', pink: '#a86070', purple: '#6060a0', green: '#407a68', amber: '#a87a40',
}
const POS = C.cyan
const NEG = C.pink

// ─── Small helpers ────────────────────────────────────────────────────────────

function CorrBadge({ v }: { v: number }) {
  return (
    <span style={{
      display: 'inline-block', minWidth: 52, textAlign: 'center', fontWeight: 700, fontSize: 12,
      background: v >= 0 ? 'rgba(86,182,168,0.1)' : 'rgba(201,112,128,0.1)',
      color: v >= 0 ? C.cyan : C.pink, borderRadius: 4, padding: '1px 6px',
    }}>{v >= 0 ? '+' : ''}{v.toFixed(3)}</span>
  )
}

function ReachBadge({ v }: { v: number }) {
  return (
    <span style={{ display: 'inline-block', minWidth: 44, textAlign: 'center', background: 'rgba(255,255,255,0.04)', color: C.sub, fontSize: 11, borderRadius: 4, padding: '1px 6px' }}>
      {(v * 100).toFixed(0)}%
    </span>
  )
}

function SegLabel({ seg }: { seg: string }) {
  const col: Record<string, string> = {
    overall: C.bright,
    co_site: C.green,
    custom_domain: C.amber,
    pro: C.green,
    premium: C.cyan,
    ultra: C.purple
  }
  return (
    <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.05)', color: col[seg] ?? C.sub, borderRadius: 3, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {SEGMENT_LABELS[seg]}
    </span>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const SelectStyle: React.CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px',
  fontSize: 13, background: C.card, cursor: 'pointer', color: C.text,
}

export default function CorrelationsTab() {
  const [domainType, setDomainType] = useState('overall')
  const [segment,    setSegment]    = useState('overall')
  const [topN,       setTopN]       = useState(20)
  const [showMode,   setShowMode]   = useState<'top' | 'bottom' | 'both'>('both')

  const featureRows = useMemo(() => getFeatureRows(m3, domainType), [domainType])

  const ranked = useMemo(() =>
    featureRows
      .map(row => ({ feat: row.feat, label: cleanFeatLabel(row.feat), corr: getCorrelation(row, segment), reach: getReach(row, segment) }))
      .filter(r => r.corr !== null)
      .sort((a, b) => (b.corr ?? 0) - (a.corr ?? 0)),
  [featureRows, segment])

  const displayed = useMemo(() => {
    const half = Math.floor(topN / 2)
    if (showMode === 'top')    return ranked.slice(0, topN)
    if (showMode === 'bottom') return [...ranked].reverse().slice(0, topN).reverse()
    return [...ranked.slice(0, half), ...ranked.slice(-half)].sort((a, b) => (b.corr ?? 0) - (a.corr ?? 0))
  }, [ranked, topN, showMode])

  const chartData = displayed.map(r => ({
    name: r.label,
    corr: Math.round((r.corr ?? 0) * 1000) / 1000,
    reach: Math.round((r.reach ?? 0) * 1000) / 1000,
  }))

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px', fontSize: 13, maxWidth: 260 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, wordBreak: 'break-word', color: C.text }}>{d?.name}</div>
        <div style={{ color: d?.corr >= 0 ? POS : NEG }}>Correlation: <strong>{d?.corr}</strong></div>
        <div style={{ color: C.sub }}>Reach: <strong>{((d?.reach ?? 0) * 100).toFixed(1)}%</strong></div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Filters */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.bright, marginBottom: 4 }}>Explore Feature Correlations</div>
        <div style={{ fontSize: 12, color: C.text, fontStyle: 'italic', marginBottom: 12 }}>Features used in the first 30 days — higher correlation means stronger link to M3 renewal outcome.</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {[
            { label: 'Domain Type',      value: domainType, onChange: setDomainType, opts: DOMAIN_TYPES.map(d => ({ v: d, l: DOMAIN_LABELS[d] })) },
            { label: 'Segment',          value: segment,    onChange: setSegment,    opts: SEGMENTS.map(s => ({ v: s, l: SEGMENT_LABELS[s] })) },
            { label: 'Show',             value: showMode,   onChange: setShowMode,   opts: [{ v: 'both', l: 'Top & Bottom' }, { v: 'top', l: 'Top Positive' }, { v: 'bottom', l: 'Top Negative' }] },
            { label: 'Features shown',   value: topN,       onChange: (v: any) => setTopN(Number(v)), opts: [10, 20, 30, 40].map(n => ({ v: n, l: String(n) })) },
          ].map(({ label, value, onChange, opts }) => (
            <div key={label}>
              <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
              <select style={SelectStyle} value={value as any} onChange={e => (onChange as any)(e.target.value)}>
                {opts.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.bright, marginBottom: 2 }}>
          Feature Correlations with M3 Renewal — {DOMAIN_LABELS[domainType]}, {SEGMENT_LABELS[segment]}
        </div>
        <div style={{ fontSize: 12, color: C.sub, marginBottom: 16 }}>
          Pearson correlation between feature usage and renewal outcome. Hover for reach.
        </div>
        <ResponsiveContainer width="100%" height={Math.max(400, chartData.length * 26)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
            <XAxis type="number" domain={[-0.5, 0.5]} tickFormatter={(v: number) => v.toFixed(2)} tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false} />
            <YAxis type="category" dataKey="name" width={220} tick={{ fontSize: 11, fill: C.sub }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }} />
            <ReferenceLine x={0} stroke={C.border} strokeWidth={1} />
            <Bar dataKey="corr" radius={[0, 3, 3, 0]}>
              {chartData.map((entry, i) => <Cell key={i} fill={entry.corr >= 0 ? POS : NEG} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.bright, marginBottom: 4 }}>Feature Detail Table</div>
        <div style={{ fontSize: 12, color: C.text, fontStyle: 'italic', marginBottom: 12 }}>Reach = % of orders where the feature was used; low-reach features may have inflated correlations.</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: C.sub, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>#</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: C.sub, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Feature</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: C.cyan, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Correlation</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: C.sub, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Reach</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((r, i) => (
                <tr key={r.feat} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                  <td style={{ padding: '6px 12px', color: C.sub }}>{i + 1}</td>
                  <td style={{ padding: '6px 12px', color: C.text }}>{r.label}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: (r.corr ?? 0) >= 0 ? POS : NEG }}>{formatCorr(r.corr)}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: C.sub }}>{formatReach(r.reach)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
