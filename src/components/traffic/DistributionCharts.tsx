'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { C } from './theme'
import { formatMonth, formatNum } from '@/lib/trafficUtils'

interface DistRow {
  plan_type?: string
  billing_cycle?: string
  google_source?: string
  month: string
  orders: number
}

const PLAN_COLORS: Record<string, string> = {
  pro: C.cyan, pro_new: C.cyan,
  pro_trial: C.green, pro_trial_new: C.green,
  premium: C.blue, premium_new: C.blue,
  premium_trial: C.purple, premium_trial_new: C.purple,
  ultra: C.amber, ultra_new: C.amber,
  ultra_trial: '#8a6030', ultra_trial_new: '#8a6030',
  starter: '#5a8a9a', starter_new: '#5a8a9a',
  starter_trial: '#406a7a', starter_trial_new: '#406a7a',
  lite: C.sub, lite_new: C.sub,
  lite_trial: '#607060',
}

const BILLING_COLORS: Record<string, string> = {
  monthly: C.cyan,
  yearly: C.blue,
  two_yearly: C.purple,
  three_yearly: '#8a6a9a',
  four_yearly: C.amber,
  quarterly: C.sub,
}

const GOOGLE_COLORS: Record<string, string> = {
  'Google SEM': C.cyan,
  'Google PMax': C.amber,
  'Google Other': C.purple,
}

function cleanPlanName(name: string): string {
  return name.replace(/_new$/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function cleanBillingName(name: string): string {
  const map: Record<string, string> = {
    monthly: 'Monthly', yearly: 'Yearly', two_yearly: '2-Year', three_yearly: '3-Year', four_yearly: '4-Year', quarterly: 'Quarterly',
  }
  return map[name] || name
}

function DistTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0)
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: C.textHi, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {payload.filter((p: any) => p.value > 0).map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <span style={{ fontWeight: 600 }}>{formatNum(p.value)}</span>
          <span style={{ color: C.sub, marginLeft: 4 }}>({((p.value / total) * 100).toFixed(1)}%)</span>
        </div>
      ))}
      <div style={{ color: C.sub, borderTop: `1px solid ${C.border}`, marginTop: 4, paddingTop: 4 }}>
        Total: {formatNum(total)}
      </div>
    </div>
  )
}

function StackedBarChart({ data, title, colorMap, cleanFn }: {
  data: Record<string, string | number>[]
  title: string
  colorMap: Record<string, string>
  cleanFn?: (name: string) => string
}) {
  if (!data.length) return null
  const keys = Object.keys(data[0]).filter(k => k !== 'month')
  const labelFn = cleanFn || ((n: string) => n)

  return (
    <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: '20px 20px 10px', flex: '1 1 480px', minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.textHi, marginBottom: 12 }}>{title}</div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false} tickFormatter={(v: number) => formatNum(v)} />
          <Tooltip content={<DistTooltip />} wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none' }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {keys.map(k => (
            <Bar key={k} dataKey={k} name={labelFn(k)} stackId="a" fill={colorMap[k] || C.sub} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function DistributionCharts({ planData, billingData, googleData }: {
  planData: DistRow[]
  billingData: DistRow[]
  googleData: DistRow[]
}) {
  // Plan distribution - all orders
  const planChartAll = useMemo(() => {
    const monthMap = new Map<string, Record<string, number>>()
    for (const r of planData) {
      const m = formatMonth(r.month)
      if (!monthMap.has(m)) monthMap.set(m, {})
      const plan = r.plan_type || 'unknown'
      monthMap.get(m)![plan] = (monthMap.get(m)![plan] || 0) + r.orders
    }
    const planTotals = new Map<string, number>()
    Array.from(monthMap.values()).forEach(vals => {
      for (const [p, o] of Object.entries(vals)) planTotals.set(p, (planTotals.get(p) || 0) + o)
    })
    const topPlans = Array.from(planTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p]) => p)

    return Array.from(monthMap.entries())
      .map(([month, vals]) => {
        const row: Record<string, string | number> = { month }
        for (const p of topPlans) row[p] = vals[p] || 0
        return row
      })
      .reverse()
  }, [planData])

  // Plan distribution - paid only (exclude trial plan types)
  const planChartPaid = useMemo(() => {
    const monthMap = new Map<string, Record<string, number>>()
    for (const r of planData) {
      const plan = r.plan_type || 'unknown'
      if (plan.includes('trial')) continue
      const m = formatMonth(r.month)
      if (!monthMap.has(m)) monthMap.set(m, {})
      monthMap.get(m)![plan] = (monthMap.get(m)![plan] || 0) + r.orders
    }
    const planTotals = new Map<string, number>()
    Array.from(monthMap.values()).forEach(vals => {
      for (const [p, o] of Object.entries(vals)) planTotals.set(p, (planTotals.get(p) || 0) + o)
    })
    const topPlans = Array.from(planTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([p]) => p)

    return Array.from(monthMap.entries())
      .map(([month, vals]) => {
        const row: Record<string, string | number> = { month }
        for (const p of topPlans) row[p] = vals[p] || 0
        return row
      })
      .reverse()
  }, [planData])

  // Billing cycle chart
  const billingChart = useMemo(() => {
    const monthMap = new Map<string, Record<string, number>>()
    for (const r of billingData) {
      const m = formatMonth(r.month)
      if (!monthMap.has(m)) monthMap.set(m, {})
      const bc = r.billing_cycle || 'unknown'
      monthMap.get(m)![bc] = (monthMap.get(m)![bc] || 0) + r.orders
    }
    const bcKeys = Array.from(new Set(billingData.map(r => r.billing_cycle || 'unknown')))
    return Array.from(monthMap.entries())
      .map(([month, vals]) => {
        const row: Record<string, string | number> = { month }
        for (const k of bcKeys) row[k] = vals[k] || 0
        return row
      })
      .reverse()
  }, [billingData])

  // Google source split chart
  const googleChart = useMemo(() => {
    const monthMap = new Map<string, Record<string, number>>()
    for (const r of googleData) {
      const m = formatMonth(r.month)
      if (!monthMap.has(m)) monthMap.set(m, {})
      const src = r.google_source || 'unknown'
      monthMap.get(m)![src] = (monthMap.get(m)![src] || 0) + r.orders
    }
    const srcKeys = Array.from(new Set(googleData.map(r => r.google_source || 'unknown')))
    return Array.from(monthMap.entries())
      .map(([month, vals]) => {
        const row: Record<string, string | number> = { month }
        for (const k of srcKeys) row[k] = vals[k] || 0
        return row
      })
      .reverse()
  }, [googleData])

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.textHi, marginBottom: 16 }}>Order Distribution</div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <StackedBarChart data={planChartAll} title="Plan Distribution - All Orders" colorMap={PLAN_COLORS} cleanFn={cleanPlanName} />
        <StackedBarChart data={planChartPaid} title="Plan Distribution - Paid Orders Only" colorMap={PLAN_COLORS} cleanFn={cleanPlanName} />
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <StackedBarChart data={billingChart} title="Billing Cycle Distribution" colorMap={BILLING_COLORS} cleanFn={cleanBillingName} />
        <StackedBarChart data={googleChart} title="Google Source Breakdown" colorMap={GOOGLE_COLORS} />
      </div>
    </div>
  )
}
