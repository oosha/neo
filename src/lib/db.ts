// Neon serverless DB client for Neo find-user (notes + PMF)
//
// Required Neon tables (run once in your Neon project):
//
// CREATE TABLE IF NOT EXISTS neo_user_notes (
//   bundle_id  BIGINT PRIMARY KEY,
//   note       TEXT    NOT NULL DEFAULT '',
//   updated_at TIMESTAMP NOT NULL DEFAULT NOW()
// );
//
// CREATE TABLE IF NOT EXISTS neo_pmf_feedback (
//   id                SERIAL PRIMARY KEY,
//   account_id        BIGINT,
//   customer_id       BIGINT,
//   product           TEXT,           -- 'mail' | 'site'
//   score             TEXT,           -- 'very_disappointed' | 'somewhat_disappointed' | 'not_disappointed'
//   feedback_text     TEXT,
//   submitted_at      TIMESTAMP,
//   tally_form_id     TEXT,
//   tally_response_id TEXT UNIQUE
// );
// CREATE INDEX IF NOT EXISTS neo_pmf_feedback_account_id ON neo_pmf_feedback(account_id);
// CREATE INDEX IF NOT EXISTS neo_pmf_feedback_customer_id ON neo_pmf_feedback(customer_id);

import { neon } from '@neondatabase/serverless'

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[]
  rowCount: number
}

function getSql() {
  const connectionString =
    process.env.neo_DATABASE_URL ??
    process.env.neo_POSTGRES_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL
  if (!connectionString) throw new Error('No Neo database connection string found (set neo_DATABASE_URL)')
  if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
    throw new Error(`Neon connection string must start with postgresql:// — got: ${connectionString.slice(0, 60)}`)
  }
  return neon(connectionString)
}

export async function sql<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<QueryResult<T>> {
  const rows = (await getSql()(strings, ...values)) as T[]
  return { rows, rowCount: rows.length }
}

sql.query = async (queryText: string): Promise<void> => {
  await getSql().query(queryText)
}
