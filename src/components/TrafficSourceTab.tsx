'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend
} from 'recharts'
import {
  m3, m1, getRenewalRate, getOrderCount, getFeatureRows,
  getCorrelation, getReach, SEGMENT_LABELS,
  UTM_SOURCES, UTM_LABELS, cleanFeatLabel
} from '@/lib/dataUtils'

const C = {
  card: '#131b26', border: '#1e2b3c', grid: '#172030',
  text: '#8d9baa', bright: '#a8b5c0', sub: '#7a95ae',
  cyan: '#4da898', pink: '#a86070', purple: '#6060a0',
  amber: '#a87a40', green: '#407a68', orange: '#c87040',
}

// Colour palette for UTM sources
const SRC_COLORS: Record<string, string> = {
  utm_source_direct:          '#4da898',
  utm_source_organic:         '#6090c8',
  utm_source_google:          '#a87a40',
  utm_source_facebook:        '#7060b0',
  utm_source_youtube:         '#c84040',
  utm_source_neo_hooks:       '#50b060',
  utm_source_neo_referral:    '#a86070',
  utm_source_performance_max: '#b08040',
  utm_source_referral:        '#4870a0',
  utm_source_others:          '#607090',
  utm_source_ai_llm:          '#8060b0',
}

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px', fontSize: 13 }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: C.text }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }}>{p.name}: <strong>{p.value}%</strong></div>
      ))}
    </div>
  )
}

function CorrBadge({ v }: { v: number }) {
  return (
    <span style={{
      display: 'inline-block', minWidth: 52, textAlign: 'center', fontWeight: 700, fontSize: 12,
      background: v >= 0 ? 'rgba(86,182,168,0.1)' : 'rgba(201,112,128,0.1)',
      color: v >= 0 ? C.cyan : C.pink, borderRadius: 4, padding: '1px 6px',
    }}>{v >= 0 ? '+' : ''}{v.toFixed(3)}</span>
  )
}

const SelectStyle: React.CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px',
  fontSize: 13, background: C.card, cursor: 'pointer', color: C.text,
}

export default function TrafficSourceTab() {
  const [selectedSource, setSelectedSource] = useState(UTM_SOURCES[0])
  const [segment, setSegment] = useState('overall')

  // Overview table data — all UTM sources
  const sourceOverview = useMemo(() =>
    UTM_SOURCES.map(src => ({
      src,
      label: UTM_LABELS[src],
      orders:  getOrderCount(m3, src, 'overall') ?? 0,
      m3Rate:  getRenewalRate(m3, src, 'overall'),
      m1Rate:  getRenewalRate(m1, src, 'overall'),
    })).filter(r => (r.orders ?? 0) > 0)
    .sort((a, b) => (b.orders ?? 0) - (a.orders ?? 0)),
  [])

  // Chart data — M3 renewal rate by source
  const chartData = useMemo(() =>
    sourceOverview.map(r => ({
      name: r.label,
      src: r.src,
      M3: Math.round((r.m3Rate ?? 0) * 1000) / 10,
      M1: Math.round((r.m1Rate ?? 0) * 1000) / 10,
    })),
  [sourceOverview])

  // Feature correlations for selected source
  const featureRows = useMemo(() => getFeatureRows(m3, selectedSource), [selectedSource])
  const topFeatures = useMemo(() =>
    featureRows
      .map(row => ({ feat: row.feat, corr: getCorrelation(row, segment), reach: getReach(row, segment) }))
      .filter(r => r.corr !== null)
      .sort((a, b) => (b.corr ?? 0) - (a.corr ?? 0)),
  [featureRows, segment])

  const topPos = topFeatures.slice(0, 8)
  const topNeg = [...topFeatures].reverse().slice(0, 8).reverse()

  const totalOrders = sourceOverview.reduce((s, r) => s + r.orders, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

      {/* Section 1: Overview table */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.bright, marginBottom: 2 }}>Traffic Source Overview</div>
        <div style={{ fontSize: 12, color: C.sub, marginBottom: 16 }}>
          M3 and M1 renewal rates by acquisition channel. Facebook excluded (no orders in cohort).
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Source', 'Orders', 'Share', 'M3 Rate', 'M1 Rate', 'M1→M3 Drop'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Source' ? 'left' : 'right', padding: '8px 12px', fontWeight: 600, color: C.sub, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sourceOverview.map((r, i) => {
                const drop = r.m1Rate !== null && r.m3Rate !== null ? r.m1Rate - r.m3Rate : null
                const color = SRC_COLORS[r.src] ?? C.text
                return (
                  <tr
                    key={r.src}
                    style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)', cursor: 'pointer' }}
                    onClick={() => setSelectedSource(r.src)}
                  >
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 8, verticalAlign: 'middle' }} />
                      <span style={{ color: selectedSource === r.src ? C.bright : C.text, fontWeight: selectedSource === r.src ? 600 : 400 }}>{r.label}</span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: C.text }}>{r.orders.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: C.sub }}>{((r.orders / totalOrders) * 100).toFixed(1)}%</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: (r.m3Rate ?? 0) > 0.35 ? C.cyan : (r.m3Rate ?? 0) < 0.1 ? C.pink : C.text }}>
                      {r.m3Rate !== null ? `${(r.m3Rate * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: C.sub }}>
                      {r.m1Rate !== null ? `${(r.m1Rate * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: drop !== null && drop > 0 ? C.pink : C.sub }}>
                      {drop !== null ? `-${(drop * 100).toFixed(1)}pp` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: C.sub, marginTop: 8, fontStyle: 'italic' }}>
          Click a row to explore its feature correlations below.
        </div>
      </div>

      {/* Section 2: M3 Renewal Rate by Source */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.bright, marginBottom: 2 }}>M3 vs M1 Renewal Rate by Source</div>
        <div style={{ fontSize: 12, color: C.sub, marginBottom: 16 }}>Sources sorted by order volume (highest first).</div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ left: 0, right: 20, top: 8, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false} angle={-30} textAnchor="end" />
            <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: C.sub }} axisLine={false} tickLine={false} domain={[0, 75]} />
            <Tooltip content={<Tip />} wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }} />
            <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12, color: C.sub }} />
            <Bar dataKey="M1" fill={C.sub} radius={[3,3,0,0]} opacity={0.5} />
            <Bar dataKey="M3" radius={[3,3,0,0]}>
              {chartData.map((entry, i) => <Cell key={i} fill={SRC_COLORS[entry.src] ?? C.cyan} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Section 3: Feature correlations for selected source */}
      <div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.bright, marginBottom: 2 }}>
              Feature Correlations — {UTM_LABELS[selectedSource]}
            </div>
            <div style={{ fontSize: 12, color: C.sub }}>Top positive and negative drivers of M3 renewal for this traffic source.</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Source</label>
              <select style={SelectStyle} value={selectedSource} onChange={e => setSelectedSource(e.target.value)}>
                {sourceOverview.map(r => <option key={r.src} value={r.src}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Segment</label>
              <select style={SelectStyle} value={segment} onChange={e => setSegment(e.target.value)}>
                {Object.entries(SEGMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Top positive */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6 }}>
            <div style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: C.cyan, borderBottom: `1px solid ${C.border}` }}>
              Top Positive Drivers
            </div>
            {topPos.map((r, i) => (
              <div key={r.feat} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, padding: '8px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                <span style={{ color: C.text }}>{cleanFeatLabel(r.feat)}</span>
                <CorrBadge v={r.corr ?? 0} />
                <span style={{ color: C.sub, fontSize: 11, textAlign: 'right', minWidth: 36 }}>{r.reach !== null ? `${(r.reach * 100).toFixed(0)}%` : '—'}</span>
              </div>
            ))}
          </div>

          {/* Top negative */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6 }}>
            <div style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: C.pink, borderBottom: `1px solid ${C.border}` }}>
              Top Negative Drivers
            </div>
            {topNeg.map((r, i) => (
              <div key={r.feat} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, padding: '8px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                <span style={{ color: C.text }}>{cleanFeatLabel(r.feat)}</span>
                <CorrBadge v={r.corr ?? 0} />
                <span style={{ color: C.sub, fontSize: 11, textAlign: 'right', minWidth: 36 }}>{r.reach !== null ? `${(r.reach * 100).toFixed(0)}%` : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
