'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import FilterBar, { Filters, DEFAULT_FILTERS } from '@/components/traffic/FilterBar'
import KPICards from '@/components/traffic/KPICards'
import FunnelChart from '@/components/traffic/FunnelChart'
import TrendCharts from '@/components/traffic/TrendCharts'
import SegmentTable from '@/components/traffic/SegmentTable'
import { C } from '@/components/traffic/theme'
import { FunnelRow, groupByMonth, getSortedMonths, buildQueryString, formatMonth } from '@/lib/trafficUtils'

export default function TrafficDashboard() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [funnelData, setFunnelData] = useState<FunnelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>('')

  const fetchData = useCallback(async (f: Filters) => {
    setLoading(true)
    setError(null)
    try {
      const qs = buildQueryString({
        startDate: f.startDate,
        endDate: f.endDate,
        utmSource: f.utmSource || undefined,
        device: f.device || undefined,
        country: f.country || undefined,
        neoOffering: f.neoOffering || undefined,
      })
      const res = await fetch(`/api/traffic/funnel?${qs}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setFunnelData(json.data || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(filters)
  }, [filters, fetchData])

  // Derive available months and set selected month
  const months = useMemo(() => {
    const grouped = groupByMonth(funnelData)
    return getSortedMonths(grouped)
  }, [funnelData])

  useEffect(() => {
    if (months.length && !months.includes(selectedMonth)) {
      setSelectedMonth(months[0])
    }
  }, [months, selectedMonth])

  // KPI data for latest and previous month
  const kpiData = useMemo(() => {
    const grouped = groupByMonth(funnelData)
    const get = (month: string, event: string) => grouped.get(month)?.get(event) || 0

    const curr = months[0] || ''
    const prev = months[1] || ''

    return {
      visitors: get(curr, 'homepage_and_get_started'),
      orders: get(curr, 'order_created'),
      paidOrders: get(curr, 'paid_order_created'),
      prevVisitors: get(prev, 'homepage_and_get_started'),
      prevOrders: get(prev, 'order_created'),
      prevPaidOrders: get(prev, 'paid_order_created'),
    }
  }, [funnelData, months])

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.textHi,
      fontFamily: 'Nunito, sans-serif', padding: '32px 24px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.textHi, margin: 0 }}>
            Neo Traffic Quality Dashboard
          </h1>
          <p style={{ fontSize: 13, color: C.sub, margin: '6px 0 0' }}>
            Understand traffic quality across sources, devices, countries, and offerings
          </p>
        </div>

        {/* Filters */}
        <FilterBar filters={filters} onChange={setFilters} loading={loading} />

        {error && (
          <div style={{
            background: 'rgba(168,96,112,0.1)', border: `1px solid ${C.pink}`,
            borderRadius: 8, padding: '12px 16px', marginBottom: 20,
            color: C.pink, fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {!loading && funnelData.length > 0 && (
          <>
            {/* Month selector for funnel */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <span style={{ fontSize: 12, color: C.sub }}>Showing KPIs & funnel for:</span>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                style={{
                  background: C.card, color: C.textHi, border: `1px solid ${C.border}`,
                  borderRadius: 6, padding: '5px 10px', fontSize: 13, fontFamily: 'inherit',
                }}
              >
                {months.map(m => (
                  <option key={m} value={m}>{formatMonth(m)}</option>
                ))}
              </select>
            </div>

            {/* KPI Cards */}
            <KPICards data={kpiData} />

            {/* Funnel Chart */}
            <div style={{ marginBottom: 24 }}>
              <FunnelChart data={funnelData} selectedMonth={selectedMonth} />
            </div>

            {/* Trend Charts */}
            <div style={{ marginBottom: 24 }}>
              <TrendCharts data={funnelData} />
            </div>

            {/* Segment Table */}
            <SegmentTable data={funnelData} />
          </>
        )}

        {!loading && funnelData.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: 60, color: C.sub }}>
            No data available for the selected filters
          </div>
        )}
      </div>
    </div>
  )
}
