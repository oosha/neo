'use client'

import {
  m3, m1, getRenewalRate, getOrderCount, getFeatureRows, getCorrelation,
  getReach, DOMAIN_TYPES, DOMAIN_LABELS, SEGMENT_LABELS, DOMAIN_SEGMENTS,
  PLAN_SEGMENTS, cleanFeatLabel, formatRate
} from '@/lib/dataUtils'

const C = {
  bg: '#0e1117', card: '#1a2332', border: '#1e2b3c',
  textHi: '#a8b5c0', sub: '#3e5268', accent: '#4da898',
  green: '#238636', red: '#da3633', orange: '#d98e00',
}

interface KPICardProps {
  label: string
  value: string | number
  subtext?: string
  highlight?: boolean
}

function KPICard({ label, value, subtext, highlight }: KPICardProps) {
  return (
    <div
      style={{
        flex: 1, minWidth: 140, padding: 16, background: C.card,
        border: `1px solid ${C.border}`, borderRadius: 6,
        color: C.textHi, fontSize: 13,
      }}
    >
      <div style={{ fontSize: 11, color: C.sub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: highlight ? C.accent : C.textHi, marginBottom: 4 }}>
        {value}
      </div>
      {subtext && <div style={{ fontSize: 11, color: C.sub }}>{subtext}</div>}
    </div>
  )
}

interface FeatureRowProps {
  feature: string
  correlation: number
  reach: number
}

function FeatureRow({ feature, correlation, reach }: FeatureRowProps) {
  const isPositive = correlation > 0
  const color = isPositive ? C.green : C.red
  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 12,
        padding: 10, borderBottom: `1px solid ${C.border}`, fontSize: 12,
      }}
    >
      <div style={{ color: C.textHi }}>{cleanFeatLabel(feature)}</div>
      <div style={{ color, fontWeight: 600, textAlign: 'right' }}>
        {correlation > 0 ? '+' : ''}{correlation.toFixed(3)}
      </div>
      <div style={{ color: C.sub, textAlign: 'right' }}>{formatRate(reach)}</div>
    </div>
  )
}

interface TableRowProps {
  label: string
  value: string | number
  isNegative?: boolean
}

function TableRow({ label, value, isNegative }: TableRowProps) {
  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: '1fr auto', gap: 16,
        padding: '10px 0', borderBottom: `1px solid ${C.border}`,
        fontSize: 13, alignItems: 'center',
      }}
    >
      <div style={{ color: C.textHi }}>{label}</div>
      <div style={{ color: isNegative ? C.red : C.green, fontWeight: 600 }}>
        {typeof value === 'number' ? (value > 0 ? '+' : '') + value.toFixed(1) + '%' : value}
      </div>
    </div>
  )
}

export default function SummaryTab() {
  // Overall cohort stats
  const overallOrders = 17538
  const overallM3Rate = 0.312
  const overallM1Rate = 0.516
  const m1ToM3Drop = overallM1Rate - overallM3Rate

  // Domain type stats
  const cositeOrders = 13721
  const cositeM3Rate = 0.239
  const cositeM1Rate = 0.439
  const customOrders = 3817
  const customM3Rate = 0.576
  const customM1Rate = 0.793

  // Top features overall
  const topPositiveFeatures = [
    { feature: 'receive_w3', corr: 0.247, reach: 0.681 },
    { feature: 'read_w3', corr: 0.198, reach: 0.521 },
    { feature: 'receive_w4', corr: 0.167, reach: 0.679 },
    { feature: 'read_w4', corr: 0.145, reach: 0.501 },
    { feature: 'send_w2', corr: 0.089, reach: 0.423 },
    { feature: 'send_w4', corr: 0.078, reach: 0.391 },
  ]

  const topNegativeFeatures = [
    { feature: 'domain_type_co_site', corr: -0.307, reach: 0.782 },
    { feature: 'rate_limits_bounce', corr: -0.142, reach: 0.089 },
    { feature: 'neo_site_draft', corr: -0.098, reach: 0.156 },
    { feature: 'marketing_recipient_contacts', corr: -0.067, reach: 0.203 },
  ]

  // Plan-level top/bottom signals
  const planSignals: Record<string, { top: Array<{ feature: string; corr: number }>, bottom: Array<{ feature: string; corr: number }>, hypothesis: string }> = {
    pro: {
      top: [
        { feature: 'receive_w3', corr: 0.231 },
        { feature: 'read_w3', corr: 0.189 },
        { feature: 'receive_w4', corr: 0.156 },
        { feature: 'read_w4', corr: 0.134 },
        { feature: 'send_w2', corr: 0.082 },
      ],
      bottom: [
        { feature: 'domain_type_co_site', corr: -0.307 },
        { feature: 'rate_limits_bounce', corr: -0.128 },
        { feature: 'neo_site_draft', corr: -0.091 },
        { feature: 'marketing_recipient_contacts', corr: -0.064 },
      ],
      hypothesis: 'Pro users who renew show the same pattern as overall — sustained receive and read signals in weeks 3–4. The strongest churn predictor is being on co.site (−0.307). Pro is the base tier and overwhelmingly populated by co.site users, so structural churn dominates over behavioural churn.'
    },
    premium: {
      top: [
        { feature: 'read_w4', corr: 0.167 },
        { feature: 'receive_w4', corr: 0.159 },
        { feature: 'send_w3', corr: 0.143 },
        { feature: 'receive_w3', corr: 0.128 },
        { feature: 'send_w2', corr: 0.101 },
      ],
      bottom: [
        { feature: 'rate_limits_bounce', corr: -0.176 },
        { feature: 'neo_site_draft', corr: -0.134 },
        { feature: 'contact_group_usage', corr: -0.089 },
        { feature: 'domain_type_co_site', corr: -0.067 },
      ],
      hypothesis: 'Premium renewers show stronger inbox engagement by week 4 and the co.site structural signal weakens slightly. Churn in Premium is partly driven by rate_limits_bounce and neo_site_draft — users who hit sending limits or who built but never published their Neo site.'
    },
    ultra: {
      top: [
        { feature: 'read_w2', corr: 0.252 },
        { feature: 'receive_w2', corr: 0.201 },
        { feature: 'send_w1', corr: 0.167 },
        { feature: 'read_w3', corr: 0.149 },
        { feature: 'receive_w3', corr: 0.131 },
      ],
      bottom: [
        { feature: 'contact_group_usage', corr: -0.178 },
        { feature: 'marketing_custom_html', corr: -0.156 },
        { feature: 'rate_limits_bounce', corr: -0.103 },
        { feature: 'neo_site_draft', corr: -0.067 },
      ],
      hypothesis: 'Ultra renewing users are characterised by early reading habits — read_w2 is the top signal (+0.252). Churn is driven by contact group usage and custom HTML — the marketing-mailer segment is present in Ultra just as in Titan, but smaller.'
    },
  }

  // Neo site signals (hardcoded)
  const neoSiteSignals = {
    overall: {
      visitors_volume: 0.118,
      has_visitor: 0.085,
      published: 0.058,
      draft: -0.005,
    },
    cosite: {
      visitors_volume: 0.118,
      has_visitor: 0.085,
      published: 0.058,
      draft: 0.023,
    },
    custom: {
      visitors_volume: 0.036,
      has_visitor: 0.032,
      published: null,
      draft: -0.015,
    },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, color: C.textHi }}>
      {/* Section 1: Cohort Overview KPIs */}
      <section>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: C.textHi }}>
          Cohort Overview
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <KPICard label="Total Orders" value={overallOrders.toLocaleString()} />
          <KPICard label="M3 Renewal Rate" value={formatRate(overallM3Rate)} highlight />
          <KPICard label="M1 Received Rate" value={formatRate(overallM1Rate)} />
          <KPICard label="M1→M3 Drop" value={`-${(m1ToM3Drop * 100).toFixed(1)}%`} subtext="Cohort decline" />
        </div>
      </section>

      {/* Section 2: Top Feature Signals */}
      <section>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: C.textHi }}>
          Top Feature Signals
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6 }}>
            <div style={{ padding: 14, fontSize: 12, fontWeight: 600, color: C.accent, borderBottom: `1px solid ${C.border}` }}>
              Positive Drivers (Top 6)
            </div>
            {topPositiveFeatures.map(f => (
              <FeatureRow key={f.feature} feature={f.feature} correlation={f.corr} reach={f.reach} />
            ))}
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6 }}>
            <div style={{ padding: 14, fontSize: 12, fontWeight: 600, color: C.red, borderBottom: `1px solid ${C.border}` }}>
              Negative Drivers (Top 4)
            </div>
            {topNegativeFeatures.map(f => (
              <FeatureRow key={f.feature} feature={f.feature} correlation={f.corr} reach={f.reach} />
            ))}
          </div>
        </div>
      </section>

      {/* Section 3: How Signals Vary by Segment */}
      <section>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: C.textHi }}>
          How Signals Vary by Segment
        </div>

        {/* Domain Type Comparison */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            By Domain Type
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, marginBottom: 12 }}>Co.site</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.textHi, marginBottom: 4 }}>{formatRate(cositeM3Rate)}</div>
              <div style={{ fontSize: 11, color: C.sub }}>{cositeOrders.toLocaleString()} orders ({(cositeOrders / overallOrders * 100).toFixed(1)}%)</div>
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.green, marginBottom: 12 }}>Custom Domain</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.textHi, marginBottom: 4 }}>{formatRate(customM3Rate)}</div>
              <div style={{ fontSize: 11, color: C.sub }}>{customOrders.toLocaleString()} orders ({(customOrders / overallOrders * 100).toFixed(1)}%)</div>
            </div>
          </div>
        </div>

        {/* Plan Tier Signals */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            By Plan Tier
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {Object.entries(planSignals).map(([planName, signals]) => (
              <div key={planName} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 3, textTransform: 'capitalize' }}>
                  {planName} Plan
                </div>
                <div style={{ fontSize: 11, color: C.sub, marginBottom: 12 }}>{signals.hypothesis}</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.green, marginBottom: 8 }}>Top Signals</div>
                    {signals.top.map(s => (
                      <div key={s.feature} style={{ fontSize: 11, padding: '4px 0', color: C.textHi }}>
                        <span>{cleanFeatLabel(s.feature)}</span>
                        <span style={{ float: 'right', color: C.green, fontWeight: 600 }}>+{s.corr.toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.red, marginBottom: 8 }}>Bottom Signals</div>
                    {signals.bottom.map(s => (
                      <div key={s.feature} style={{ fontSize: 11, padding: '4px 0', color: C.textHi }}>
                        <span>{cleanFeatLabel(s.feature)}</span>
                        <span style={{ float: 'right', color: C.red, fontWeight: 600 }}>{s.corr.toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: Domain Type Overview */}
      <section>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: C.textHi }}>
          Domain Type Overview
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textHi, marginBottom: 12 }}>Co.site Users</div>
            <TableRow label="M3 Renewal Rate" value={(cositeM3Rate * 100).toFixed(1)} />
            <TableRow label="M1 Receive Rate" value={(cositeM1Rate * 100).toFixed(1)} />
            <TableRow label="Total Orders" value={cositeOrders.toLocaleString()} />
            <TableRow label="Cohort Share" value={(cositeOrders / overallOrders * 100).toFixed(1) + '%'} />
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textHi, marginBottom: 12 }}>Custom Domain Users</div>
            <TableRow label="M3 Renewal Rate" value={(customM3Rate * 100).toFixed(1)} />
            <TableRow label="M1 Receive Rate" value={(customM1Rate * 100).toFixed(1)} />
            <TableRow label="Total Orders" value={customOrders.toLocaleString()} />
            <TableRow label="Cohort Share" value={(customOrders / overallOrders * 100).toFixed(1) + '%'} />
          </div>
        </div>
      </section>

      {/* Section 5: Neo Site Signals */}
      <section>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: C.textHi }}>
          Neo Site Signals
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 12 }}>
              What Drives Renewal for Co.site Users
            </div>
            <div style={{ fontSize: 12, color: C.sub, marginBottom: 14, lineHeight: 1.5 }}>
              Site signals are strong renewal predictors for co.site users.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                <span style={{ color: C.textHi }}>Visitors Volume</span>
                <span style={{ color: C.green, fontWeight: 600 }}>+{neoSiteSignals.cosite.visitors_volume.toFixed(3)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                <span style={{ color: C.textHi }}>Has Visitor</span>
                <span style={{ color: C.green, fontWeight: 600 }}>+{neoSiteSignals.cosite.has_visitor.toFixed(3)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                <span style={{ color: C.textHi }}>Published Site</span>
                <span style={{ color: C.green, fontWeight: 600 }}>+{(neoSiteSignals.cosite.published ?? 0).toFixed(3)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                <span style={{ color: C.textHi }}>Draft Site</span>
                <span style={{ color: neoSiteSignals.cosite.draft > 0 ? C.green : C.red, fontWeight: 600 }}>
                  {neoSiteSignals.cosite.draft > 0 ? '+' : ''}{neoSiteSignals.cosite.draft.toFixed(3)}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, fontStyle: 'italic' }}>
              Getting a neo site live with real visitors is a strong retention signal for co.site users.
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 12 }}>
              What Drives Renewal for Custom Domain Users
            </div>
            <div style={{ fontSize: 12, color: C.sub, marginBottom: 14, lineHeight: 1.5 }}>
              Site signals are weaker; email habits dominate renewal decisions.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                <span style={{ color: C.textHi }}>Visitors Volume</span>
                <span style={{ color: C.green, fontWeight: 600 }}>+{(neoSiteSignals.custom.visitors_volume ?? 0).toFixed(3)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                <span style={{ color: C.textHi }}>Has Visitor</span>
                <span style={{ color: C.green, fontWeight: 600 }}>+{(neoSiteSignals.custom.has_visitor ?? 0).toFixed(3)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                <span style={{ color: C.textHi }}>Published Site</span>
                <span style={{ color: C.sub }}>—</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                <span style={{ color: C.textHi }}>Draft Site</span>
                <span style={{ color: C.red, fontWeight: 600 }}>{(neoSiteSignals.custom.draft ?? 0).toFixed(3)}</span>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, fontStyle: 'italic' }}>
              Email engagement patterns—receiving and reading—are the dominant renewal drivers.
            </div>
          </div>
        </div>
      </section>

      {/* Section 6: Signal Evolution M1→M3 */}
      <section>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: C.textHi }}>
          Signal Evolution: M1 → M3
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.green, marginBottom: 12 }}>Signals That Strengthened</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                <span style={{ color: C.textHi }}>read_w3</span>
                <span style={{ color: C.green, fontWeight: 600 }}>+0.038</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                <span style={{ color: C.textHi }}>receive_w4</span>
                <span style={{ color: C.green, fontWeight: 600 }}>+0.031</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                <span style={{ color: C.textHi }}>send_w2</span>
                <span style={{ color: C.green, fontWeight: 600 }}>+0.024</span>
              </div>
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.red, marginBottom: 12 }}>Signals That Faded</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                <span style={{ color: C.textHi }}>contact_group_usage</span>
                <span style={{ color: C.red, fontWeight: 600 }}>-0.042</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                <span style={{ color: C.textHi }}>marketing_custom_html</span>
                <span style={{ color: C.red, fontWeight: 600 }}>-0.031</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                <span style={{ color: C.textHi }}>rate_limits_bounce</span>
                <span style={{ color: C.red, fontWeight: 600 }}>-0.019</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 7: Domain Type Signals */}
      <section>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: C.textHi }}>
          Domain Type Signals
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, marginBottom: 12 }}>Co.site Top Features</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              {[
                { label: 'receive_w3', val: '+0.254' },
                { label: 'read_w3', val: '+0.201' },
                { label: 'receive_w4', val: '+0.173' },
                { label: 'read_w4', val: '+0.148' },
                { label: 'send_w2', val: '+0.092' },
              ].map(item => (
                <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                  <span style={{ color: C.textHi }}>{cleanFeatLabel(item.label)}</span>
                  <span style={{ color: C.green, fontWeight: 600 }}>{item.val}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.green, marginBottom: 12 }}>Custom Domain Top Features</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              {[
                { label: 'read_w2', val: '+0.289' },
                { label: 'send_w1', val: '+0.243' },
                { label: 'receive_w2', val: '+0.218' },
                { label: 'read_w3', val: '+0.167' },
                { label: 'send_w2', val: '+0.156' },
              ].map(item => (
                <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                  <span style={{ color: C.textHi }}>{cleanFeatLabel(item.label)}</span>
                  <span style={{ color: C.green, fontWeight: 600 }}>{item.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
