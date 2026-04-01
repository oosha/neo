'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { C } from './theme'
import { FunnelRow, groupByMonth, getSortedMonths, formatMonth, formatNum, formatPct } from '@/lib/trafficUtils'

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: C.textHi, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <span style={{ fontWeight: 600 }}>
            {p.dataKey.includes('Rate') || p.dataKey.includes('paidPct') ? formatPct(p.value) : formatNum(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function TrendCharts({ data }: { data: FunnelRow[] }) {
  const trendData = useMemo(() => {
    const months = groupByMonth(data)
    const sorted = getSortedMonths(months).reverse() // chronological

    return sorted.map(m => {
      const events = months.get(m)!
      const visitors = events.get('homepage_and_get_started') || 0
      const orders = events.get('order_created') || 0
      const paidOrders = events.get('paid_order_created') || 0
      const getStarted = events.get('website_get_started_viewed') || 0
      const domainSelected = events.get('website_domain_selected') || 0

      return {
        month: formatMonth(m),
        visitors,
        getStarted,
        domainSelected,
        orders,
        paidOrders,
        orderRate: visitors ? (orders / visitors) * 100 : 0,
        paidRate: visitors ? (paidOrders / visitors) * 100 : 0,
        paidPct: orders ? (paidOrders / orders) * 100 : 0,
      }
    })
  }, [data])

  if (!trendData.length) return null

  const chartBox: React.CSSProperties = {
    background: C.card, borderRadius: 10, border: `1px solid ${C.border}`,
    padding: '20px 20px 10px', marginBottom: 20,
  }
  const titleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: C.textHi, marginBottom: 12 }

  return (
    <div>
      {/* Traffic Volume */}
      <div style={chartBox}>
        <div style={titleStyle}>Traffic Volume (Monthly)</div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trendData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false}
              tickFormatter={(v: number) => formatNum(v)} />
            <Tooltip content={<TrendTooltip />}
              wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: C.sub }} />
            <Line type="monotone" dataKey="visitors" name="Visitors" stroke={C.blue} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="getStarted" name="Get Started" stroke={C.purple} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="orders" name="Orders" stroke={C.amber} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="paidOrders" name="Paid Orders" stroke={C.cyan} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Conversion Rates */}
      <div style={chartBox}>
        <div style={titleStyle}>Conversion Rates (Monthly)</div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trendData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false}
              tickFormatter={(v: number) => formatPct(v)} domain={[0, 'auto']} />
            <Tooltip content={<TrendTooltip />}
              wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: C.sub }} />
            <Line type="monotone" dataKey="orderRate" name="Visitor \u2192 Order %" stroke={C.amber} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="paidRate" name="Visitor \u2192 Paid %" stroke={C.cyan} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="paidPct" name="Paid % of Orders" stroke={C.green} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
