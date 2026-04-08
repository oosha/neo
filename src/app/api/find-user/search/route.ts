// POST /api/find-user/search
// Body: { type: 'domain'|'email'|'bundle_id'|'order_id'|'customer_id'|'customer_email'|'account_id', value: string }
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

// Plan history — from flockmail.domain_aggregate_metrics (not neo_domain_aggregate_metrics)
const PLAN_HISTORY_COLS = `
  order_id,
  first_starter_ts, plan_before_first_starter,
  first_pro_ts, plan_before_first_pro,
  first_ultra_ts, plan_before_first_ultra,
  premium_conversion_date, pro_to_premium_conversion_date,
  paid_to_free_date
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

    } else if (type === 'customer_email') {
      const rows = await runQuery(DB,
        `SELECT bundle_id, customer_id FROM flockmail.neo_bundle_aggregate_metrics
         WHERE LOWER(customer_email) = LOWER('${san(value)}') ORDER BY created_at DESC LIMIT 1`)
      if (!rows[0]) return NextResponse.json({ error: `Customer not found: ${value}` }, { status: 404 })
      customerId = Number(rows[0].customer_id) || null
      // fetch all bundles for this customer
      if (customerId) {
        const allRows = await runQuery(DB,
          `SELECT bundle_id FROM flockmail.neo_bundle_aggregate_metrics
           WHERE customer_id = ${customerId} ORDER BY created_at DESC`)
        resolvedBundleIds = allRows.map(r => Number(r.bundle_id)).filter(Boolean)
      } else {
        resolvedBundleIds = [Number(rows[0].bundle_id)]
      }
      if (!resolvedBundleIds.length) return NextResponse.json({ error: `No bundles found for: ${value}` }, { status: 404 })

    } else if (type === 'domain') {
      const rows = await runQuery(DB,
        `SELECT bundle_id, customer_id FROM flockmail.neo_bundle_aggregate_metrics
         WHERE LOWER(domain_name) = LOWER('${san(value)}') LIMIT 1`)
      if (!rows[0]) return NextResponse.json({ error: `Domain not found: ${value}` }, { status: 404 })
      resolvedBundleIds = [Number(rows[0].bundle_id)]
      customerId = Number(rows[0].customer_id) || null

    } else if (type === 'customer_email') {
      const rows = await runQuery(DB,
        `SELECT customer_id FROM flockmail.neo_customer_aggregate_metrics
         WHERE LOWER(customer_email) = LOWER('${san(value)}') LIMIT 1`)
      if (!rows[0]) {
        // Fallback: search bundle table by customer_email
        const bundleRows = await runQuery(DB,
          `SELECT customer_id FROM flockmail.neo_bundle_aggregate_metrics
           WHERE LOWER(customer_email) = LOWER('${san(value)}') LIMIT 1`)
        if (!bundleRows[0]) return NextResponse.json({ error: `Customer email not found: ${value}` }, { status: 404 })
        customerId = Number(bundleRows[0].customer_id) || null
      } else {
        customerId = Number(rows[0].customer_id) || null
      }
      if (!customerId) return NextResponse.json({ error: `Customer email not found: ${value}` }, { status: 404 })
      const bundleIdRows = await runQuery(DB,
        `SELECT bundle_id FROM flockmail.neo_bundle_aggregate_metrics
         WHERE customer_id = ${customerId} ORDER BY created_at DESC`)
      resolvedBundleIds = bundleIdRows.map(r => Number(r.bundle_id)).filter(Boolean)
      if (!resolvedBundleIds.length) return NextResponse.json({ error: `No bundles found for customer: ${value}` }, { status: 404 })

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

    const [mailOrderRows, siteOrderRows, domainOrderRows, mailboxRows, planHistoryRows] = await Promise.all([
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
      mailOrderIds.length
        ? runQuery(DB,
            `SELECT ${PLAN_HISTORY_COLS}
             FROM flockmail.domain_aggregate_metrics
             WHERE order_id IN (${mailOrderIds.join(',')})`)
        : Promise.resolve([]),
    ])

    // Merge plan history into mail order rows
    const planHistoryMap: Record<number, Record<string, unknown>> = {}
    for (const r of planHistoryRows) {
      planHistoryMap[Number(r.order_id)] = r
    }
    const mergedMailOrderRows = mailOrderRows.map(r => ({
      ...r,
      ...(planHistoryMap[Number(r.order_id)] ?? {}),
    }))

    // ── Step 5: Fetch activity, features, weekly + client/account data ────────

    const accountIds = mailboxRows.map(r => Number(r.account_id)).filter(Boolean)

    type WeekRow = { week: string; sent: number; read: number; received: number; calendar: number; search: number; organize: number; nonTitanSent: number; mobileSent: number }
    type ClientInfo = { hasTitan: boolean; hasNonTitan: boolean; majorDevice: string | null; clientForSending: string | null }
    let activityMap:          Record<number, { sent: number; read: number; received: number }> = {}
    let featureMap:           Record<number, Array<{ feature: string; action: string; category: string; device: string; total_usage: number; last_seen: string }>> = {}
    let weeklyMap:            Record<number, WeekRow[]> = {}
    let accountInfoMap:       Record<number, { forwardToCount: number | null; emailAliasCount: number | null }> = {}
    let topNonTitanClientMap: Record<number, string> = {}
    let clientInfoMap:        Record<number, ClientInfo> = {}

    if (accountIds.length) {
      const idsStr = accountIds.join(',')

      // Feature query with try-fallback for broken S3 partitions
      const FEATURE_QUERY = (dateClause: string) => `
        SELECT account_id, feature, action, category, device,
               CAST(SUM(usage) AS BIGINT) AS total_usage,
               CAST(MAX(dt) AS VARCHAR) AS last_seen
        FROM flockmail.titan_features_usage_v4
        WHERE account_id IN (${idsStr})
          AND ${dateClause}
        GROUP BY account_id, feature, action, category, device
        ORDER BY account_id, total_usage DESC
      `
      let featureRows: Record<string, unknown>[] = []
      try {
        featureRows = await runQuery(DB, FEATURE_QUERY(`dt >= date '2020-01-01'`))
      } catch {
        try {
          featureRows = await runQuery(DB, FEATURE_QUERY(`dt >= date '2025-05-01'`))
        } catch {
          featureRows = await runQuery(DB, FEATURE_QUERY(`dt >= current_date - interval '90' day`))
        }
      }

      const [activityRows, weeklyRows, weeklyFeatRows, accountInfoRows, clientRows, mobileSentRows] = await Promise.all([
        // 30d send/read/recv totals
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
        // 90d weekly send/read/recv
        runQuery(DB, `
          SELECT account_id,
                 CAST(date_trunc('week', dt) AS VARCHAR) AS week,
                 CAST(SUM(sent) AS BIGINT) AS sent,
                 CAST(SUM(read)  AS BIGINT) AS read,
                 CAST(SUM(recv)  AS BIGINT) AS received
          FROM flockmail.mailbox_read_sent_recv_mail
          WHERE account_id IN (${idsStr})
            AND dt >= current_date - interval '90' day
          GROUP BY account_id, date_trunc('week', dt)
          ORDER BY account_id, week DESC
        `),
        // 90d weekly calendar/search/organize feature counts
        runQuery(DB, `
          SELECT account_id,
                 CAST(date_trunc('week', dt) AS VARCHAR) AS week,
                 CAST(SUM(CASE WHEN feature IN ('calendar_event_creation','calendar_invite_received') THEN usage ELSE 0 END) AS BIGINT) AS calendar,
                 CAST(SUM(CASE WHEN feature IN ('advanced_search','search_initiate') THEN usage ELSE 0 END) AS BIGINT) AS search,
                 CAST(SUM(CASE WHEN feature IN ('mark_as_read','mark_as_unread','move_to_folder','pin','star','unpin','unstar','custom_folder_created','email_labels') THEN usage ELSE 0 END) AS BIGINT) AS organize
          FROM flockmail.titan_features_usage_v4
          WHERE account_id IN (${idsStr})
            AND dt >= current_date - interval '90' day
            AND feature IN ('calendar_event_creation','calendar_invite_received','advanced_search','search_initiate','mark_as_read','mark_as_unread','move_to_folder','pin','star','unpin','unstar','custom_folder_created','email_labels')
          GROUP BY account_id, date_trunc('week', dt)
          ORDER BY account_id, week DESC
        `),
        // Forward/alias counts from flock_account
        runQuery(DB, `
          SELECT id AS account_id, forward_to_count, email_alias_count
          FROM flockmail.flock_account
          WHERE id IN (${idsStr})
        `),
        // Non-Titan client weekly sent
        runQuery(DB, `
          SELECT account_id,
                 CAST(date_trunc('week', dt) AS VARCHAR) AS week,
                 raw_normalized_user_agent,
                 CAST(SUM(mails_sent) AS BIGINT) AS sent
          FROM flockmail.sent_client_classification
          WHERE account_id IN (${idsStr})
            AND dt >= current_date - interval '90' day
            AND category != 'Titan Client'
          GROUP BY account_id, date_trunc('week', dt), raw_normalized_user_agent
          ORDER BY account_id, week DESC
        `),
        // Titan Mobile (ios + android) weekly sent
        runQuery(DB, `
          SELECT account_id,
                 CAST(date_trunc('week', dt) AS VARCHAR) AS week,
                 CAST(SUM(usage) AS BIGINT) AS sent
          FROM flockmail.titan_features_usage_v4
          WHERE account_id IN (${idsStr})
            AND dt >= current_date - interval '90' day
            AND feature IN ('new_mail_send','reply_mail_send','forward_mail_send','reply_all_mail_send')
            AND device IN ('ios','android')
          GROUP BY account_id, date_trunc('week', dt)
          ORDER BY account_id, week DESC
        `),
      ])

      // Process 30d activity
      for (const r of activityRows) {
        activityMap[Number(r.account_id)] = {
          sent:     Number(r.sent_30d     ?? 0),
          read:     Number(r.read_30d     ?? 0),
          received: Number(r.received_30d ?? 0),
        }
      }

      // Process features
      for (const r of featureRows) {
        const id = Number(r.account_id)
        if (!featureMap[id]) featureMap[id] = []
        featureMap[id].push({
          feature:     String(r.feature    ?? ''),
          action:      String(r.action     ?? ''),
          category:    String(r.category   ?? ''),
          device:      String(r.device     ?? ''),
          total_usage: Number(r.total_usage ?? 0),
          last_seen:   String(r.last_seen  ?? '').slice(0, 10),
        })
      }

      // Account info
      for (const r of accountInfoRows) {
        accountInfoMap[Number(r.account_id)] = {
          forwardToCount:  r.forward_to_count  != null ? Number(r.forward_to_count)  : null,
          emailAliasCount: r.email_alias_count != null ? Number(r.email_alias_count) : null,
        }
      }

      // Merge weekly data
      type WKey = string
      const wMap: Record<WKey, WeekRow> = {}
      const emptyWeek = (accountId: number, week: string): WeekRow => ({ week, sent: 0, read: 0, received: 0, calendar: 0, search: 0, organize: 0, nonTitanSent: 0, mobileSent: 0 })
      const wKey = (accountId: number | unknown, week: unknown) => `${accountId}|${String(week ?? '').slice(0, 10)}`

      for (const r of weeklyRows) {
        const k = wKey(r.account_id, r.week)
        wMap[k] = { ...emptyWeek(Number(r.account_id), String(r.week ?? '').slice(0, 10)), sent: Number(r.sent ?? 0), read: Number(r.read ?? 0), received: Number(r.received ?? 0) }
      }
      for (const r of weeklyFeatRows) {
        const k = wKey(r.account_id, r.week)
        if (!wMap[k]) wMap[k] = emptyWeek(Number(r.account_id), String(r.week ?? '').slice(0, 10))
        wMap[k].calendar = Number(r.calendar ?? 0)
        wMap[k].search   = Number(r.search   ?? 0)
        wMap[k].organize = Number(r.organize  ?? 0)
      }
      const topClientTotals: Record<number, Record<string, number>> = {}
      for (const r of clientRows) {
        const accountId = Number(r.account_id)
        const k = wKey(accountId, r.week)
        if (!wMap[k]) wMap[k] = emptyWeek(accountId, String(r.week ?? '').slice(0, 10))
        wMap[k].nonTitanSent += Number(r.sent ?? 0)
        if (!topClientTotals[accountId]) topClientTotals[accountId] = {}
        const client = String(r.raw_normalized_user_agent ?? 'unknown')
        topClientTotals[accountId][client] = (topClientTotals[accountId][client] ?? 0) + Number(r.sent ?? 0)
      }
      for (const r of mobileSentRows) {
        const k = wKey(r.account_id, r.week)
        if (!wMap[k]) wMap[k] = emptyWeek(Number(r.account_id), String(r.week ?? '').slice(0, 10))
        wMap[k].mobileSent += Number(r.sent ?? 0)
      }

      // Top non-Titan client per account
      for (const [accountId, clients] of Object.entries(topClientTotals)) {
        const top = Object.entries(clients).sort((a, b) => b[1] - a[1])[0]
        if (top) topNonTitanClientMap[Number(accountId)] = top[0]
      }

      // Index weekly rows by account_id (key format is `${accountId}|${week}`)
      for (const [k, row] of Object.entries(wMap)) {
        const accountId = Number(k.split('|')[0])
        if (!weeklyMap[accountId]) weeklyMap[accountId] = []
        weeklyMap[accountId].push(row)
      }
      // Sort each account's weeks descending
      for (const id of Object.keys(weeklyMap)) {
        weeklyMap[Number(id)].sort((a, b) => b.week.localeCompare(a.week))
      }

      // Derive client/device info from feature usage + non-Titan classification
      // (Neo mailbox aggregate doesn't have dovecot/client_usage columns)
      for (const accountId of accountIds) {
        const entries = featureMap[accountId] ?? []
        const deviceTotals: Record<string, number> = {}
        for (const f of entries) {
          const d = f.device.toLowerCase()
          if (['web', 'ios', 'android'].includes(d)) {
            deviceTotals[d] = (deviceTotals[d] ?? 0) + f.total_usage
          }
        }
        const hasTitan    = Object.keys(deviceTotals).length > 0
        const hasNonTitan = !!topNonTitanClientMap[accountId]
        const majorDevice = Object.entries(deviceTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

        let clientForSending: string | null = null
        if (hasTitan && hasNonTitan) clientForSending = 'Both (Titan + external)'
        else if (hasTitan)           clientForSending = 'Titan only'
        else if (hasNonTitan)        clientForSending = 'Non-Titan only'

        clientInfoMap[accountId] = { hasTitan, hasNonTitan, majorDevice, clientForSending }
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
    const mailOrderMap   = Object.fromEntries(mergedMailOrderRows.map(r => [Number(r.order_id), r]))
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
      customer:             customerRows[0] ?? null,
      customerId,
      bundles,
      allBundleStatus,
      activityMap,
      featureMap,
      weeklyMap,
      accountInfoMap,
      topNonTitanClientMap,
      clientInfoMap,
    })

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
