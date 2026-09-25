import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { DB, Family, Profile } from '../types'
import { emptyDB, loadDB, saveDB, uid, hashPassword, loadLocalUsers, saveLocalUsers } from './db.ts'
import { normalizeEmail, isValidEmail, isDisposableEmail } from './email.ts'
import { api, getToken, setToken } from './api'
import type { MarketplaceTutor } from './api'

interface AppState {
  db: DB
  cloud: boolean
  syncing: boolean
  mutate: (fn: (db: DB) => void) => void
  replace: (db: DB) => void
  register: (name: string, email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  eraseAccount: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)
const ARRAYS = ['profiles', 'families', 'tutors', 'sessions', 'checkIns', 'txns', 'messages', 'aiChat', 'reviews', 'chores', 'badges', 'referrals', 'paymentMethods'] as const

function normalizeState(state: unknown): DB {
  const next = { ...emptyDB(), ...((state as Partial<DB>) || {}) }
  for (const key of ARRAYS) {
    if (!Array.isArray((next as Record<string, unknown>)[key])) (next as Record<string, unknown>)[key] = []
  }
  return next
}

function mergeMarketplace(db: DB, marketplace: MarketplaceTutor[]): DB {
  const existing = new Set(db.tutors.map((t) => t.profileId))
  marketplace.forEach((m) => {
    if (existing.has(m.id)) return
    db.profiles.push({ id: m.id, name: m.pseudonym, email: '', role: 'tutor', familyId: '', avatar: m.avatar, createdAt: 0 })
    db.tutors.push({ profileId: m.id, pseudonym: m.pseudonym, subjects: m.subjects, availability: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], rate: m.rate, school: '', bio: m.bio, verified: m.verified, rating: m.rating, reviewCount: m.reviewCount })
  })
  return db
}

function stripMarketplace(db: DB) {
  const marketplaceIds = new Set(db.profiles.filter((p) => p.role === 'tutor' && p.familyId === '').map((p) => p.id))
  return {
    ...db,
    tutors: db.tutors.filter((t) => !marketplaceIds.has(t.profileId)),
    profiles: db.profiles.filter((p) => !marketplaceIds.has(p.id)),
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(loadDB)
  const [cloud, setCloud] = useState<boolean>(Boolean(getToken()))
  const [syncing, setSyncing] = useState(false)
  const dbRef = useRef(db)
  dbRef.current = db
  const timer = useRef<number | null>(null)

  const push = async (next: DB) => {
    if (!getToken() || !navigator.onLine) return
    setSyncing(true)
    try {
      await api.sync(stripMarketplace(next))
    } catch {
      /* offline or server error — will retry on next change or reconnect */
    } finally {
      setSyncing(false)
    }
  }

  const schedulePush = (next: DB) => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { void push(next) }, 1200)
  }

  useEffect(() => {
    if (!cloud) return
    let cancelled = false
    api.me()
      .then((res) => {
        if (cancelled) return
        const merged = mergeMarketplace(normalizeState(res.state), res.marketplace)
        const parent = merged.profiles.find((p) => p.role === 'parent')
        merged.currentUserId = parent ? parent.id : merged.profiles[0]?.id ?? null
        saveDB(merged)
        setDb(merged)
      })
      .catch(() => { /* offline — keep the local copy */ })
    const onOnline = () => { void push(dbRef.current) }
    window.addEventListener('online', onOnline)
    return () => { cancelled = true; window.removeEventListener('online', onOnline) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud])

  const register = async (name: string, email: string, password: string) => {
    const key = normalizeEmail(email)
    if (!isValidEmail(key)) throw new Error('Please enter a valid email address.')
    if (isDisposableEmail(key)) throw new Error('Temporary email addresses are not allowed. Use a real email.')
    const users = loadLocalUsers()
    if (users[key]) throw new Error('An account with this email already exists on this device.')

    const id = uid()
    const familyId = uid()
    const profile: Profile = { id, name, email: key, role: 'parent', familyId, avatar: '', createdAt: Date.now() }
    const family: Family = {
      id: familyId,
      name: `${name}'s family`,
      parentId: id,
      memberIds: [id],
      consent: null,
      balance: 0,
      goalName: 'New goal',
      goalTarget: 0,
      goalSaved: 0,
    }

    const next = loadDB()
    next.profiles.push(profile)
    next.families.push(family)
    next.currentUserId = id
    saveDB(next)

    users[key] = { passwordHash: await hashPassword(password, key), profileId: id }
    saveLocalUsers(users)

    setDb(next)
    setCloud(false)
  }

  const login = async (email: string, password: string) => {
    const key = normalizeEmail(email)
    const rec = loadLocalUsers()[key]
    if (!rec || rec.passwordHash !== await hashPassword(password, key)) {
      throw new Error('Email or password is incorrect.')
    }
    const next = loadDB()
    const profile = next.profiles.find((p) => p.id === rec.profileId)
    if (!profile) throw new Error('Account not found on this device.')
    next.currentUserId = profile.id
    saveDB(next)
    setDb(next)
    setCloud(false)
  }

  const logout = () => {
    setToken(null)
    const next = loadDB()
    next.currentUserId = null
    saveDB(next)
    setDb(next)
    setCloud(false)
  }

  const eraseAccount = async () => {
    const current = dbRef.current.profiles.find((p) => p.id === dbRef.current.currentUserId)
    if (current?.email) {
      const users = loadLocalUsers()
      delete users[current.email.toLowerCase()]
      saveLocalUsers(users)
    }
    setToken(null)
    const next = emptyDB()
    saveDB(next)
    setDb(next)
    setCloud(false)
  }

  const mutate = (fn: (db: DB) => void) => {
    setDb((prev) => {
      const next = structuredClone(prev)
      fn(next)
      saveDB(next)
      schedulePush(next)
      return next
    })
  }

  const replace = (next: DB) => {
    saveDB(next)
    setDb(next)
  }

  return (
    <Ctx.Provider value={{ db, cloud, syncing, mutate, replace, register, login, logout, eraseAccount }}>
      {children}
    </Ctx.Provider>
  )
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
