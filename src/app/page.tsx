'use client'
import Link from 'next/link'

const C = {
  bg: '#0e1117', card: '#161b27', border: '#21293d', borderHi: '#2b3650',
  text: '#c9d1d9', sub: '#566a87', cyan: '#56b6a8', purple: '#7c7bba',
}

const ANALYSES = [
  {
    href: '/m3-correlation',
    title: 'M3 Renewal Correlation Analysis',
    description:
      'Which early product behaviours best predict whether a Neo paid subscriber renews at month 3? ' +
      'Covers Pearson correlations for 142 first-30-day features across 17,538 orders, ' +
      'segmented by domain type (co.site vs custom domain) and plan tier (Pro, Premium, Ultra). ' +
      'Includes mailbox seat analysis and Neo site engagement signals.',
    tags: ['Renewal', 'Correlation', 'M3', 'Domain Type', 'Neo Site'],
    date: 'Feb 2026',
    status: 'Live',
  },
]

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: '0 32px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 0 24px' }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: C.sub, marginBottom: 6 }}>
            Neo · Internal Analytics
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>
            Analytics Hub
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 32px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 18 }}>
          Analyses
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ANALYSES.map(a => (
            <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
              <div
                style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '22px 26px', background: C.card, cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = C.borderHi}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = C.border}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{a.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(86,182,168,0.12)', color: C.cyan, letterSpacing: 0.8 }}>
                      {a.status.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 12, color: C.sub }}>{a.date}</span>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.8, marginBottom: 14 }}>{a.description}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {a.tags.map(tag => (
                    <span key={tag} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 3, background: 'rgba(124,123,186,0.1)', color: C.purple, letterSpacing: 0.5 }}>
                      {tag.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
