// GET /api/find-user/canny?emails=email1,email2,...
// Fetches Canny posts (created/voted/commented) for a list of mailbox emails.
// Async — fired after main search result renders; does not block page load.
import { NextResponse } from 'next/server'

const CANNY_API = 'https://canny.io/api/v1'
const API_KEY   = process.env.CANNY_API_KEY!

async function cannyPost(path: string, body: Record<string, string | number>) {
  const res = await fetch(`${CANNY_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: API_KEY, ...body }),
  })
  if (!res.ok) throw new Error(`Canny ${path} failed: ${res.status}`)
  return res.json()
}

export interface CannyAction {
  type: 'created' | 'voted' | 'commented'
  email: string
  date: string
  comment?: string
}

export interface CannyPost {
  id: string
  title: string
  details: string | null
  score: number
  board: string
  status: string
  url: string | null
  actions: CannyAction[]
}

function toDate(ts: string | number | null | undefined): string {
  if (!ts) return ''
  const d = new Date(typeof ts === 'number' ? ts * 1000 : ts)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const emailsParam = searchParams.get('emails') ?? ''
    const emails = emailsParam.split(',').map(e => e.trim()).filter(Boolean)
    if (!emails.length) return NextResponse.json({ posts: [] })

    const postMap = new Map<string, CannyPost>()

    const upsertPost = (raw: Record<string, unknown>): CannyPost => {
      const id = String(raw.id ?? '')
      if (!postMap.has(id)) {
        const board = raw.board as Record<string, unknown> | null
        postMap.set(id, {
          id,
          title:   String(raw.title   ?? ''),
          details: raw.details ? String(raw.details) : null,
          score:   Number(raw.score   ?? 0),
          board:   board ? String(board.name ?? '') : '',
          status:  String(raw.status  ?? ''),
          url:     raw.url ? String(raw.url) : null,
          actions: [],
        })
      }
      return postMap.get(id)!
    }

    await Promise.all(emails.map(async (email) => {
      let user: Record<string, unknown>
      try {
        user = await cannyPost('/users/retrieve', { email })
      } catch { return }
      if (!user || user.error) return
      const userId = String(user.id ?? '')
      if (!userId) return

      const [postsRes, votesRes, commentsRes] = await Promise.allSettled([
        cannyPost('/posts/list',    { authorID: userId, limit: 100 }),
        cannyPost('/votes/list',    { userID:   userId, limit: 100 }),
        cannyPost('/comments/list', { authorID: userId, limit: 100 }),
      ])

      if (postsRes.status === 'fulfilled') {
        for (const p of (postsRes.value?.posts ?? []) as Record<string, unknown>[]) {
          upsertPost(p).actions.push({ type: 'created', email, date: toDate(p.created as string) })
        }
      }
      if (votesRes.status === 'fulfilled') {
        for (const v of (votesRes.value?.votes ?? []) as Record<string, unknown>[]) {
          const rawPost = v.post as Record<string, unknown> | null
          if (rawPost) upsertPost(rawPost).actions.push({ type: 'voted', email, date: toDate(v.created as string) })
        }
      }
      if (commentsRes.status === 'fulfilled') {
        for (const c of (commentsRes.value?.comments ?? []) as Record<string, unknown>[]) {
          const rawPost = c.post as Record<string, unknown> | null
          if (rawPost) upsertPost(rawPost).actions.push({
            type: 'commented', email,
            date: toDate(c.created as string),
            comment: c.value ? String(c.value) : undefined,
          })
        }
      }
    }))

    const posts = Array.from(postMap.values())
    posts.sort((a, b) => {
      const aDate = a.actions.map(x => x.date).sort().reverse()[0] ?? ''
      const bDate = b.actions.map(x => x.date).sort().reverse()[0] ?? ''
      return bDate.localeCompare(aDate)
    })

    return NextResponse.json({ posts })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
