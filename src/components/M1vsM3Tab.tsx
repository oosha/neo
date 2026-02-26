'use client'

import { useState, useMemo } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell, Legend
} from 'recharts'
import { m3, m1, getFeatureRows, getCorrelation, DOMAIN_TYPES, DOMAIN_LABELS, SEGMENTS, SEGMENT_LABELS, cleanFeatLabel, formatCorr } from '@/lib/dataUtils'

const C = {
  card: '#131b26', border: '#1e2b3c', grid: '#172030',
  text: '#8d9baa', bright: '#a8b5c0', sub: '#3e5268',
  cyan: '#4da898', pink: '#a86070', purple: '#6060a0', amber: '#a87a40',
}

const SelectStyle: React.CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px',
  fontSize: 13, background: C.card, cursor: 'pointer', color: C.bright,
}

function SectionHead({ title, sub, insight }: { title: string; sub?: string; insight?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.bright, marginBottom: 2 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: C.sub, marginBottom: insight ? 4 : 0 }}>{sub}</div>}
      {insight && <div style={{ fontSize: 12, color: C.text, fontStyle: 'italic' }}>{insight}</div>}
    </div>
  )
}

export default function M1vsM3Tab() {
  const [domainType, setDomainType] = useState('overall')
  const [segment, setSegment] = useState('overall')
  const [topN,    setTopN]    = useState(20)

  const m3Rows = useMemo(() => getFeatureRows(m3, 'overall'), [])
  const m1Rows = useMemo(() => getFeatureRows(m1, 'overall'), [])

  const joined = useMemo(() => {
    const m3Map = new Map(m3Rows.map(r => [r.feat, r]))
    return m1Rows.map(r1 => {
      const r3 = m3Map.get(r1.feat)
      if (!r3) return null
      const c1 = getCorrelation(r1, domainType === 'overall' ? segment : domainType)
      const c3 = getCorrelation(r3, domainType === 'overall' ? segment : domainType)
      if (c1 === null || c3 === null) return null
      return {
        feat: r1.feat, label: cleanFeatLabel(r1.feat),
        m1: Math.round(c1 * 10000) / 10000,
        m3: Math.round(c3 * 10000) / 10000,
        delta: Math.round((c3 - c1) * 10000) / 10000,
      }
    }).filter(Boolean) as { feat: string; label: string; m1: number; m3: number; delta: number }[]
  }, [m3Rows, m1Rows, domainType, segment])

  const topMovers = useMemo(() => [...joined].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, topN), [joined, topN])
  const m1Leaders = useMemo(() => [...joined].sort((a, b) => (b.m1 - b.m3) - (a.m1 - a.m3)).slice(0, 10), [joined])
  const m3Leaders = useMemo(() => [...joined].sort((a, b) => (b.m3 - b.m1) - (a.m3 - a.m1)).slice(0, 10), [joined])

  const scatterData = joined.map(r => ({ x: r.m1, y: r.m3, name: r.label }))

  const ScatterTip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px', fontSize: 13, maxWidth: 240 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, wordBreak: 'break-word', color: C.text }}>{d?.name}</div>
        <div style={{ color: C.purple }}>M1: <strong>{d?.x?.toFixed(3)}</strong></div>
        <div style={{ color: C.cyan }}>M3: <strong>{d?.y?.toFixed(3)}</strong></div>
      </div>
    )
  }

  const BarTip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px', fontSize: 13, maxWidth: 260 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, wordBreak: 'break-word', color: C.text }}>{label}</div>
        {payload.map((p: any) => <div key={p.name} style={{ color: p.color }}>{p.name}: <strong>{p.value?.toFixed(3)}</strong></div>)}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {[
          { label: 'Domain Type',       value: domainType, onChange: setDomainType, opts: DOMAIN_TYPES.map(p => ({ v: p, l: DOMAIN_LABELS[p] })) },
          { label: 'Segment',           value: segment, onChange: setSegment, opts: SEGMENTS.map(s => ({ v: s, l: SEGMENT_LABELS[s] })) },
          { label: 'Top movers shown',  value: topN,    onChange: (v: any) => setTopN(Number(v)), opts: [10, 20, 30].map(n => ({ v: n, l: String(n) })) },
        ].map(({ label, value, onChange, opts }) => (
          <div key={label}>
            <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
            <select style={SelectStyle} value={value as any} onChange={e => (onChange as any)(e.target.value)}>
              {opts.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Scatter */}
      <div>
        <SectionHead
          title={`M1 vs M3 Correlation — ${DOMAIN_LABELS[domainType]}, ${SEGMENT_LABELS[segment]}`}
          sub="Each dot is a feature. Points above the diagonal matter more at M3; below = matter more at M1."
          insight="Most features cluster near the diagonal — signals that matter at M1 tend to matter at M3 too, but the exceptions reveal evolving engagement patterns."
        />
        <ResponsiveContainer width="100%" height={380}>
          <ScatterChart margin={{ top: 10, right: 30, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
            <XAxis dataKey="x" type="number" name="M1 Corr" tickFormatter={(v: number) => v.toFixed(2)} tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false}
              label={{ value: 'M1 Correlation', position: 'insideBottom', offset: -15, fontSize: 12, fill: C.sub }} />
            <YAxis dataKey="y" type="number" name="M3 Corr" tickFormatter={(v: number) => v.toFixed(2)} tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false}
              label={{ value: 'M3 Correlation', angle: -90, position: 'insideLeft', offset: 10, fontSize: 12, fill: C.sub }} />
            <Tooltip content={<ScatterTip />} wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }} />
            <ReferenceLine segment={[{ x: -0.5, y: -0.5 }, { x: 0.5, y: 0.5 }]} stroke={C.border} strokeDasharray="4 4" />
            <ReferenceLine x={0} stroke={C.grid} />
            <ReferenceLine y={0} stroke={C.grid} />
            <Scatter data={scatterData} fill={C.cyan} fillOpacity={0.5} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Top movers */}
      <div>
        <SectionHead title="Top Features — M1 vs M3 Side-by-Side" sub="Features with the largest absolute shift between M1 and M3 correlation" insight="Large shifts indicate features whose importance changes as users decide whether to stay — these are the highest-leverage intervention points." />
        <ResponsiveContainer width="100%" height={Math.max(350, topMovers.length * 28)}>
          <BarChart data={topMovers} layout="vertical" barGap={2} margin={{ left: 10, right: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
            <XAxis type="number" tickFormatter={(v: number) => v.toFixed(2)} tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false} />
            <YAxis type="category" dataKey="label" width={220} tick={{ fontSize: 11, fill: C.sub }} axisLine={false} tickLine={false} />
            <Tooltip content={<BarTip />} wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }} />
            <Legend wrapperStyle={{ fontSize: 12, color: C.sub }} />
            <ReferenceLine x={0} stroke={C.border} strokeWidth={1} />
            <Bar dataKey="m1" name="M1" fill={C.purple} radius={[0, 3, 3, 0]} />
            <Bar dataKey="m3" name="M3" fill={C.cyan}   radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* M1 vs M3 leaders tables */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {[
          { title: 'Matters More at M1', sub: 'Biggest positive M1 − M3 gap', rows: m1Leaders, hiCol: C.purple, loCol: C.cyan },
          { title: 'Matters More at M3', sub: 'Biggest positive M3 − M1 gap', rows: m3Leaders, hiCol: C.cyan, loCol: C.purple },
        ].map(({ title, sub, rows, hiCol, loCol }) => (
          <div key={title} style={{ flex: '1 1 340px' }}>
            <SectionHead title={title} sub={sub} />
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, color: C.sub, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Feature</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', color: C.purple, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>M1 corr</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', color: C.cyan,   fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>M3 corr</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.feat} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    <td style={{ padding: '5px 10px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>{r.label}</td>
                    <td style={{ padding: '5px 10px', textAlign: 'right', color: C.purple, fontWeight: hiCol === C.purple ? 700 : 400 }}>{r.m1.toFixed(3)}</td>
                    <td style={{ padding: '5px 10px', textAlign: 'right', color: C.cyan,   fontWeight: hiCol === C.cyan   ? 700 : 400 }}>{r.m3.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}
