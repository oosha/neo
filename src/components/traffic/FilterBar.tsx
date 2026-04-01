'use client'

import { useState, useRef, useEffect } from 'react'
import { C } from './theme'

export interface Filters {
  startDate: string
  endDate: string
  utmSource: string[]
  device: string[]
  country: string[]
  neoOffering: string[]
}

export const UTM_SOURCES = ['google', 'organic', 'blog', 'bing', 'referral', 'meta', 'reddit', 'direct']
export const DEVICES = ['desktop', 'mobile', 'tablet']
export const COUNTRIES = ['United States', 'India', 'United Kingdom', 'Canada', 'Australia', 'Philippines', 'Nigeria', 'South Africa', 'Kenya', 'Germany']
export const NEO_OFFERINGS = ['co.site', 'User custom domain']

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
  utmSource: [],
  device: [],
  country: [],
  neoOffering: [],
}

const inputStyle: React.CSSProperties = {
  background: C.card, color: C.textHi, border: `1px solid ${C.border}`,
  borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit',
  outline: 'none', minWidth: 130, colorScheme: 'dark',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: C.sub, marginBottom: 3,
  textTransform: 'uppercase', letterSpacing: '0.5px',
}

// Multi-select dropdown component
function MultiSelect({ label, options, selected, onChange }: {
  label: string
  options: string[]
  selected: string[]
  onChange: (vals: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val])
  }

  const displayText = selected.length === 0 ? `All ${label}` : selected.length === 1 ? selected[0] : `${selected.length} selected`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={labelStyle}>{label}</div>
      <div
        onClick={() => setOpen(!open)}
        style={{
          ...inputStyle, minWidth: 140, cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', gap: 6, userSelect: 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
          {displayText}
        </span>
        <span style={{ fontSize: 10, color: C.sub }}>{open ? '\u25B2' : '\u25BC'}</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '6px 0', minWidth: 180, maxHeight: 240, overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <div
            onClick={() => onChange([])}
            style={{
              padding: '6px 14px', fontSize: 12, cursor: 'pointer',
              color: selected.length === 0 ? C.cyan : C.sub,
              background: selected.length === 0 ? 'rgba(77,168,152,0.08)' : 'transparent',
            }}
          >
            All (no filter)
          </div>
          {options.map(opt => {
            const active = selected.includes(opt)
            return (
              <div
                key={opt}
                onClick={() => toggle(opt)}
                style={{
                  padding: '6px 14px', fontSize: 12, cursor: 'pointer',
                  color: active ? C.cyan : C.textHi, display: 'flex', alignItems: 'center', gap: 8,
                  background: active ? 'rgba(77,168,152,0.08)' : 'transparent',
                }}
              >
                <span style={{
                  width: 14, height: 14, borderRadius: 3, border: `1px solid ${active ? C.cyan : C.border}`,
                  background: active ? C.cyan : 'transparent', display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#0e1117',
                  flexShrink: 0,
                }}>
                  {active ? '\u2713' : ''}
                </span>
                {opt}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function FilterBar({
  filters,
  onChange,
  onSubmit,
  loading,
}: {
  filters: Filters
  onChange: (f: Filters) => void
  onSubmit: () => void
  loading: boolean
}) {
  const setDraft = (key: keyof Filters, val: string | string[]) => onChange({ ...filters, [key]: val })

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end',
      padding: '16px 20px', background: C.card, borderRadius: 10,
      border: `1px solid ${C.border}`, marginBottom: 24,
    }}>
      <div>
        <div style={labelStyle}>From</div>
        <input type="date" value={filters.startDate} onChange={e => setDraft('startDate', e.target.value)} style={inputStyle} />
      </div>
      <div>
        <div style={labelStyle}>To</div>
        <input type="date" value={filters.endDate} onChange={e => setDraft('endDate', e.target.value)} style={inputStyle} />
      </div>
      <MultiSelect label="UTM Source" options={UTM_SOURCES} selected={filters.utmSource} onChange={v => setDraft('utmSource', v)} />
      <MultiSelect label="Device" options={DEVICES} selected={filters.device} onChange={v => setDraft('device', v)} />
      <MultiSelect label="Country" options={COUNTRIES} selected={filters.country} onChange={v => setDraft('country', v)} />
      <MultiSelect label="Neo Offering" options={NEO_OFFERINGS} selected={filters.neoOffering} onChange={v => setDraft('neoOffering', v)} />
      <button
        onClick={onSubmit}
        disabled={loading}
        style={{
          background: loading ? C.border : C.cyan, color: '#0e1117', border: 'none',
          borderRadius: 6, padding: '8px 20px', fontSize: 13, fontWeight: 700,
          fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1, marginBottom: 1,
        }}
      >
        {loading ? 'Loading...' : 'Apply Filters'}
      </button>
    </div>
  )
}
