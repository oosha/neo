// POST /api/webhooks/tally-pmf
// Receives Tally form webhook responses for Neo Mail PMF and Neo Site PMF.
// Upserts responses into Neon `neo_pmf_feedback`.
//
// Env vars required:
//   TALLY_SIGNING_SECRET   — from Tally webhook settings (for HMAC-SHA256 verification)
//   TALLY_FORM_ID_MAIL     — wgdvNl
//   TALLY_FORM_ID_SITE     — 3jzl9R
//
// Tally form hidden fields expected:
//   account_id   — mailbox account_id (mail PMF)
//   customer_id  — customer_id (site PMF, or fallback)
//
// PMF score field: MULTIPLE_CHOICE with options mapped below.

import { NextResponse } from 'next/server'
import { createHmac }   from 'crypto'
import { sql }          from '@/lib/db'

const FORM_ID_MAIL = process.env.TALLY_FORM_ID_MAIL ?? 'wgdvNl'
const FORM_ID_SITE = process.env.TALLY_FORM_ID_SITE ?? '3jzl9R'

// Normalise free-text or option-label PMF score values
function normaliseScore(raw: string): string {
  const s = String(raw ?? '').toLowerCase().replace(/\s+/g, '_')
  if (s.includes('very_disappoint') || s.includes('very disappoint')) return 'very_disappointed'
  if (s.includes('somewhat')        || s.includes('a_bit'))          return 'somewhat_disappointed'
  if (s.includes('not_disappoint')  || s.includes('not disappoint')) return 'not_disappointed'
  return s  // store as-is if unrecognised
}

// Verify Tally HMAC-SHA256 signature
function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.TALLY_SIGNING_SECRET
  if (!secret || !signature) return !secret  // if no secret configured, skip verification
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  return expected === signature
}

interface TallyField {
  key:   string
  label: string
  type:  string
  value: string | string[] | null
}

interface TallyPayload {
  eventId:   string
  eventType: string
  data: {
    responseId:   string
    submissionId: string
    formId:       string
    formName:     string
    createdAt:    string
    fields:       TallyField[]
  }
}

function extractValue(fields: TallyField[], ...labelKeywords: string[]): string | null {
  for (const f of fields) {
    const lowerLabel = f.label.toLowerCase()
    const lowerKey   = f.key.toLowerCase()
    if (labelKeywords.some(kw => lowerLabel.includes(kw) || lowerKey.includes(kw))) {
      const v = Array.isArray(f.value) ? f.value[0] : f.value
      return v ? String(v).trim() : null
    }
  }
  return null
}

export async function POST(req: Request) {
  try {
    const rawBody  = await req.text()
    const signature = req.headers.get('tally-signature')

    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload: TallyPayload = JSON.parse(rawBody)
    if (payload.eventType !== 'FORM_RESPONSE') {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const { formId, responseId, createdAt, fields } = payload.data

    // Determine product from form ID
    const product = formId === FORM_ID_MAIL ? 'mail'
                  : formId === FORM_ID_SITE ? 'site'
                  : null
    if (!product) {
      return NextResponse.json({ error: `Unknown form ID: ${formId}` }, { status: 400 })
    }

    // Extract identifiers from hidden fields
    const accountIdRaw  = extractValue(fields, 'account_id')
    const customerIdRaw = extractValue(fields, 'customer_id')
    const accountId     = accountIdRaw  ? Number(accountIdRaw)  : null
    const customerId    = customerIdRaw ? Number(customerIdRaw) : null

    // Extract email — from EMAIL type field or a field labelled/keyed 'email'
    const emailRaw = fields.find((f: TallyField) =>
      f.type === 'EMAIL' || f.key?.toLowerCase() === 'email' || f.label?.toLowerCase() === 'email'
    )?.value ?? null
    const email = emailRaw ? String(Array.isArray(emailRaw) ? emailRaw[0] : emailRaw).trim() || null : null

    // Extract PMF score — look for "feel" or "disappoint" or multiple choice question
    const scoreRaw = extractValue(fields, 'feel', 'disappoint', 'score', 'rating')
    const score    = scoreRaw ? normaliseScore(scoreRaw) : null

    // Extract free-text feedback (open-ended questions)
    const feedbackParts: string[] = []
    for (const f of fields) {
      if (['INPUT_TEXT', 'TEXTAREA', 'TEXT'].includes(f.type) && f.value) {
        const v = Array.isArray(f.value) ? f.value.join(' ') : String(f.value)
        if (v.trim()) feedbackParts.push(`[${f.label}] ${v.trim()}`)
      }
    }
    const feedbackText = feedbackParts.join('\n') || null

    // Upsert into Neon — update email on re-delivery in case it was missing first time
    await sql`
      INSERT INTO neo_pmf_feedback
        (account_id, customer_id, email, product, score, feedback_text, submitted_at, tally_form_id, tally_response_id)
      VALUES
        (${accountId}, ${customerId}, ${email}, ${product}, ${score}, ${feedbackText},
         ${createdAt ? new Date(createdAt) : new Date()}, ${formId}, ${responseId})
      ON CONFLICT (tally_response_id) DO UPDATE SET email = EXCLUDED.email
    `

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Tally PMF webhook error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
