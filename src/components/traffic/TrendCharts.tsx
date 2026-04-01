'use client'

import { useMemo } from 'react'
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
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

      return {
        month: formatMonth(m),
        visitors,
        getStarted,
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
      {/* Traffic Volume - Lines for visitors on left axis, Bars for orders on right axis */}
      <div style={chartBox}>
        <div style={titleStyle}>Traffic Volume (Monthly)</div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={trendData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false}
              tickFormatter={(v: number) => formatNum(v)} label={{ value: 'Visitors', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: C.sub } }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false}
              tickFormatter={(v: number) => formatNum(v)} label={{ value: 'Orders', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: C.sub } }} />
            <Tooltip content={<TrendTooltip />}
              wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: C.sub }} />
            <Line yAxisId="left" type="monotone" dataKey="visitors" name="Visitors" stroke={C.blue} strokeWidth={2} dot={{ r: 3 }} />
            <Line yAxisId="left" type="monotone" dataKey="getStarted" name="Get Started" stroke={C.purple} strokeWidth={2} dot={{ r: 3 }} />
            <Bar yAxisId="right" dataKey="orders" name="Orders" fill={C.amber} fillOpacity={0.7} barSize={20} />
            <Bar yAxisId="right" dataKey="paidOrders" name="Paid Orders" fill={C.cyan} fillOpacity={0.8} barSize={20} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Conversion Rates - Bars for conversion rates, line for paid % on right axis */}
      <div style={chartBox}>
        <div style={titleStyle}>Conversion Rates (Monthly)</div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={trendData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false}
              tickFormatter={(v: number) => formatPct(v)} domain={[0, 'auto']}
              label={{ value: 'Conv %', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: C.sub } }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false}
              tickFormatter={(v: number) => formatPct(v)} domain={[0, 100]}
              label={{ value: 'Paid %', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: C.sub } }} />
            <Tooltip content={<TrendTooltip />}
              wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: C.sub }} />
            <Bar yAxisId="left" dataKey="orderRate" name="Visitor \u2192 Order %" fill={C.amber} fillOpacity={0.7} barSize={20} />
            <Bar yAxisId="left" dataKey="paidRate" name="Visitor \u2192 Paid %" fill={C.cyan} fillOpacity={0.8} barSize={20} />
            <Line yAxisId="right" type="monotone" dataKey="paidPct" name="Paid % of Orders" stroke={C.green} strokeWidth={2.5} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
