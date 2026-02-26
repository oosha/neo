'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

function TabLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320, color: '#3e5268', fontSize: 13 }}>
      Loading…
    </div>
  )
}

const SummaryTab      = dynamic(() => import('@/components/SummaryTab'),      { ssr: false, loading: TabLoader })
const OverviewTab     = dynamic(() => import('@/components/OverviewTab'),     { ssr: false, loading: TabLoader })
const CorrelationsTab = dynamic(() => import('@/components/CorrelationsTab'), { ssr: false, loading: TabLoader })
const DomainTab       = dynamic(() => import('@/components/DomainTab'),       { ssr: false, loading: TabLoader })
const M1vsM3Tab       = dynamic(() => import('@/components/M1vsM3Tab'),       { ssr: false, loading: TabLoader })
const MailboxTab      = dynamic(() => import('@/components/MailboxTab'),      { ssr: false, loading: TabLoader })

const TABS = [
  { id: 'summary',      label: 'Summary' },
  { id: 'overview',     label: 'Renewals' },
  { id: 'correlations', label: 'Feature Correlations' },
  { id: 'domain',       label: 'Domain Type' },
  { id: 'm1m3',         label: 'M1 vs M3' },
  { id: 'mailbox',      label: 'Mailbox Seats' },
]

const C = {
  bg: '#0e1117', header: '#0b0f19', border: '#1e2b3c',
  textHi: '#a8b5c0', sub: '#3e5268', cyan: '#4da898',
}

export default function M3Correlation() {
  const [activeTab, setActiveTab] = useState('summary')

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ borderBottom: `1px solid ${C.border}`, background: C.header, padding: '0 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ padding: '20px 0 0' }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: C.sub, marginBottom: 4 }}>
              Neo · Renewal Analysis
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.textHi, marginBottom: 3 }}>
              M3 Renewal: Feature Correlation
            </div>
            <div style={{ fontSize: 12, color: C.sub, marginBottom: 14 }}>
              Data analysis from Feb 2026 · 17,538 orders · Co.site &amp; Custom Domain
            </div>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '10px 18px', fontSize: 13,
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  color: activeTab === tab.id ? C.cyan : C.sub,
                  background: 'none', border: 'none',
                  borderBottom: activeTab === tab.id ? `2px solid ${C.cyan}` : '2px solid transparent',
                  cursor: 'pointer', transition: 'color 0.15s', whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px' }}>
        {activeTab === 'summary'      && <SummaryTab />}
        {activeTab === 'overview'     && <OverviewTab />}
        {activeTab === 'correlations' && <CorrelationsTab />}
        {activeTab === 'domain'       && <DomainTab />}
        {activeTab === 'm1m3'         && <M1vsM3Tab />}
        {activeTab === 'mailbox'      && <MailboxTab />}
      </div>
    </div>
  )
}
