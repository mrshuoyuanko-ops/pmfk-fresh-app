import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Pool } = pg
const __dirname = dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = process.env.PMFK_DATA_DIR || join(__dirname, 'data')
const FILE = join(DATA_DIR, 'db.json')

// Optional Postgres (Supabase / Neon) — used when DATABASE_URL is set.
// Falls back to the local JSON file automatically when it is not.
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null

export const usingPostgres = Boolean(pool)

export function seedData() {
  return {
    users: [], // { id, email, passwordHash, createdAt }
    state: {}, // userId -> that user's app state
    marketplace: [], // global tutor cards (public = pseudonym only)
    tokens: {}, // token -> userId
  }
}

export function removeSampleMarketplace(d) {
  const samples = new Set(['Maya C.', 'Noah W.', 'Sofia P.'])
  d.marketplace = d.marketplace.filter((t) => !samples.has(t.pseudonym))
  return d
}

function loadFile() {
  try {
    if (existsSync(FILE)) {
      const d = JSON.parse(readFileSync(FILE, 'utf8'))
      return removeSampleMarketplace(d)
    }
  } catch {
    /* fall through to fresh seed */
  }
  const d = seedData()
  removeSampleMarketplace(d)
  persist(d)
  return d
}

export async function load() {
  if (!pool) return loadFile()
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value JSONB NOT NULL)')
    const r = await pool.query("SELECT value FROM kv WHERE key = 'db'")
    if (r.rows.length > 0) {
      const d = r.rows[0].value
      return removeSampleMarketplace(d)
    }
  } catch (e) {
    console.error('Postgres load failed — falling back to local file:', e.message)
  }
  return loadFile()
}

export function persist(d) {
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify(d, null, 2))
  if (pool) {
    pool.query('INSERT INTO kv (key, value) VALUES (\'db\', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [JSON.stringify(d)])
      .catch((e) => console.error('Postgres save failed:', e.message))
  }
}
