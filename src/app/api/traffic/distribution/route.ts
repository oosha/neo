import { NextRequest, NextResponse } from 'next/server'

// Using database_id 2 (Athena), table flockmail.neo_domain_aggregate_metrics
// init_plan_type = plan at time of order creation
// init_billing_cycle = billing cycle at time of order creation
// product_source: only 'mail' or NULL (exclude 'site' which is a different order type)

const PLAN_SQL = `
SELECT
  init_plan_type as plan_type,
  date_trunc('month', created_at) as month,
  count(distinct order_id) as orders
FROM flockmail.neo_domain_aggregate_metrics
WHERE (product_source != 'site' OR product_source IS NULL)
  AND created_at >= date '{{start_date}}'
  AND created_at < date '{{end_date}}'
GROUP BY 1, 2
ORDER BY 2 DESC, 3 DESC
`

const BILLING_SQL = `
SELECT
  init_billing_cycle as billing_cycle,
  date_trunc('month', created_at) as month,
  count(distinct order_id) as orders
FROM flockmail.neo_domain_aggregate_metrics
WHERE (product_source != 'site' OR product_source IS NULL)
  AND created_at >= date '{{start_date}}'
  AND created_at < date '{{end_date}}'
GROUP BY 1, 2
ORDER BY 2 DESC, 3 DESC
`

const GOOGLE_SOURCE_SQL = `
SELECT
  CASE
    WHEN regexp_like(utm_campaign, '(Search|SEM|Competitor|Zoho|CPA|CPC)') THEN 'Google SEM'
    WHEN regexp_like(utm_campaign, '^[0-9]+$') OR regexp_like(utm_campaign, '(PMax|pmax|DemandGen|DA_)') THEN 'Google PMax'
    ELSE 'Google Other'
  END as google_source,
  date_trunc('month', created_at) as month,
  count(distinct order_id) as orders
FROM flockmail.neo_domain_aggregate_metrics
WHERE utm_source = 'google'
  AND (product_source != 'site' OR product_source IS NULL)
  AND created_at >= date '{{start_date}}'
  AND created_at < date '{{end_date}}'
GROUP BY 1, 2
ORDER BY 2 DESC, 3 DESC
`

async function runSQL(query: string, startDate: string, endDate: string) {
  const METABASE_URL = process.env.METABASE_URL || ''
  const METABASE_API_KEY = process.env.METABASE_API_KEY || ''

  const res = await fetch(`${METABASE_URL}/api/dataset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': METABASE_API_KEY,
    },
    body: JSON.stringify({
      database: 2,
      type: 'native',
      native: {
        query: query.replace('{{start_date}}', startDate).replace('{{end_date}}', endDate),
      },
    }),
    next: { revalidate: 3600 },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Metabase SQL error ${res.status}: ${text}`)
  }

  const json = await res.json()
  const cols: { name: string }[] = json.data?.cols || []
  const rows: unknown[][] = json.data?.rows || []

  return rows.map(row =>
    Object.fromEntries(cols.map((col, i) => [col.name, row[i]])) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  )
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const startDate = sp.get('startDate') || '2025-07-01'
  const endDate = sp.get('endDate') || '2026-04-01'

  try {
    const [planRows, billingRows, googleRows] = await Promise.all([
      runSQL(PLAN_SQL, startDate, endDate),
      runSQL(BILLING_SQL, startDate, endDate),
      runSQL(GOOGLE_SOURCE_SQL, startDate, endDate),
    ])

    return NextResponse.json({ plan: planRows, billing: billingRows, google: googleRows })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
