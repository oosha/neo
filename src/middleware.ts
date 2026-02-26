import { NextRequest, NextResponse } from 'next/server'

const TOKEN_COOKIE = 'neo_dash_auth'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Always allow Next.js internals and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api')
  ) {
    return NextResponse.next()
  }

  const expectedToken = process.env.DASHBOARD_TOKEN
  if (!expectedToken) {
    // If env var not set, deny everything to fail safe
    return accessDenied()
  }

  // 1. Valid auth cookie present → allow through
  const cookie = request.cookies.get(TOKEN_COOKIE)
  if (cookie?.value === expectedToken) {
    return NextResponse.next()
  }

  // 2. Token in query string → allow through directly (no redirect)
  //    This supports iframe embeds where third-party cookies are blocked by
  //    modern browsers — the token stays in the URL on every load instead.
  //    Also set the cookie so direct browser visits work without the token next time.
  const queryToken = searchParams.get('token')
  if (queryToken === expectedToken) {
    const response = NextResponse.next()
    response.cookies.set(TOKEN_COOKIE, expectedToken, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    })
    return response
  }

  // 3. Nothing valid → access denied
  return accessDenied()
}

function accessDenied() {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Access Restricted</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f9fafb;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: #111827;
    }
    .card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 48px 40px;
      text-align: center;
      max-width: 380px;
      width: 90%;
    }
    .icon { font-size: 40px; margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
    p { font-size: 14px; color: #6b7280; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔒</div>
    <h1>Access Restricted</h1>
    <p>This dashboard is private.<br/>Access it via the Neo Wiki Confluence page.</p>
  </div>
</body>
</html>`,
    {
      status: 403,
      headers: { 'Content-Type': 'text/html' },
    }
  )
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
