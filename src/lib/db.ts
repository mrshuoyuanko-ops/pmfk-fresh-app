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
