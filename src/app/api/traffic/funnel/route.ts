import { NextRequest, NextResponse } from 'next/server'
import { executeCard, buildFunnelParams } from '@/lib/metabase'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams

  try {
    const params = buildFunnelParams({
      startDate: sp.get('startDate') || undefined,
      endDate: sp.get('endDate') || undefined,
      utmSource: sp.get('utmSource') || undefined,
      device: sp.get('device') || undefined,
      country: sp.get('country') || undefined,
      neoOffering: sp.get('neoOffering') || undefined,
    })

    const rows = await executeCard(10397, params)
    return NextResponse.json({ data: rows })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
