// GET /api/find-user/pmf?account_ids=1,2,3&customer_id=456
// Fetches PMF feedback for a bundle's mailboxes + site-only customer PMF.
// Async — fired after main search result renders; does not block page load.
//
// account_ids: comma-separated list of mailbox account_ids (for mail PMF)
// customer_id: for site-only PMF responses with no linked mailbox
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

type PmfRow = {
  id: number; account_id: number | null; customer_id: number | null
  product: string; score: string | null; feedback_text: string | null
  submitted_at: string; tally_form_id: string | null
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const accountIdsParam = searchParams.get('account_ids') ?? ''
    const customerIdParam = Number(searchParams.get('customer_id') ?? 0)

    const accountIds = accountIdsParam.split(',').map(Number).filter(Boolean)

    if (!accountIds.length && !customerIdParam) {
      return NextResponse.json({ pmf: [] })
    }

    // Mail PMF (per mailbox account_id)
    let mailRows: PmfRow[] = []
    if (accountIds.length) {
      try {
        const result = await sql<PmfRow>`
          SELECT id, account_id, customer_id, product, score, feedback_text, submitted_at, tally_form_id
          FROM neo_pmf_feedback
          WHERE account_id = ANY(${accountIds})
          ORDER BY submitted_at DESC
          LIMIT 50
        `
        mailRows = result.rows
      } catch (err) {
        console.error('PMF mail query error (table may not exist yet):', err)
      }
    }

    // Site PMF (per customer — for site-only users or cross-bundle PMF)
    let siteRows: PmfRow[] = []
    if (customerIdParam) {
      try {
        const result = await sql<PmfRow>`
          SELECT id, account_id, customer_id, product, score, feedback_text, submitted_at, tally_form_id
          FROM neo_pmf_feedback
          WHERE customer_id = ${customerIdParam}
            AND product = 'site'
          ORDER BY submitted_at DESC
          LIMIT 50
        `
        siteRows = result.rows
      } catch (err) {
        console.error('PMF site query error (table may not exist yet):', err)
      }
    }

    return NextResponse.json({ pmf: [...mailRows, ...siteRows] })

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
