'use client'

import { C } from './theme'

export interface Filters {
  startDate: string
  endDate: string
  utmSource: string
  device: string
  country: string
  neoOffering: string
}

const UTM_SOURCES = ['', 'google', 'organic', 'blog', 'bing', 'referral', 'meta', 'reddit', 'direct']
const DEVICES = ['', 'desktop', 'mobile', 'tablet']
const COUNTRIES = ['', 'United States', 'India', 'United Kingdom', 'Canada', 'Australia', 'Philippines', 'Nigeria', 'South Africa', 'Kenya', 'Germany']
const NEO_OFFERINGS = ['', 'co.site', 'User custom domain']

function getDefaultDates() {
  const end = new Date()
  const start = new Date()
  start.setMonth(start.getMonth() - 7)
  start.setDate(1)
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

export const DEFAULT_FILTERS: Filters = {
  ...getDefaultDates(),
  utmSource: '',
  device: '',
  country: '',
  neoOffering: '',
}

const selectStyle: React.CSSProperties = {
  background: C.card,
  color: C.textHi,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  minWidth: 120,
}

const inputStyle: React.CSSProperties = {
  ...selectStyle,
  minWidth: 130,
  colorScheme: 'dark',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: C.sub,
  marginBottom: 3,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

export default function FilterBar({
  filters,
  onChange,
  loading,
}: {
  filters: Filters
  onChange: (f: Filters) => void
  loading: boolean
}) {
  const set = (key: keyof Filters, val: string) => onChange({ ...filters, [key]: val })

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end',
      padding: '16px 20px', background: C.card, borderRadius: 10,
      border: `1px solid ${C.border}`, marginBottom: 24,
    }}>
      <div>
        <div style={labelStyle}>From</div>
        <input type="date" value={filters.startDate} onChange={e => set('startDate', e.target.value)} style={inputStyle} />
      </div>
      <div>
        <div style={labelStyle}>To</div>
        <input type="date" value={filters.endDate} onChange={e => set('endDate', e.target.value)} style={inputStyle} />
      </div>
      <div>
        <div style={labelStyle}>UTM Source</div>
        <select value={filters.utmSource} onChange={e => set('utmSource', e.target.value)} style={selectStyle}>
          <option value="">All Sources</option>
          {UTM_SOURCES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <div style={labelStyle}>Device</div>
        <select value={filters.device} onChange={e => set('device', e.target.value)} style={selectStyle}>
          <option value="">All Devices</option>
          {DEVICES.filter(Boolean).map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div>
        <div style={labelStyle}>Country</div>
        <select value={filters.country} onChange={e => set('country', e.target.value)} style={selectStyle}>
          <option value="">All Countries</option>
          {COUNTRIES.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <div style={labelStyle}>Neo Offering</div>
        <select value={filters.neoOffering} onChange={e => set('neoOffering', e.target.value)} style={selectStyle}>
          <option value="">All Offerings</option>
          {NEO_OFFERINGS.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      {loading && (
        <div style={{ fontSize: 12, color: C.cyan, padding: '8px 0' }}>Loading...</div>
      )}
    </div>
  )
}
