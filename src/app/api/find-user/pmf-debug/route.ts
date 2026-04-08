// GET /api/find-user/pmf-debug
// Returns recent PMF records and table stats — for diagnosing missing data.
// No auth guard; remove or restrict once debugging is done.
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [countResult, recentResult] = await Promise.all([
      sql`SELECT COUNT(*) AS total FROM neo_pmf_feedback`,
      sql`
        SELECT id, account_id, customer_id, email, product, score,
               LEFT(feedback_text, 80) AS feedback_preview,
               submitted_at, tally_form_id
        FROM neo_pmf_feedback
        ORDER BY submitted_at DESC
        LIMIT 20
      `,
    ])

    return NextResponse.json({
      total: Number(countResult.rows[0]?.total ?? 0),
      recent: recentResult.rows,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
