import type { DB } from '../types'

const KEY = 'pmfk-db-v2'

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function emptyDB(): DB {
  return {
    profiles: [],
    families: [],
    tutors: [],
    sessions: [],
    checkIns: [],
    txns: [],
    messages: [],
    aiChat: [],
    reviews: [],
    chores: [],
    badges: [],
    referrals: [],
    paymentMethods: [],
    currentUserId: null,
  }
}

export function loadDB(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DB
  } catch {
    /* ignore corrupt or missing data */
  }
  return emptyDB()
}

export function saveDB(db: DB): void {
  localStorage.setItem(KEY, JSON.stringify(db))
}

// ---- Local (offline-first) account credentials ----
const AUTH_KEY = 'pmfk-local-auth'

export interface LocalUser {
  passwordHash: string
  profileId: string
}

export async function hashPassword(pw: string, salt = ''): Promise<string> {
  const s = `${salt}:${pw}`
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
      return 's' + Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
    }
  } catch {
    /* fall through to the sync fallback below */
  }
  // FNV-1a fallback for non-secure contexts (e.g. file://). The hash only ever
  // lives in this browser's localStorage — it never leaves the device.
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return 'p' + (h >>> 0).toString(16)
}

export function loadLocalUsers(): Record<string, LocalUser> {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || '{}') as Record<string, LocalUser>
  } catch {
    return {}
  }
}

export function saveLocalUsers(users: Record<string, LocalUser>): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(users))
}
