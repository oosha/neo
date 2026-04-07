'use client'

import { useState, useCallback, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts'
import { C } from './theme'
import { FunnelRow, groupByMonth, getSortedMonths, formatMonth, formatNum, formatPct, KEY_FUNNEL_STEPS, eventShort } from '@/lib/trafficUtils'
import { Filters, DEFAULT_FILTERS, UTM_SOURCES, DEVICES, COUNTRIES, NEO_OFFERINGS } from './FilterBar'

const SEGMENT_OPTIONS = [
  { key: 'neoOffering', label: 'Neo Offering', values: NEO_OFFERINGS },
  { key: 'utmSource', label: 'UTM Source', values: UTM_SOURCES },
  { key: 'device', label: 'Device', values: DEVICES },
  { key: 'country', label: 'Country', values: COUNTRIES.slice(0, 5) },
]

const SEGMENT_COLORS = [C.cyan, C.amber, C.purple, C.blue, C.pink, C.green, '#8a9a5a', '#5a6a8a']

const inputStyle: React.CSSProperties = {
  background: C.card, color: C.textHi, border: `1px solid ${C.border}`,
  borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  colorScheme: 'dark',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: C.sub, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px',
}

function CompareTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: C.textHi, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <span style={{ fontWeight: 600 }}>{typeof p.value === 'number' && p.value < 100 ? formatPct(p.value) : formatNum(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function CompareTab({ baseFilters }: { baseFilters: Filters }) {
  const [segmentBy, setSegmentBy] = useState('neoOffering')
  const [segmentData, setSegmentData] = useState<Record<string, FunnelRow[]>>({})
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState(baseFilters.startDate)
  const [endDate, setEndDate] = useState(baseFilters.endDate)

  const segmentConfig = SEGMENT_OPTIONS.find(s => s.key === segmentBy)!

  const fetchComparison = useCallback(async () => {
    setLoading(true)
    const results: Record<string, FunnelRow[]> = {}

    try {
      await Promise.all(
        segmentConfig.values.map(async (val) => {
          const params = new URLSearchParams({ startDate, endDate })
          // Map segment key to API param
          if (segmentBy === 'neoOffering') params.set('neoOffering', val)
          else if (segmentBy === 'utmSource') params.set('utmSource', val)
          else if (segmentBy === 'device') params.set('device', val)
          else if (segmentBy === 'country') params.set('country', val)

          const res = await fetch(`/api/traffic/funnel?${params}`)
          const json = await res.json()
          if (json.data) results[val] = json.data
        })
      )
      setSegmentData(results)
    } catch {
      // silently handle
    } finally {
      setLoading(false)
    }
  }, [segmentBy, segmentConfig.values, startDate, endDate])

  // Build comparison data for charts
  const comparisonData = useMemo(() => {
    const segments = Object.keys(segmentData)
    if (segments.length === 0) return { funnel: [], trends: [] }

    // Get months from the first segment
    const firstSegment = segmentData[segments[0]]
    const months = getSortedMonths(groupByMonth(firstSegment))

    // Monthly trends: visitors, orders, paid orders, conversion rates per segment
    const trends = months.reverse().map(m => {
      const row: Record<string, string | number> = { month: formatMonth(m) }
      for (const seg of segments) {
        const monthEvents = groupByMonth(segmentData[seg]).get(m)
        const visitors = monthEvents?.get('homepage_and_get_started') || 0
        const orders = monthEvents?.get('order_created') || 0
        const paidOrders = monthEvents?.get('paid_order_created') || 0
        row[`${seg}_visitors`] = visitors
        row[`${seg}_orders`] = orders
        row[`${seg}_paidOrders`] = paidOrders
        row[`${seg}_orderRate`] = visitors ? (orders / visitors) * 100 : 0
        row[`${seg}_paidRate`] = visitors ? (paidOrders / visitors) * 100 : 0
        row[`${seg}_paidPct`] = orders ? (paidOrders / orders) * 100 : 0
      }
      return row
    })

    // Latest month funnel comparison
    const latestMonth = months[months.length - 1]
    const funnel = KEY_FUNNEL_STEPS.map(step => {
      const row: Record<string, string | number> = { step: eventShort(step) }
      for (const seg of segments) {
        const monthEvents = groupByMonth(segmentData[seg]).get(latestMonth)
        row[seg] = monthEvents?.get(step) || 0
      }
      return row
    })

    return { funnel, trends }
  }, [segmentData])

  const segments = Object.keys(segmentData)

  return (
    <div>
      {/* Comparison filters */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end',
        padding: '16px 20px', background: C.card, borderRadius: 10,
        border: `1px solid ${C.border}`, marginBottom: 24,
      }}>
        <div>
          <div style={labelStyle}>From</div>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div style={labelStyle}>To</div>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div style={labelStyle}>Compare By</div>
          <select value={segmentBy} onChange={e => setSegmentBy(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
            {SEGMENT_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <button
          onClick={fetchComparison}
          disabled={loading}
          style={{
            background: loading ? C.border : C.cyan, color: '#0e1117', border: 'none',
            borderRadius: 6, padding: '8px 20px', fontSize: 13, fontWeight: 700,
            fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Loading...' : 'Compare'}
        </button>
      </div>

      {loading && <div style={{ color: C.cyan, padding: 20, fontSize: 13 }}>Fetching data for {segmentConfig.values.length} segments...</div>}

      {segments.length > 0 && !loading && (
        <>
          {/* Funnel comparison */}
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: '20px', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textHi, marginBottom: 12 }}>
              Funnel Comparison (Latest Month)
            </div>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={comparisonData.funnel} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                <XAxis dataKey="step" tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false} tickFormatter={(v: number) => formatNum(v)} />
                <Tooltip content={<CompareTooltip />} wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {segments.map((seg, i) => (
                  <Bar key={seg} dataKey={seg} name={seg} fill={SEGMENT_COLORS[i % SEGMENT_COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Conversion rate comparison trends */}
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: '20px', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textHi, marginBottom: 12 }}>
              Visitor to Order Rate (%) - Comparison
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={comparisonData.trends} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false} tickFormatter={(v: number) => formatPct(v)} />
                <Tooltip content={<CompareTooltip />} wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {segments.map((seg, i) => (
                  <Line key={seg} type="monotone" dataKey={`${seg}_orderRate`} name={`${seg} Order%`}
                    stroke={SEGMENT_COLORS[i % SEGMENT_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Paid % comparison */}
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: '20px', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textHi, marginBottom: 12 }}>
              Paid % of Orders - Comparison
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={comparisonData.trends} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false} tickFormatter={(v: number) => formatPct(v)} />
                <Tooltip content={<CompareTooltip />} wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {segments.map((seg, i) => (
                  <Line key={seg} type="monotone" dataKey={`${seg}_paidPct`} name={`${seg} Paid%`}
                    stroke={SEGMENT_COLORS[i % SEGMENT_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Segment summary table */}
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: '20px', overflowX: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textHi, marginBottom: 12 }}>
              Segment Summary (Latest Month)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Segment', 'Visitors', 'Orders', 'Paid Orders', 'Order Rate', 'Paid Rate', 'Paid %'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Segment' ? 'left' : 'right', fontSize: 11, fontWeight: 600, color: C.sub, borderBottom: `1px solid ${C.border}`, textTransform: 'uppercase' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {segments.map((seg, i) => {
                  const latest = comparisonData.trends[comparisonData.trends.length - 1]
                  if (!latest) return null
                  const v = (latest[`${seg}_visitors`] as number) || 0
                  const o = (latest[`${seg}_orders`] as number) || 0
                  const p = (latest[`${seg}_paidOrders`] as number) || 0
                  return (
                    <tr key={seg} style={{ background: i % 2 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length], fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{seg}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, color: C.textHi, borderBottom: `1px solid ${C.border}` }}>{formatNum(v)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, color: C.textHi, borderBottom: `1px solid ${C.border}` }}>{formatNum(o)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, color: C.textHi, borderBottom: `1px solid ${C.border}` }}>{formatNum(p)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, color: C.textHi, borderBottom: `1px solid ${C.border}` }}>{formatPct(v ? (o / v) * 100 : 0)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, color: C.textHi, borderBottom: `1px solid ${C.border}` }}>{formatPct(v ? (p / v) * 100 : 0)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, color: C.textHi, borderBottom: `1px solid ${C.border}` }}>{formatPct(o ? (p / o) * 100 : 0)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {segments.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 40, color: C.sub, fontSize: 13 }}>
          Select a segment and click Compare to see side-by-side analysis
        </div>
      )}
    </div>
  )
}
