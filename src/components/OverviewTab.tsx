'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { m3, m1, getRenewalRate, getOrderCount, formatRate, DOMAIN_SEGMENTS, PLAN_SEGMENTS, DOMAIN_LABELS, SEGMENT_LABELS } from '@/lib/dataUtils'

const C = {
  card: '#131b26', border: '#1e2b3c', grid: '#172030',
  text: '#8d9baa', bright: '#a8b5c0', sub: '#3e5268',
  cyan: '#4da898', pink: '#a86070', purple: '#6060a0',
  amber: '#a87a40', green: '#407a68',
}

// Neo mailbox seat data (hardcoded as specified)
const mailboxData = [
  { name: '1 seat',   orders: 12827, m3: 28.5, pct: 73.1 },
  { name: '2 seats',  orders: 3136,  m3: 37.5, pct: 17.9 },
  { name: '3–5',      orders: 1331,  m3: 41.3, pct: 7.6  },
  { name: '6–20',     orders: 244,   m3: 40.6, pct: 1.4  },
]

function KpiCard({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 20px', minWidth: 150, background: C.card, flex: '1 1 150px' }}>
      <div style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent ?? C.cyan, lineHeight: 1, letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>{sub}</div>}
    </div>
  )
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

function ChartTable({ data }: { data: { name: string; M1: number; M3: number; orders: number | null }[] }) {
  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 360px' }}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: C.text }} axisLine={{ stroke: C.border }} tickLine={false} />
            <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: C.sub }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
            <Tooltip content={<Tip />} wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }} />
            <Legend wrapperStyle={{ fontSize: 12, color: C.sub }} />
            <Bar dataKey="M1" fill={C.purple} radius={[3, 3, 0, 0]} />
            <Bar dataKey="M3" fill={C.cyan}   radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ flex: '0 0 auto', alignSelf: 'center', overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['Segment', 'Orders', 'M1', 'M3', 'Drop'].map((h, i) => (
                <th key={h} style={{
                  textAlign: i > 0 ? 'right' : 'left', padding: '5px 10px 5px 0',
                  color: i === 2 ? C.purple : i === 3 ? C.cyan : i === 4 ? C.pink : C.sub,
                  fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(r => {
              const drop = r.M1 > 0 ? +((r.M1 - r.M3) / r.M1 * 100).toFixed(1) : 0
              return (
                <tr key={r.name} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '6px 10px 6px 0', color: C.text }}>{r.name}</td>
                  <td style={{ textAlign: 'right', padding: '6px 10px', color: C.sub }}>{r.orders?.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', padding: '6px 10px', color: C.purple, fontWeight: 700 }}>{r.M1}%</td>
                  <td style={{ textAlign: 'right', padding: '6px 10px', color: C.cyan,   fontWeight: 700 }}>{r.M3}%</td>
                  <td style={{ textAlign: 'right', padding: '6px 0',    color: C.pink,   fontWeight: 700 }}>−{drop}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function OverviewTab() {
  const overallM3   = getRenewalRate(m3, 'overall', 'overall')
  const overallM1   = getRenewalRate(m1, 'overall', 'overall')
  const totalOrders = getOrderCount(m3, 'overall', 'overall')
  const dropPct     = overallM1 && overallM3 ? (overallM1 - overallM3) / overallM1 * 100 : null

  // Domain type breakdown (co_site, custom_domain)
  const domainData = DOMAIN_SEGMENTS.map(seg => ({
    name: DOMAIN_LABELS[seg],
    M1: +((getRenewalRate(m1, 'overall', seg) ?? 0) * 100).toFixed(1),
    M3: +((getRenewalRate(m3, 'overall', seg) ?? 0) * 100).toFixed(1),
    orders: getOrderCount(m3, 'overall', seg),
  }))

  // Plan tier breakdown (pro, premium, ultra)
  const planData = PLAN_SEGMENTS.map(seg => ({
    name: SEGMENT_LABELS[seg],
    M1: +((getRenewalRate(m1, 'overall', seg) ?? 0) * 100).toFixed(1),
    M3: +((getRenewalRate(m3, 'overall', seg) ?? 0) * 100).toFixed(1),
    orders: getOrderCount(m3, 'overall', seg),
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
      <div>
        <SectionHead title="Overall Neo Renewal" insight="Renewal drops significantly between M1 and M3 — the gap highlights where early churn is concentrated." />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <KpiCard label="M3 Renewal Rate" value={formatRate(overallM3)} accent={C.cyan}   sub="Month 3" />
          <KpiCard label="M1 Renewal Rate" value={formatRate(overallM1)} accent={C.purple} sub="Month 1" />
          <KpiCard label="Total Orders"    value={totalOrders ? totalOrders.toLocaleString() : 'N/A'} accent={C.bright} sub="M3 cohort" />
          <KpiCard label="M1 → M3 Drop"   value={dropPct ? `-${dropPct.toFixed(1)}%` : 'N/A'} accent={C.pink} sub="of M1 renewers lost" />
        </div>
      </div>

      <div>
        <SectionHead title="Renewal by Domain Type" sub="Co.site · Custom Domain" insight="Co.site and custom domain users show distinct renewal patterns. This split reveals how product type influences retention." />
        <ChartTable data={domainData} />
      </div>

      <div>
        <SectionHead title="Renewal by Plan Tier" sub="Pro · Premium · Ultra" insight="Plan tier shows differentiation in retention. Higher-tier plans may attract more committed users." />
        <ChartTable data={planData} />
      </div>

      <div>
        <SectionHead
          title="Renewal by Mailbox Seat Count"
          sub="1 · 2 · 3–5 · 6–20"
          insight="Renewal jumps 9pp when moving from 1 to 2+ seats. Solo users renew at 28.5%; multi-seat accounts stabilise at 37–41%."
        />
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 340px' }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={mailboxData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.text }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: C.sub }} axisLine={false} tickLine={false} domain={[25, 45]} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null
                    const d = mailboxData.find(r => r.name === label)
                    return (
                      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px', fontSize: 13 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4, color: C.bright }}>{label}</div>
                        <div style={{ color: C.cyan }}>M3 Renewal: <strong>{payload[0].value}%</strong></div>
                        <div style={{ color: C.sub, fontSize: 11 }}>{d?.orders.toLocaleString()} orders ({d?.pct}% of total)</div>
                      </div>
                    )
                  }}
                  wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}
                />
                <Bar dataKey="m3" name="M3 Renewal" fill={C.cyan} radius={[3, 3, 0, 0]}
                  label={{ position: 'top', fontSize: 10, fill: C.sub, formatter: (v: number) => `${v}%` }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ flex: '0 0 auto', alignSelf: 'center', overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Seats', 'Orders', '% total', 'M3'].map((h, i) => (
                    <th key={h} style={{ textAlign: i > 0 ? 'right' : 'left', padding: '5px 10px 5px 0', color: i === 3 ? C.cyan : C.sub, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mailboxData.map((r, i) => (
                  <tr key={r.name} style={{ borderBottom: `1px solid ${C.border}`, background: r.name === '2 seats' ? 'rgba(77,168,152,0.07)' : 'transparent' }}>
                    <td style={{ padding: '6px 10px 6px 0', color: r.name === '2 seats' ? C.bright : C.text, fontWeight: r.name === '2 seats' ? 700 : 400 }}>{r.name}</td>
                    <td style={{ textAlign: 'right', padding: '6px 10px', color: C.sub }}>{r.orders.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', padding: '6px 10px', color: C.sub }}>{r.pct}%</td>
                    <td style={{ textAlign: 'right', padding: '6px 0', color: r.m3 >= 37 ? C.cyan : C.pink, fontWeight: 700 }}>{r.m3}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
