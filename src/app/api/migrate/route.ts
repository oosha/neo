// GET /api/migrate — create Neo Neon DB tables
// Guarded by ALLOW_MIGRATE=true in Vercel env
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS neo_user_notes (
    bundle_id  BIGINT PRIMARY KEY,
    note       TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS neo_pmf_feedback (
    id                SERIAL PRIMARY KEY,
    account_id        BIGINT,
    customer_id       BIGINT,
    email             TEXT,
    product           TEXT,
    score             TEXT,
    feedback_text     TEXT,
    submitted_at      TIMESTAMPTZ,
    tally_form_id     TEXT,
    tally_response_id TEXT UNIQUE
  )`,
  `CREATE INDEX IF NOT EXISTS neo_pmf_feedback_account_id  ON neo_pmf_feedback(account_id)`,
  `CREATE INDEX IF NOT EXISTS neo_pmf_feedback_customer_id ON neo_pmf_feedback(customer_id)`,
  `CREATE INDEX IF NOT EXISTS neo_pmf_feedback_product     ON neo_pmf_feedback(product)`,
  `ALTER TABLE neo_pmf_feedback ADD COLUMN IF NOT EXISTS email TEXT`,
  `CREATE INDEX IF NOT EXISTS neo_pmf_feedback_email ON neo_pmf_feedback(email)`,
]

export async function GET() {
  if (process.env.ALLOW_MIGRATE !== 'true') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  let succeeded = 0
  const warnings: string[] = []

  for (const statement of STATEMENTS) {
    try {
      await sql.query(statement)
      succeeded++
    } catch (err) {
      warnings.push(`WARN: ${statement.slice(0, 80).replace(/\s+/g, ' ')} — ${String(err).split('\n')[0]}`)
    }
  }

  return NextResponse.json({ ok: true, statements: STATEMENTS.length, succeeded, warnings })
}
