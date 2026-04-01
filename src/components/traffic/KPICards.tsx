'use client'

import { C } from './theme'
import { formatNum, formatPct, momChange } from '@/lib/trafficUtils'

interface KPIData {
  visitors: number
  orders: number
  paidOrders: number
  prevVisitors: number
  prevOrders: number
  prevPaidOrders: number
}

function KPICard({ label, value, formatted, prev, suffix }: {
  label: string
  value: number
  formatted: string
  prev: number
  suffix?: string
}) {
  const change = momChange(value, prev)
  const isUp = change !== null && change > 0
  const isDown = change !== null && change < 0

  return (
    <div style={{
      flex: '1 1 160px', padding: '16px 18px', background: C.card,
      borderRadius: 10, border: `1px solid ${C.border}`, minWidth: 150,
    }}>
      <div style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.textHi }}>
        {formatted}{suffix}
      </div>
      {change !== null && (
        <div style={{
          fontSize: 12, marginTop: 4,
          color: isUp ? C.cyan : isDown ? C.pink : C.sub,
        }}>
          {isUp ? '\u25B2' : isDown ? '\u25BC' : '\u2014'} {formatPct(Math.abs(change))} MoM
        </div>
      )}
    </div>
  )
}

export default function KPICards({ data }: { data: KPIData }) {
  const visitorToOrder = data.visitors ? (data.orders / data.visitors) * 100 : 0
  const visitorToPaid = data.visitors ? (data.paidOrders / data.visitors) * 100 : 0
  const paidPct = data.orders ? (data.paidOrders / data.orders) * 100 : 0

  const prevVisitorToOrder = data.prevVisitors ? (data.prevOrders / data.prevVisitors) * 100 : 0
  const prevVisitorToPaid = data.prevVisitors ? (data.prevPaidOrders / data.prevVisitors) * 100 : 0
  const prevPaidPct = data.prevOrders ? (data.prevPaidOrders / data.prevOrders) * 100 : 0

  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
      <KPICard label="Total Visitors" value={data.visitors} formatted={formatNum(data.visitors)} prev={data.prevVisitors} />
      <KPICard label="Orders Created" value={data.orders} formatted={formatNum(data.orders)} prev={data.prevOrders} />
      <KPICard label="Paid Orders" value={data.paidOrders} formatted={formatNum(data.paidOrders)} prev={data.prevPaidOrders} />
      <KPICard label="Visitor \u2192 Order" value={visitorToOrder} formatted={formatPct(visitorToOrder)} prev={prevVisitorToOrder} />
      <KPICard label="Visitor \u2192 Paid" value={visitorToPaid} formatted={formatPct(visitorToPaid)} prev={prevVisitorToPaid} />
      <KPICard label="Paid % of Orders" value={paidPct} formatted={formatPct(paidPct)} prev={prevPaidPct} />
    </div>
  )
}
