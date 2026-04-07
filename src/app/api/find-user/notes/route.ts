// GET  /api/find-user/notes?bundle_id=xxx  — fetch note
// POST /api/find-user/notes               — upsert note { bundle_id, note }
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const bundleId = Number(searchParams.get('bundle_id'))
  if (!bundleId) return NextResponse.json({ error: 'Missing bundle_id' }, { status: 400 })

  const result = await sql<{ note: string; updated_at: string }>`
    SELECT note, updated_at FROM neo_user_notes WHERE bundle_id = ${bundleId}
  `
  return NextResponse.json({
    note:       result.rows[0]?.note       ?? '',
    updated_at: result.rows[0]?.updated_at ?? null,
  })
}

export async function POST(req: Request) {
  const { bundle_id, note } = await req.json()
  if (!bundle_id) return NextResponse.json({ error: 'Missing bundle_id' }, { status: 400 })

  await sql`
    INSERT INTO neo_user_notes (bundle_id, note, updated_at)
    VALUES (${bundle_id}, ${note ?? ''}, NOW())
    ON CONFLICT (bundle_id) DO UPDATE SET
      note       = EXCLUDED.note,
      updated_at = NOW()
  `
  return NextResponse.json({ ok: true })
}
