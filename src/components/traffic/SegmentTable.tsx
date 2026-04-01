'use client'

import { useMemo, useState } from 'react'
import { C } from './theme'
import { FunnelRow, groupByMonth, getSortedMonths, formatMonth, formatNum, formatPct, momChange } from '@/lib/trafficUtils'

interface MonthSummary {
  month: string
  monthLabel: string
  visitors: number
  getStarted: number
  domainSelected: number
  orders: number
  paidOrders: number
  orderRate: number
  paidRate: number
  paidPct: number
}

type SortKey = keyof MonthSummary

export default function SegmentTable({ data }: { data: FunnelRow[] }) {
  const [sortBy, setSortBy] = useState<SortKey>('month')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const rows = useMemo(() => {
    const months = groupByMonth(data)
    const sorted = getSortedMonths(months)

    return sorted.map(m => {
      const events = months.get(m)!
      const visitors = events.get('homepage_and_get_started') || 0
      const getStarted = events.get('website_get_started_viewed') || 0
      const domainSelected = events.get('website_domain_selected') || 0
      const orders = events.get('order_created') || 0
      const paidOrders = events.get('paid_order_created') || 0

      return {
        month: m,
        monthLabel: formatMonth(m),
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

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy]
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
    return copy
  }, [rows, sortBy, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(key); setSortDir('desc') }
  }

  // Compute MoM for each row
  const momMap = useMemo(() => {
    const map = new Map<string, { visitors: number | null; orders: number | null; paidOrders: number | null }>()
    const chronological = [...rows].sort((a, b) => a.month.localeCompare(b.month))
    for (let i = 0; i < chronological.length; i++) {
      const curr = chronological[i]
      const prev = i > 0 ? chronological[i - 1] : null
      map.set(curr.month, {
        visitors: prev ? momChange(curr.visitors, prev.visitors) : null,
        orders: prev ? momChange(curr.orders, prev.orders) : null,
        paidOrders: prev ? momChange(curr.paidOrders, prev.paidOrders) : null,
      })
    }
    return map
  }, [rows])

  const thStyle: React.CSSProperties = {
    padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600,
    color: C.sub, textTransform: 'uppercase', letterSpacing: '0.5px',
    cursor: 'pointer', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
    userSelect: 'none',
  }
  const tdStyle: React.CSSProperties = {
    padding: '10px 12px', textAlign: 'right', fontSize: 13, color: C.textHi,
    borderBottom: `1px solid ${C.border}`,
  }

  const cols: { key: SortKey; label: string; format: (v: number) => string }[] = [
    { key: 'visitors', label: 'Visitors', format: formatNum },
    { key: 'getStarted', label: 'Get Started', format: formatNum },
    { key: 'domainSelected', label: 'Domain Selected', format: formatNum },
    { key: 'orders', label: 'Orders', format: formatNum },
    { key: 'paidOrders', label: 'Paid Orders', format: formatNum },
    { key: 'orderRate', label: 'Visitor\u2192Order%', format: v => formatPct(v) },
    { key: 'paidRate', label: 'Visitor\u2192Paid%', format: v => formatPct(v) },
    { key: 'paidPct', label: 'Paid%', format: v => formatPct(v) },
  ]

  function MoMBadge({ val }: { val: number | null }) {
    if (val === null) return null
    const color = val > 0 ? C.cyan : val < 0 ? C.pink : C.sub
    return (
      <span style={{ fontSize: 10, color, marginLeft: 4 }}>
        {val > 0 ? '\u25B2' : val < 0 ? '\u25BC' : ''}{formatPct(Math.abs(val))}
      </span>
    )
  }

  return (
    <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 20, overflowX: 'auto' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.textHi, marginBottom: 16 }}>
        Monthly Breakdown
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: 'left' }} onClick={() => toggleSort('month')}>
              Month {sortBy === 'month' ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : ''}
            </th>
            {cols.map(c => (
              <th key={c.key} style={thStyle} onClick={() => toggleSort(c.key)}>
                {c.label} {sortBy === c.key ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((r, i) => {
            const mom = momMap.get(r.month)
            return (
              <tr key={r.month} style={{ background: i % 2 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>{r.monthLabel}</td>
                <td style={tdStyle}>{formatNum(r.visitors)}<MoMBadge val={mom?.visitors ?? null} /></td>
                <td style={tdStyle}>{formatNum(r.getStarted)}</td>
                <td style={tdStyle}>{formatNum(r.domainSelected)}</td>
                <td style={tdStyle}>{formatNum(r.orders)}<MoMBadge val={mom?.orders ?? null} /></td>
                <td style={tdStyle}>{formatNum(r.paidOrders)}<MoMBadge val={mom?.paidOrders ?? null} /></td>
                <td style={tdStyle}>{formatPct(r.orderRate)}</td>
                <td style={tdStyle}>{formatPct(r.paidRate)}</td>
                <td style={tdStyle}>{formatPct(r.paidPct)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
