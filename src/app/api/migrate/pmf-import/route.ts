// GET /api/migrate/pmf-import
// One-time bulk import of all historical Tally PMF responses into neo_pmf_feedback.
// Uses the Tally REST API to paginate through all responses for both forms.
//
// Env vars required:
//   TALLY_API_KEY      — Bearer token from Tally → Account → API
//   TALLY_FORM_ID_MAIL — wgdvNl (default)
//   TALLY_FORM_ID_SITE — 3jzl9R (default)

import { NextResponse } from 'next/server'
import { sql }          from '@/lib/db'

const FORM_ID_MAIL = process.env.TALLY_FORM_ID_MAIL ?? 'wgdvNl'
const FORM_ID_SITE = process.env.TALLY_FORM_ID_SITE ?? '3jzl9R'
const API_KEY      = process.env.TALLY_API_KEY

interface TallyField {
  key:      string
  label:    string
  type:     string
  value:    unknown
  options?: { id: string; text: string }[]
}

interface TallyResponse {
  id:        string
  timestamp: string
  fields:    TallyField[]
}

interface TallyPage {
  page:     number
  limit:    number
  hasMore:  boolean
  responses: TallyResponse[]
}

function normaliseScore(raw: string): string {
  const s = String(raw ?? '').toLowerCase().replace(/\s+/g, '_')
  if (s.includes('very_disappoint') || s.includes('very disappoint')) return 'very_disappointed'
  if (s.includes('somewhat')        || s.includes('a_bit'))           return 'somewhat_disappointed'
  if (s.includes('not_disappoint')  || s.includes('not disappoint'))  return 'not_disappointed'
  return s
}

function extractValue(fields: TallyField[], ...labelKeywords: string[]): string | null {
  for (const f of fields) {
    const lowerLabel = f.label?.toLowerCase() ?? ''
    const lowerKey   = f.key?.toLowerCase()   ?? ''
    if (labelKeywords.some(kw => lowerLabel.includes(kw) || lowerKey.includes(kw))) {
      const raw = Array.isArray(f.value) ? f.value[0] : f.value
      if (!raw) return null
      if (f.options?.length) {
        const match = f.options.find(o => o.id === raw)
        return match ? match.text.trim() : String(raw).trim()
      }
      return String(raw).trim()
    }
  }
  return null
}

function extractEmail(fields: TallyField[]): string | null {
  const f = fields.find(f =>
    f.type === 'EMAIL' ||
    f.key?.toLowerCase()   === 'email' ||
    f.label?.toLowerCase() === 'email'
  )
  if (!f) return null
  const v = Array.isArray(f.value) ? f.value[0] : f.value
  return v ? String(v).trim() || null : null
}

async function fetchAllResponses(formId: string): Promise<TallyResponse[]> {
  const all: TallyResponse[] = []
  let page = 1

  while (true) {
    const url = `https://api.tally.so/forms/${formId}/responses?page=${page}&limit=200`
    const res  = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Tally API error for form ${formId} page ${page}: ${res.status} ${text}`)
    }
    const data: TallyPage = await res.json()
    all.push(...(data.responses ?? []))
    if (!data.hasMore) break
    page++
  }

  return all
}

function parseResponse(formId: string, product: string, r: TallyResponse) {
  const { id: responseId, timestamp, fields } = r

  const accountIdRaw  = extractValue(fields, 'account_id')
  const customerIdRaw = extractValue(fields, 'customer_id')
  const accountId     = accountIdRaw  ? Number(accountIdRaw)  : null
  const customerId    = customerIdRaw ? Number(customerIdRaw) : null
  const email         = extractEmail(fields)

  const scoreRaw = extractValue(fields, 'feel', 'disappoint', 'score', 'rating')
  const score    = scoreRaw ? normaliseScore(scoreRaw) : null

  const feedbackParts: string[] = []
  for (const f of fields) {
    if (['INPUT_TEXT', 'TEXTAREA', 'TEXT'].includes(f.type) && f.value) {
      const v = Array.isArray(f.value) ? (f.value as string[]).join(' ') : String(f.value)
      if (v.trim()) feedbackParts.push(`[${f.label}] ${v.trim()}`)
    }
  }
  const feedbackText = feedbackParts.join('\n') || null
  const submittedAt  = timestamp ? new Date(timestamp) : new Date()

  return { accountId, customerId, email, product, score, feedbackText, submittedAt, formId, responseId }
}

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json({ error: 'TALLY_API_KEY env var not set' }, { status: 500 })
  }

  try {
    const results = { mail: 0, site: 0, skipped: 0, errors: [] as string[] }

    const forms: Array<{ formId: string; product: string }> = [
      { formId: FORM_ID_MAIL, product: 'mail' },
      { formId: FORM_ID_SITE, product: 'site' },
    ]

    for (const { formId, product } of forms) {
      const responses = await fetchAllResponses(formId)

      for (const r of responses) {
        try {
          const row = parseResponse(formId, product, r)
          await sql`
            INSERT INTO neo_pmf_feedback
              (account_id, customer_id, email, product, score, feedback_text,
               submitted_at, tally_form_id, tally_response_id)
            VALUES
              (${row.accountId}, ${row.customerId}, ${row.email}, ${row.product},
               ${row.score}, ${row.feedbackText}, ${row.submittedAt},
               ${row.formId}, ${row.responseId})
            ON CONFLICT (tally_response_id) DO UPDATE SET
              email         = COALESCE(EXCLUDED.email, neo_pmf_feedback.email),
              score         = COALESCE(EXCLUDED.score, neo_pmf_feedback.score),
              feedback_text = COALESCE(EXCLUDED.feedback_text, neo_pmf_feedback.feedback_text)
          `
          if (product === 'mail') { results.mail++ } else { results.site++ }
        } catch (e) {
          results.errors.push(`${r.id}: ${String(e)}`)
          results.skipped++
        }
      }
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (err) {
    console.error('PMF import error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
