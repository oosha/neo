// POST /api/find-user/search
// Body: { type: 'domain'|'email'|'bundle_id'|'order_id'|'customer_id'|'account_id', value: string }
import { NextResponse } from 'next/server'
import { runQuery } from '@/lib/metabase'
import { sql } from '@/lib/db'

const DB = 2

function san(s: string) {
  return s.replace(/'/g, "''").replace(/;/g, '').trim()
}

// ── Column lists ──────────────────────────────────────────────────────────────

const BUNDLE_COLS = `
  bundle_id, domain_name, created_at, neo_offering, customer_id, customer_email,
  business_industry, company_name, employee_count, is_card_saved,
  product_source, role_in_business, signup_device, signup_reason, status,
  mail_order_status, site_order_status,
  utm_source, utm_campaign, utm_content, utm_medium, utm_term,
  promo_code, country, billing_cycle, is_paid,
  mail_order_id, site_order_id, neo_domain_order_id,
  mail_plan_type, site_plan_type, neo_domain_plan,
  order_count, active_order_count, paid_order_count,
  neo_site_status, first_site_publish_dt, suspend_date, delete_date
`.trim()

const MAIL_ORDER_COLS = `
  order_id, bundle_id, domain_name, created_at, expiry_date, delete_date, suspend_date,
  suspension_reason, customer_id, domain_type, catch_all_enabled, country, country_code,
  has_sent_read_overall, has_sent_read_last_90d, has_sent_read_last_30d, has_sent_read_last_7d,
  first_read_sent_date, neo_client_first_read_sent_date, neo_client_first_sent_dt,
  neo_client_total_mails_sent, mailbox_count, active_mailbox_count,
  status, billing_cycle, init_billing_cycle, plan_type, init_plan_type,
  first_payment_plan_type, plan_name, neo_offering,
  is_mx_verified, setup_type, mx_verified_ts, is_domain_ownership_verified, dom_ownership_verified_ts,
  first_sent_dt, total_mails_sent, first_payment_date, is_auto_renew_on
`.trim()

const SITE_ORDER_COLS = `
  order_id, bundle_id, domain_name, created_at, expiry_date,
  status, billing_cycle, init_billing_cycle, plan_type, init_plan_type,
  neo_site_status, neo_site_state, neo_offering, product_source, product_theme,
  first_site_publish_dt, a_verified, a_verified_ts, www_cname_verified, www_cname_verified_ts,
  first_payment_date, renewals, trial_expiry_date, suspend_date, delete_date
`.trim()

const DOMAIN_ORDER_COLS = `
  order_id, domain_name, status, plan_type, init_plan_type,
  billing_cycle, neo_offering, created_at, expiry_date,
  first_payment_date, trial_expiry_date, suspend_date, delete_date
`.trim()

const MBX_COLS = `
  account_id, email, order_id, domain_name, customer_id, customer_name,
  created_at, dom_plan_type, dom_init_plan_type, dom_plan_name,
  is_admin, status, dom_status, size_used, domain_type,
  has_sent_read_overall, has_sent_read_last_90d, has_sent_read_last_30d, has_sent_read_last_7d,
  delete_date, suspend_date, suspension_reason, dom_billing_cycle,
  is_generic_lhs, country, country_code, neo_offering,
  name, first_name, last_name, referral_code, referred_invitee_count, referral_reward_earned
`.trim()

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const { type, value } = await req.json()
    if (!type || !value) {
      return NextResponse.json({ error: 'Missing type or value' }, { status: 400 })
    }

    // ── Step 1: Resolve search to bundle_id(s) + customer_id ─────────────────

    let resolvedBundleIds: number[] = []
    let customerId: number | null = null

    if (type === 'bundle_id') {
      const id = Number(value)
      if (!id) return NextResponse.json({ error: 'Invalid bundle ID' }, { status: 400 })
      resolvedBundleIds = [id]

    } else if (type === 'customer_id') {
      customerId = Number(value)
      if (!customerId) return NextResponse.json({ error: 'Invalid customer ID' }, { status: 400 })
      const rows = await runQuery(DB,
        `SELECT bundle_id FROM flockmail.neo_bundle_aggregate_metrics
         WHERE customer_id = ${customerId} ORDER BY created_at DESC`)
      resolvedBundleIds = rows.map(r => Number(r.bundle_id)).filter(Boolean)
      if (!resolvedBundleIds.length) return NextResponse.json({ error: `No bundles found for customer: ${value}` }, { status: 404 })

    } else if (type === 'domain') {
      const rows = await runQuery(DB,
        `SELECT bundle_id, customer_id FROM flockmail.neo_bundle_aggregate_metrics
         WHERE LOWER(domain_name) = LOWER('${san(value)}') LIMIT 1`)
      if (!rows[0]) return NextResponse.json({ error: `Domain not found: ${value}` }, { status: 404 })
      resolvedBundleIds = [Number(rows[0].bundle_id)]
      customerId = Number(rows[0].customer_id) || null

    } else if (type === 'email') {
      // mailbox → mail order → bundle
      const rows = await runQuery(DB,
        `SELECT m.account_id, d.bundle_id, d.customer_id
         FROM flockmail.neo_mailbox_aggregate_metrics m
         JOIN flockmail.neo_domain_aggregate_metrics d ON d.order_id = m.order_id
         WHERE LOWER(m.email) = LOWER('${san(value)}') LIMIT 1`)
      if (!rows[0]) return NextResponse.json({ error: `Email not found: ${value}` }, { status: 404 })
      resolvedBundleIds = [Number(rows[0].bundle_id)]
      customerId = Number(rows[0].customer_id) || null

    } else if (type === 'account_id') {
      const accountId = Number(value)
      if (!accountId) return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 })
      const rows = await runQuery(DB,
        `SELECT d.bundle_id, d.customer_id
         FROM flockmail.neo_mailbox_aggregate_metrics m
         JOIN flockmail.neo_domain_aggregate_metrics d ON d.order_id = m.order_id
         WHERE m.account_id = ${accountId} LIMIT 1`)
      if (!rows[0]) return NextResponse.json({ error: `Account not found: ${value}` }, { status: 404 })
      resolvedBundleIds = [Number(rows[0].bundle_id)]
      customerId = Number(rows[0].customer_id) || null

    } else if (type === 'order_id') {
      const orderId = Number(value)
      if (!orderId) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
      // Try mail order first, then site order
      const [mailRows, siteRows] = await Promise.all([
        runQuery(DB,
          `SELECT bundle_id, customer_id FROM flockmail.neo_domain_aggregate_metrics
           WHERE order_id = ${orderId} LIMIT 1`),
        runQuery(DB,
          `SELECT bundle_id, customer_id FROM flockmail.neo_site_order_aggregate_metrics
           WHERE order_id = ${orderId} LIMIT 1`),
      ])
      const row = mailRows[0] ?? siteRows[0]
      if (!row) return NextResponse.json({ error: `Order not found: ${value}` }, { status: 404 })
      resolvedBundleIds = [Number(row.bundle_id)]
      customerId = Number(row.customer_id) || null

    } else {
      return NextResponse.json({ error: 'Invalid search type' }, { status: 400 })
    }

    const bundleIdsStr = resolvedBundleIds.join(',')

    // ── Step 2: Fetch bundles + customer in parallel ──────────────────────────

    const [bundleRows, customerRows] = await Promise.all([
      runQuery(DB,
        `SELECT ${BUNDLE_COLS}
         FROM flockmail.neo_bundle_aggregate_metrics
         WHERE bundle_id IN (${bundleIdsStr})`),
      customerId
        ? runQuery(DB,
            `SELECT customer_id, customer_name, customer_email, company_name,
                    order_count, active_order_count, paid_order_count,
                    product_source, country, city, state, created_at
             FROM flockmail.neo_customer_aggregate_metrics
             WHERE customer_id = ${customerId} LIMIT 1`)
        : Promise.resolve([]),
    ])

    if (!bundleRows.length) {
      return NextResponse.json({ error: `Bundle not found: ${resolvedBundleIds.join(', ')}` }, { status: 404 })
    }

    // Derive customer_id from bundle data if not yet set
    if (!customerId && bundleRows[0]) {
      customerId = Number(bundleRows[0].customer_id) || null
    }

    // ── Step 3: Collect order IDs for all resolved bundles ────────────────────

    const mailOrderIds:   number[] = []
    const siteOrderIds:   number[] = []
    const domainOrderIds: number[] = []

    for (const b of bundleRows) {
      if (b.mail_order_id)       mailOrderIds.push(Number(b.mail_order_id))
      if (b.site_order_id)       siteOrderIds.push(Number(b.site_order_id))
      if (b.neo_domain_order_id) domainOrderIds.push(Number(b.neo_domain_order_id))
    }

    // ── Step 4: Fetch all product orders + mailboxes in parallel ─────────────

    const [mailOrderRows, siteOrderRows, domainOrderRows, mailboxRows] = await Promise.all([
      mailOrderIds.length
        ? runQuery(DB,
            `SELECT ${MAIL_ORDER_COLS}
             FROM flockmail.neo_domain_aggregate_metrics
             WHERE order_id IN (${mailOrderIds.join(',')})`)
        : Promise.resolve([]),
      siteOrderIds.length
        ? runQuery(DB,
            `SELECT ${SITE_ORDER_COLS}
             FROM flockmail.neo_site_order_aggregate_metrics
             WHERE order_id IN (${siteOrderIds.join(',')})`)
        : Promise.resolve([]),
      domainOrderIds.length
        ? runQuery(DB,
            `SELECT ${DOMAIN_ORDER_COLS}
             FROM flockmail.neo_neodomain_order_aggregate_metrics
             WHERE order_id IN (${domainOrderIds.join(',')})`)
        : Promise.resolve([]),
      mailOrderIds.length
        ? runQuery(DB,
            `SELECT ${MBX_COLS}
             FROM flockmail.neo_mailbox_aggregate_metrics
             WHERE order_id IN (${mailOrderIds.join(',')})
             ORDER BY is_admin DESC, account_id ASC`)
        : Promise.resolve([]),
    ])

    // ── Step 5: Fetch 30d activity + feature usage for all mailboxes (parallel) ─

    const accountIds = mailboxRows.map(r => Number(r.account_id)).filter(Boolean)
    let activityMap: Record<number, { sent: number; read: number; received: number }> = {}
    let featureMap:  Record<number, Array<{ feature: string; total_usage: number; last_seen: string }>> = {}

    if (accountIds.length) {
      const idsStr = accountIds.join(',')
      const [activityRows, featureRows] = await Promise.all([
        runQuery(DB, `
          SELECT account_id,
                 CAST(SUM(sent) AS BIGINT) AS sent_30d,
                 CAST(SUM(read) AS BIGINT) AS read_30d,
                 CAST(SUM(recv) AS BIGINT) AS received_30d
          FROM flockmail.mailbox_read_sent_recv_mail
          WHERE account_id IN (${idsStr})
            AND dt >= current_date - interval '30' day
          GROUP BY account_id
        `),
        runQuery(DB, `
          SELECT account_id,
                 feature,
                 CAST(SUM(usage) AS BIGINT) AS total_usage,
                 CAST(MAX(dt) AS VARCHAR) AS last_seen
          FROM flockmail.titan_features_usage_v4
          WHERE account_id IN (${idsStr})
            AND dt >= current_date - interval '90' day
          GROUP BY account_id, feature
          ORDER BY account_id, total_usage DESC
        `),
      ])

      for (const r of activityRows) {
        activityMap[Number(r.account_id)] = {
          sent:     Number(r.sent_30d     ?? 0),
          read:     Number(r.read_30d     ?? 0),
          received: Number(r.received_30d ?? 0),
        }
      }
      for (const r of featureRows) {
        const id = Number(r.account_id)
        if (!featureMap[id]) featureMap[id] = []
        featureMap[id].push({
          feature:     String(r.feature),
          total_usage: Number(r.total_usage ?? 0),
          last_seen:   String(r.last_seen ?? '').slice(0, 10),
        })
      }
    }

    // ── Step 6: Fetch notes from Neon ─────────────────────────────────────────

    let notesMap: Record<number, string> = {}
    try {
      const noteResult = await sql<{ bundle_id: number; note: string }>`
        SELECT bundle_id, note FROM neo_user_notes
        WHERE bundle_id = ANY(${resolvedBundleIds})
      `
      for (const r of noteResult.rows) {
        notesMap[Number(r.bundle_id)] = r.note
      }
    } catch { /* Neon not yet configured — notes will be empty */ }

    // ── Step 7: Build index maps and return ───────────────────────────────────

    // Index orders by order_id for quick lookup
    const mailOrderMap   = Object.fromEntries(mailOrderRows.map(r => [Number(r.order_id), r]))
    const siteOrderMap   = Object.fromEntries(siteOrderRows.map(r => [Number(r.order_id), r]))
    const domainOrderMap = Object.fromEntries(domainOrderRows.map(r => [Number(r.order_id), r]))

    // Index mailboxes by mail order_id
    const mailboxesByOrder: Record<number, typeof mailboxRows> = {}
    for (const m of mailboxRows) {
      const oid = Number(m.order_id)
      if (!mailboxesByOrder[oid]) mailboxesByOrder[oid] = []
      mailboxesByOrder[oid].push(m)
    }

    // Assemble full bundle data
    const bundles = bundleRows.map(b => ({
      bundle:      b,
      mailOrder:   b.mail_order_id       ? (mailOrderMap[Number(b.mail_order_id)]       ?? null) : null,
      siteOrder:   b.site_order_id       ? (siteOrderMap[Number(b.site_order_id)]       ?? null) : null,
      domainOrder: b.neo_domain_order_id ? (domainOrderMap[Number(b.neo_domain_order_id)] ?? null) : null,
      mailboxes:   b.mail_order_id       ? (mailboxesByOrder[Number(b.mail_order_id)]   ?? []) : [],
      note:        notesMap[Number(b.bundle_id)] ?? '',
    }))

    // Customer summary counts — recompute from bundle rows
    const allBundleStatus = bundleRows.map(b => ({ status: b.status, mailStatus: b.mail_order_status, siteStatus: b.site_order_status }))

    return NextResponse.json({
      customer:    customerRows[0] ?? null,
      customerId,
      bundles,
      allBundleStatus,
      activityMap,
      featureMap,
    })

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
