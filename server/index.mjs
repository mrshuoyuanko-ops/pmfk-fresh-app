import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { load, persist, usingPostgres } from './db.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))

let db = await load()
console.log(usingPostgres ? 'Storage: Postgres (DATABASE_URL)' : 'Storage: local file (set DATABASE_URL for Postgres)')

const uid = () => crypto.randomBytes(12).toString('hex')
const now = () => Date.now()
const publicMarketplace = () => db.marketplace.map((t) => ({
  id: t.id,
  pseudonym: t.pseudonym,
  avatar: t.avatar,
  subjects: t.subjects,
  rate: t.rate,
  bio: t.bio,
  verified: t.verified,
  rating: t.rating,
  reviewCount: t.reviewCount,
}))

function auth(req, res, next) {
  const token = String(req.headers.authorization || '').replace('Bearer ', '')
  const userId = db.tokens[token]
  if (!userId || !db.users.find((u) => u.id === userId)) return res.status(401).json({ error: 'Not signed in.' })
  req.userId = userId
  next()
}

function ensureState(user) {
  if (!db.state[user.id]) {
    db.state[user.id] = {
      profiles: [], families: [], tutors: [], sessions: [], checkIns: [], txns: [],
      messages: [], aiChat: [], consents: [], reviews: [], chores: [], badges: [], referrals: [], paymentMethods: [],
    }
  }
  return db.state[user.id]
}

// ---------- Auth ----------
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {}
  const em = String(email || '').trim().toLowerCase()
  const pw = String(password || '')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return res.status(400).json({ error: 'Enter a valid email address.' })
  if (pw.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' })
  if (db.users.find((u) => u.email === em)) return res.status(409).json({ error: 'An account with this email already exists.' })

  const userId = uid()
  const familyId = uid()
  const parentId = uid()
  const learnerId = uid()
  db.users.push({ id: userId, email: em, passwordHash: bcrypt.hashSync(pw, 10), createdAt: now() })
  db.state[userId] = {
    profiles: [
      { id: parentId, name: String(name || 'Parent').trim(), email: em, role: 'parent', familyId, avatar: (String(name || 'P').trim()[0] || 'P').toUpperCase(), createdAt: now() },
      { id: learnerId, name: `${String(name || 'Family').trim()}'s child`, email: `${em}/child`, role: 'learner', familyId, avatar: 'L', birthYear: new Date().getFullYear() - 10, createdAt: now() },
    ],
    families: [{ id: familyId, name: `${String(name || 'Family').trim()}'s family`, parentId, memberIds: [parentId, learnerId], consent: null, balance: 0, goalName: 'First goal', goalTarget: 50, goalSaved: 0 }],
    tutors: [], sessions: [], checkIns: [], txns: [], messages: [], aiChat: [], consents: [], reviews: [], chores: [], badges: [], referrals: [{ id: uid(), code: crypto.randomBytes(4).toString('hex').toUpperCase(), signups: 0 }], paymentMethods: [],
  }
  const token = crypto.randomBytes(32).toString('hex')
  db.tokens[token] = userId
  persist(db)
  res.json({ token, state: db.state[userId], marketplace: publicMarketplace() })
})

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {}
  const em = String(email || '').trim().toLowerCase()
  const user = db.users.find((u) => u.email === em)
  if (!user || !bcrypt.compareSync(String(password || ''), user.passwordHash)) return res.status(401).json({ error: 'Wrong email or password.' })
  const token = crypto.randomBytes(32).toString('hex')
  db.tokens[token] = user.id
  persist(db)
  res.json({ token, state: ensureState(user), marketplace: publicMarketplace() })
})

app.get('/api/me', auth, (req, res) => {
  const user = db.users.find((u) => u.id === req.userId)
  res.json({ email: user.email, state: ensureState(user), marketplace: publicMarketplace() })
})

// ---------- Sync (whole-state, offline replay friendly) ----------
app.put('/api/sync', auth, (req, res) => {
  const state = req.body && req.body.state
  if (!state || typeof state !== 'object' || Array.isArray(state)) return res.status(400).json({ error: 'Invalid state payload.' })
  // Reject any accidental coordinate fields at the server boundary (privacy invariant).
  const checkIns = Array.isArray(state.checkIns) ? state.checkIns : []
  if (checkIns.some((c) => c && (c.latitude || c.longitude))) return res.status(400).json({ error: 'Coordinates must never be stored.' })
  db.state[req.userId] = state
  persist(db)
  res.json({ ok: true })
})

// ---------- Marketplace ----------
app.get('/api/marketplace', auth, (_req, res) => res.json({ marketplace: publicMarketplace() }))

app.post('/api/marketplace/:id/review', auth, (req, res) => {
  const tutor = db.marketplace.find((t) => t.id === req.params.id)
  if (!tutor) return res.status(404).json({ error: 'Tutor not found.' })
  const rating = Number(req.body && req.body.rating)
  const comment = String((req.body && req.body.comment) || '').slice(0, 500)
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5.' })
  tutor.reviews.push({ id: uid(), familyId: req.userId, rating, comment, createdAt: now() })
  tutor.rating = Math.round((tutor.reviews.reduce((s, r) => s + r.rating, 0) / tutor.reviews.length) * 10) / 10
  tutor.reviewCount = tutor.reviews.length
  persist(db)
  res.json({ rating: tutor.rating, reviewCount: tutor.reviewCount })
})

// ---------- Check-in (coordinates never accepted) ----------
app.post('/api/checkin', auth, (req, res) => {
  const { insideZone, role, sessionId } = req.body || {}
  if (typeof insideZone !== 'boolean') return res.status(400).json({ error: 'insideZone must be true or false.' })
  const state = ensureState(db.users.find((u) => u.id === req.userId))
  const entry = { id: uid(), sessionId: String(sessionId || ''), role: String(role || 'learner'), insideZone, at: now() }
  state.checkIns = state.checkIns || []
  state.checkIns.push(entry)
  persist(db)
  res.json({ checkIn: entry })
})

// ---------- Right to erasure ----------
app.delete('/api/account', auth, (req, res) => {
  const userId = req.userId
  delete db.state[userId]
  db.users = db.users.filter((u) => u.id !== userId)
  for (const token of Object.keys(db.tokens)) if (db.tokens[token] === userId) delete db.tokens[token]
  persist(db)
  res.json({ ok: true, message: 'Account and all linked data erased.' })
})

app.get('/api/export', auth, (req, res) => {
  const user = db.users.find((u) => u.id === req.userId)
  res.json({ email: user.email, exportedAt: new Date().toISOString(), state: ensureState(user) })
})

// ---------- Live lessons: rooms + WebRTC signaling ----------
const rooms = new Map() // code -> { code, members: Map<id, {ws, name}> }

app.post('/api/rooms', auth, (_req, res) => {
  const code = crypto.randomBytes(3).toString('hex').toUpperCase()
  rooms.set(code, { code, members: new Map() })
  res.json({ code })
})

app.get('/api/rooms/:code', auth, (req, res) => {
  const room = rooms.get(String(req.params.code).toUpperCase())
  if (!room) return res.status(404).json({ error: 'Room not found.' })
  res.json({ code: room.code, members: room.members.size })
})

function roomBroadcast(room, msg, except) {
  room.members.forEach((m) => {
    if (m.ws !== except && m.ws.readyState === 1) m.ws.send(JSON.stringify(msg))
  })
}

function roomPresence(room) {
  return Array.from(room.members.entries()).map(([id, m]) => ({ id, name: m.name }))
}

// ---------- Production static serving ----------
const dist = join(__dirname, '..', 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(dist, 'index.html')))
}

const PORT = process.env.PORT || 4000
const server = app.listen(PORT, () => {
  console.log(`PMFK server running on http://localhost:${PORT}`)
})

const wss = new WebSocketServer({ server, path: '/ws' })
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost')
  const roomCode = String(url.searchParams.get('room') || '').toUpperCase()
  const id = url.searchParams.get('id') || crypto.randomBytes(8).toString('hex')
  const name = String(url.searchParams.get('user') || 'Guest').slice(0, 40)
  const room = rooms.get(roomCode)
  if (!room) {
    ws.close(4000, 'Room not found')
    return
  }
  room.members.set(id, { ws, name })
  roomBroadcast(room, { type: 'presence', members: roomPresence(room) }, null)

  ws.on('message', (data) => {
    let msg
    try { msg = JSON.parse(data.toString()) } catch { return }
    if (msg.type === 'signal' && msg.to) {
      const target = room.members.get(msg.to)
      if (target && target.ws.readyState === 1) target.ws.send(JSON.stringify({ type: 'signal', from: id, name, data: msg.data }))
    } else if (msg.type === 'chat') {
      roomBroadcast(room, { type: 'chat', from: id, name, text: String(msg.text || '').slice(0, 500) }, ws)
    } else if (msg.type === 'raise') {
      roomBroadcast(room, { type: 'raise', from: id, name, raised: !!msg.raised }, ws)
    } else if (msg.type === 'draw') {
      roomBroadcast(room, { type: 'draw', from: id, data: msg.data }, ws)
    } else if (msg.type === 'boardClear') {
      roomBroadcast(room, { type: 'boardClear', from: id }, ws)
    } else if (msg.type === 'note') {
      roomBroadcast(room, { type: 'note', from: id, text: String(msg.text || '').slice(0, 20000) }, ws)
    } else if (msg.type === 'file') {
      roomBroadcast(room, { type: 'file', from: id, name: String(msg.name || 'file').slice(0, 120), dataUrl: String(msg.dataUrl || '') }, ws)
    }
  })

  ws.on('close', () => {
    room.members.delete(id)
    if (room.members.size === 0) rooms.delete(room.code)
    else roomBroadcast(room, { type: 'presence', members: roomPresence(room) }, null)
  })
})
