'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { m3, m1, getRenewalRate, getOrderCount, DOMAIN_LABELS, DOMAIN_SEGMENTS, PLAN_SEGMENTS, SEGMENT_LABELS, getFeatureRows, getCorrelation, cleanFeatLabel } from '@/lib/dataUtils'

const C = {
  card: '#131b26', border: '#1e2b3c', grid: '#172030',
  text: '#8d9baa', bright: '#a8b5c0', sub: '#3e5268',
  cyan: '#4da898', pink: '#a86070', purple: '#6060a0',
  amber: '#a87a40', green: '#407a68',
}

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px', fontSize: 13 }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: C.text }}>{label}</div>
      {payload.map((p: any) => <div key={p.name} style={{ color: p.color }}>{p.name}: <strong>{p.value}%</strong></div>)}
    </div>
  )
}

function SectionHead({ title, sub, insight }: { title: string; sub?: string; insight?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.bright, marginBottom: 2 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: C.sub, marginBottom: insight ? 4 : 0 }}>{sub}</div>}
      {insight && <div style={{ fontSize: 12, color: C.text, fontStyle: 'italic' }}>{insight}</div>}
    </div>
  )
}

export default function DomainTab() {
  const domainTypesData = useMemo(() =>
    DOMAIN_SEGMENTS.map(dt => ({
      name: DOMAIN_LABELS[dt], key: dt,
      m3Rate: getRenewalRate(m3, 'overall', dt),
      m1Rate: getRenewalRate(m1, 'overall', dt),
      orders: getOrderCount(m3, 'overall', dt),
    })),
  [])

  const planData = useMemo(() =>
    PLAN_SEGMENTS.map(seg => {
      const entry: Record<string, any> = { seg: SEGMENT_LABELS[seg] }
      DOMAIN_SEGMENTS.forEach(dt => { entry[DOMAIN_LABELS[dt]] = Math.round((getRenewalRate(m3, 'overall', seg) ?? 0) * 1000) / 10 })
      return entry
    }), [])

  const overallChartData = domainTypesData.map(r => ({
    name: r.name,
    M1: Math.round((r.m1Rate ?? 0) * 1000) / 10,
    M3: Math.round((r.m3Rate ?? 0) * 1000) / 10,
  }))

  const m3Rows = useMemo(() => getFeatureRows(m3, 'overall'), [])
  const m1Rows = useMemo(() => getFeatureRows(m1, 'overall'), [])

  const featureCorrs = useMemo(() => {
    const m3Map = new Map(m3Rows.map(r => [r.feat, r]))
    return m1Rows.map(r1 => {
      const r3 = m3Map.get(r1.feat)
      if (!r3) return null
      return {
        feat: r1.feat,
        label: cleanFeatLabel(r1.feat),
        co_site: getCorrelation(r3, 'co_site'),
        custom_domain: getCorrelation(r3, 'custom_domain'),
      }
    }).filter(Boolean) as { feat: string; label: string; co_site: number | null; custom_domain: number | null }[]
  }, [m3Rows, m1Rows])

  const topByCo = useMemo(() =>
    [...featureCorrs]
      .filter(r => r.co_site !== null)
      .sort((a, b) => (b.co_site ?? 0) - (a.co_site ?? 0))
      .slice(0, 8),
  [featureCorrs])

  const bottomByCo = useMemo(() =>
    [...featureCorrs]
      .filter(r => r.co_site !== null)
      .sort((a, b) => (a.co_site ?? 0) - (b.co_site ?? 0))
      .slice(0, 5),
  [featureCorrs])

  const topByCustom = useMemo(() =>
    [...featureCorrs]
      .filter(r => r.custom_domain !== null)
      .sort((a, b) => (b.custom_domain ?? 0) - (a.custom_domain ?? 0))
      .slice(0, 8),
  [featureCorrs])

  const bottomByCustom = useMemo(() =>
    [...featureCorrs]
      .filter(r => r.custom_domain !== null)
      .sort((a, b) => (a.custom_domain ?? 0) - (b.custom_domain ?? 0))
      .slice(0, 5),
  [featureCorrs])

  const divergence = useMemo(() => {
    const withDiff = featureCorrs.map(r => ({
      ...r,
      diff: Math.abs((r.co_site ?? 0) - (r.custom_domain ?? 0))
    }))
    return [...withDiff]
      .filter(r => r.co_site !== null && r.custom_domain !== null)
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 10)
  }, [featureCorrs])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

      {/* Domain Type Overview */}
      <div>
        <SectionHead title="Domain Type Overview — KPI Snapshot" sub="Co.site vs Custom Domain renewal rates and order volume" insight="Co.site and custom domain users show different renewal patterns — domain choice is a key signal." />
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {domainTypesData.map((r) => (
            <div key={r.key} style={{
              flex: '1 1 240px', minWidth: 200,
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{r.name}</div>
              <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.sub, marginBottom: 3 }}>M1</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.purple }}>{r.m1Rate !== null ? `${(r.m1Rate * 100).toFixed(1)}%` : '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.sub, marginBottom: 3 }}>M3</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.cyan }}>{r.m3Rate !== null ? `${(r.m3Rate * 100).toFixed(1)}%` : '—'}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.sub, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                Orders: <span style={{ fontWeight: 700, color: C.text }}>{r.orders?.toLocaleString() ?? '—'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Signals by Domain Type */}
      <div>
        <SectionHead title="Feature Signals by Domain Type" sub="Top 8 positive and bottom 5 negative correlations for each domain type" insight="Different features drive retention depending on domain setup — co.site users respond to site engagement; custom domain users prioritize core email features." />
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 380px' }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 8 }}>Co.site — Top Signals</div>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                <tbody>
                  {topByCo.map((r, i) => (
                    <tr key={r.feat} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '5px 0 5px 0', color: C.text }}>{r.label}</td>
                      <td style={{ padding: '5px 0 5px 12px', textAlign: 'right', color: C.cyan, fontWeight: 700 }}>+{r.co_site?.toFixed(3) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.pink, marginBottom: 8 }}>Co.site — Risk Signals</div>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                <tbody>
                  {bottomByCo.map((r, i) => (
                    <tr key={r.feat} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '5px 0 5px 0', color: C.text }}>{r.label}</td>
                      <td style={{ padding: '5px 0 5px 12px', textAlign: 'right', color: C.pink, fontWeight: 700 }}>{r.co_site?.toFixed(3) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ flex: '1 1 380px' }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 8 }}>Custom Domain — Top Signals</div>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                <tbody>
                  {topByCustom.map((r, i) => (
                    <tr key={r.feat} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '5px 0 5px 0', color: C.text }}>{r.label}</td>
                      <td style={{ padding: '5px 0 5px 12px', textAlign: 'right', color: C.cyan, fontWeight: 700 }}>+{r.custom_domain?.toFixed(3) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.pink, marginBottom: 8 }}>Custom Domain — Risk Signals</div>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                <tbody>
                  {bottomByCustom.map((r, i) => (
                    <tr key={r.feat} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '5px 0 5px 0', color: C.text }}>{r.label}</td>
                      <td style={{ padding: '5px 0 5px 12px', textAlign: 'right', color: C.pink, fontWeight: 700 }}>{r.custom_domain?.toFixed(3) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Signal Divergence */}
      <div>
        <SectionHead title="Co.site vs Custom Domain — Signal Divergence" sub="Features with the largest difference in correlation between domain types" insight="These features are the biggest levers for domain-specific retention strategies." />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Feature', 'Co.site', 'Custom', 'Δ'].map((h, i) => (
                  <th key={h} style={{
                    textAlign: i > 0 ? 'right' : 'left', padding: '8px 12px',
                    fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5,
                    color: i === 1 ? C.amber : i === 2 ? C.green : i === 3 ? C.bright : C.sub,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {divergence.map((r, i) => (
                <tr key={r.feat} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                  <td style={{ padding: '7px 12px', color: C.text }}>{r.label}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: C.amber, fontWeight: 700 }}>{r.co_site?.toFixed(3) ?? '—'}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: C.green, fontWeight: 700 }}>{r.custom_domain?.toFixed(3) ?? '—'}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: C.bright, fontWeight: 700 }}>+{r.diff.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Neo Site Engagement */}
      <div>
        <SectionHead title="Neo Site Engagement — Domain Type Deep Dive" sub="How Neo site features predict renewal across domain types" insight="For co.site users, getting their Neo site live with real visitors strongly predicts renewal. Target: get every co.site user to publish their site and share it." />
        <div style={{ overflowX: 'auto', marginBottom: 14 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Feature', 'Co.site', 'Custom', 'Insight'].map((h, i) => (
                  <th key={h} style={{
                    textAlign: i === 1 || i === 2 ? 'center' : 'left', padding: '8px 12px',
                    fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5,
                    color: i === 1 ? C.amber : i === 2 ? C.green : C.sub,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '8px 12px', color: C.text }}>Neo site: visitor volume</td>
                <td style={{ padding: '8px 12px', textAlign: 'center', color: C.amber, fontWeight: 700 }}>+0.118</td>
                <td style={{ padding: '8px 12px', textAlign: 'center', color: C.green }}>+0.036</td>
                <td style={{ padding: '8px 12px', color: C.text, fontSize: 12 }}>Strong for co.site, weak for custom</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.015)' }}>
                <td style={{ padding: '8px 12px', color: C.text }}>Neo site: has visitor</td>
                <td style={{ padding: '8px 12px', textAlign: 'center', color: C.amber, fontWeight: 700 }}>+0.085</td>
                <td style={{ padding: '8px 12px', textAlign: 'center', color: C.green }}>+0.032</td>
                <td style={{ padding: '8px 12px', color: C.text, fontSize: 12 }}>Any site traffic is positive</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '8px 12px', color: C.text }}>Neo site: published</td>
                <td style={{ padding: '8px 12px', textAlign: 'center', color: C.amber, fontWeight: 700 }}>+0.058</td>
                <td style={{ padding: '8px 12px', textAlign: 'center', color: C.sub }}>n/a</td>
                <td style={{ padding: '8px 12px', color: C.text, fontSize: 12 }}>Publishing predicts co.site renewal</td>
              </tr>
              <tr style={{ background: 'rgba(255,255,255,0.015)' }}>
                <td style={{ padding: '8px 12px', color: C.text }}>Neo site: draft only</td>
                <td style={{ padding: '8px 12px', textAlign: 'center', color: C.green }}>+0.023</td>
                <td style={{ padding: '8px 12px', textAlign: 'center', color: C.pink, fontWeight: 700 }}>−0.015</td>
                <td style={{ padding: '8px 12px', color: C.text, fontSize: 12 }}>Draft w/o publish: slight churn risk for custom</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 16px', border: `1px solid ${C.border}`, borderRadius: 8, background: C.card, maxWidth: 680 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, marginBottom: 4 }}>Action item</div>
          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.65 }}>
            For co.site users, getting their Neo site live with real visitors strongly predicts renewal. <span style={{ fontWeight: 600 }}>Target: get every co.site user to publish their site and share it.</span> This is a high-leverage retention lever.
          </div>
        </div>
      </div>

      {/* M1 vs M3 by domain type */}
      <div>
        <SectionHead title="M1 vs M3 Renewal — Domain Type Comparison" sub="Tracking decline from activation month to month 3" insight="Custom domain users show steeper M1→M3 drop than co.site users — activation quality is the bottleneck." />
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={overallChartData} layout="vertical" barGap={4} margin={{ left: 90 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
            <XAxis type="number" tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false} domain={[0, 'auto']} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: C.sub }} width={90} axisLine={false} tickLine={false} />
            <Tooltip content={<Tip />} wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }} />
            <Legend wrapperStyle={{ fontSize: 12, color: C.sub }} />
            <Bar dataKey="M1" fill={C.purple} radius={[0, 3, 3, 0]} />
            <Bar dataKey="M3" fill={C.cyan}   radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}
