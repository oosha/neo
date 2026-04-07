const METABASE_URL = process.env.METABASE_URL || ''
const METABASE_API_KEY = process.env.METABASE_API_KEY || ''

// ── Raw SQL via Metabase /api/dataset ─────────────────────────────────────────

function metabaseResultToRows(
  json: { data?: { cols?: Array<{ name: string }>; rows?: unknown[][] }; error?: string }
): Record<string, unknown>[] {
  if (json.error) throw new Error(`Metabase query error: ${json.error}`)
  const cols = json?.data?.cols?.map((c) => c.name) ?? []
  const rows = json?.data?.rows ?? []
  return rows.map((row) => {
    const obj: Record<string, unknown> = {}
    cols.forEach((col, i) => { obj[col] = (row as unknown[])[i] })
    return obj
  })
}

export async function runQuery(
  databaseId: number,
  query: string
): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${METABASE_URL}/api/dataset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': METABASE_API_KEY },
    body: JSON.stringify({
      database: databaseId,
      type: 'native',
      native: { query, 'template-tags': {} },
    }),
  })
  if (!res.ok) throw new Error(`Metabase query failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  if (json.error) throw new Error(`Metabase query error: ${json.error}`)
  return metabaseResultToRows(json)
}

interface MetabaseCardParam {
  id: string
  slug: string
  target: [string, [string, string]]
  type: string
  value: string
}

interface MetabaseRow {
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

export async function executeCard(
  cardId: number,
  parameters: MetabaseCardParam[] = []
): Promise<MetabaseRow[]> {
  const res = await fetch(`${METABASE_URL}/api/card/${cardId}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': METABASE_API_KEY,
    },
    body: JSON.stringify({ parameters }),
    next: { revalidate: 3600 }, // cache for 1 hour
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Metabase API error ${res.status}: ${text}`)
  }

  const json = await res.json()
  const cols: { name: string }[] = json.data?.cols || []
  const rows: unknown[][] = json.data?.rows || []

  return rows.map(row =>
    Object.fromEntries(cols.map((col, i) => [col.name, row[i]])) as MetabaseRow
  )
}

// Card 10397 parameter builders
export function buildFunnelParams(filters: {
  startDate?: string
  endDate?: string
  utmSource?: string
  device?: string
  country?: string
  neoOffering?: string
}): MetabaseCardParam[] {
  const params: MetabaseCardParam[] = []

  if (filters.startDate) {
    params.push({
      id: '79140083-9cd7-4cfd-a883-5e244b410b61',
      slug: 'start_date',
      target: ['variable', ['template-tag', 'start_date']],
      type: 'date/single',
      value: filters.startDate,
    })
  }
  if (filters.endDate) {
    params.push({
      id: 'ccfb77e5-c147-44bb-8644-5ffe1fe98117',
      slug: 'end_date',
      target: ['variable', ['template-tag', 'end_date']],
      type: 'date/single',
      value: filters.endDate,
    })
  }
  if (filters.utmSource) {
    params.push({
      id: '810eba50-abed-427a-8639-b1538a90ed11',
      slug: 'utm_source',
      target: ['dimension', ['template-tag', 'utm_source']],
      type: 'string/=',
      value: filters.utmSource,
    })
  }
  if (filters.device) {
    params.push({
      id: 'fdd14ba5-23e4-4c6b-9645-64ddf11d89f2',
      slug: 'device',
      target: ['dimension', ['template-tag', 'device']],
      type: 'string/=',
      value: filters.device,
    })
  }
  if (filters.country) {
    params.push({
      id: 'f53b638e-beb5-4526-ae5b-fbd3c67b91a4',
      slug: 'country',
      target: ['dimension', ['template-tag', 'country']],
      type: 'string/=',
      value: filters.country,
    })
  }
  if (filters.neoOffering) {
    params.push({
      id: '5791da66-c467-44a4-a0b1-823b59e35e99',
      slug: 'neo_offering',
      target: ['variable', ['template-tag', 'neo_offering']],
      type: 'category',
      value: filters.neoOffering,
    })
  }

  return params
}

// Card 10724 parameter builders
export function buildHealthParams(filters: {
  startDate?: string
  endDate?: string
  neoOffering?: string
}): MetabaseCardParam[] {
  const params: MetabaseCardParam[] = []

  if (filters.startDate) {
    params.push({
      id: '75159fe0-f046-4850-a62a-58e750d8a82a',
      slug: 'start_date',
      target: ['variable', ['template-tag', 'start_date']],
      type: 'date/single',
      value: filters.startDate,
    })
  }
  if (filters.endDate) {
    params.push({
      id: '04642486-2733-4a5c-b549-f45ec627dc8b',
      slug: 'end_date',
      target: ['variable', ['template-tag', 'end_date']],
      type: 'date/single',
      value: filters.endDate,
    })
  }
  if (filters.neoOffering) {
    params.push({
      id: 'dcd97db7-8cd6-48e2-b686-6233e203d0d4',
      slug: 'neo_offering1',
      target: ['dimension', ['template-tag', 'neo_offering1']],
      type: 'string/=',
      value: filters.neoOffering,
    })
  }

  return params
}
