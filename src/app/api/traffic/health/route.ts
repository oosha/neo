import { NextRequest, NextResponse } from 'next/server'
import { executeCard, buildHealthParams } from '@/lib/metabase'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams

  try {
    const params = buildHealthParams({
      startDate: sp.get('startDate') || undefined,
      endDate: sp.get('endDate') || undefined,
      neoOffering: sp.get('neoOffering') || undefined,
    })

    const rows = await executeCard(10724, params)
    return NextResponse.json({ data: rows })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
