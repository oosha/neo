'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { C } from './theme'
import { KEY_FUNNEL_STEPS, eventShort, formatNum, formatPct, FunnelRow, groupByMonth, getSortedMonths } from '@/lib/trafficUtils'

function FunnelTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: C.textHi, fontWeight: 600, marginBottom: 4 }}>{d.label}</div>
      <div style={{ color: C.sub }}>Devices: <span style={{ color: C.textHi }}>{formatNum(d.value)}</span></div>
      {d.dropOff !== null && (
        <div style={{ color: C.pink }}>Drop-off: {formatPct(d.dropOff)}</div>
      )}
      {d.convFromTop !== null && (
        <div style={{ color: C.cyan }}>From top: {formatPct(d.convFromTop)}</div>
      )}
    </div>
  )
}

export default function FunnelChart({ data, selectedMonth }: { data: FunnelRow[]; selectedMonth: string }) {
  const chartData = useMemo(() => {
    const months = groupByMonth(data)
    const monthData = months.get(selectedMonth)
    if (!monthData) return []

    const topValue = monthData.get(KEY_FUNNEL_STEPS[0]) || 1
    let prevValue = topValue

    return KEY_FUNNEL_STEPS.map(key => {
      const value = monthData.get(key) || 0
      const dropOff = prevValue > 0 ? -((prevValue - value) / prevValue) * 100 : null
      const convFromTop = topValue > 0 ? (value / topValue) * 100 : null
      prevValue = value
      return { key, label: eventShort(key), value, dropOff: key === KEY_FUNNEL_STEPS[0] ? null : dropOff, convFromTop }
    })
  }, [data, selectedMonth])

  if (!chartData.length) return <div style={{ color: C.sub, padding: 20 }}>No funnel data for selected month</div>

  return (
    <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: '20px 20px 10px' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.textHi, marginBottom: 16 }}>
        Purchase Funnel
      </div>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 120, right: 60, top: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false}
            tickFormatter={(v: number) => formatNum(v)} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: C.textHi }} axisLine={false} tickLine={false} width={115} />
          <Tooltip content={<FunnelTooltip />} cursor={{ fill: 'rgba(77,168,152,0.06)' }}
            wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none' }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={28}>
            {chartData.map((d, i) => (
              <Cell key={d.key} fill={i <= 1 ? C.blue : i >= chartData.length - 2 ? C.cyan : C.purple} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Conversion summary below chart */}
      <div style={{ display: 'flex', gap: 20, padding: '12px 0 4px', flexWrap: 'wrap' }}>
        {chartData.filter(d => d.convFromTop !== null).map(d => (
          <div key={d.key} style={{ fontSize: 11, color: C.sub }}>
            {d.label}: <span style={{ color: C.textHi, fontWeight: 600 }}>{formatPct(d.convFromTop)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
