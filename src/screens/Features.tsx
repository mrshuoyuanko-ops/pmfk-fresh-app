import { useRef, useState } from 'react'
import { useApp } from '../lib/AppContext'
import { ask, bestTutorReasoning, scoreTutor } from '../lib/ai'
import { insideSafeZone } from '../lib/geo'
import { fmtMoney, dayLabel, avatarTone, initials } from '../lib/format'
import { uid } from '../lib/db'
import { api, getToken } from '../lib/api'
import { Badge, Empty, SectionHeader, statusTone } from '../components'

export function Matches() {
  const { db, mutate } = useApp()
  const user = db.profiles.find((p) => p.id === db.currentUserId)
  const [query, setQuery] = useState('')
  const [subject, setSubject] = useState('')
  const [reviewing, setReviewing] = useState('')
  if (!user) return null

  const family = db.families.find((f) => f.id === user.familyId)
  const learner = family?.memberIds.map((id) => db.profiles.find((p) => p.id === id)).find((p) => p?.role === 'learner')
  const subjects = Array.from(new Set(db.tutors.flatMap((t) => t.subjects)))
  const term = query.toLowerCase().trim()

  const rows = db.tutors
    .map((t) => ({ t, profile: db.profiles.find((p) => p.id === t.profileId), result: scoreTutor(t, subject || term) }))
    .filter(({ t, profile }) => {
      if (!profile) return false
      if (subject && !t.subjects.some((s) => s.toLowerCase().includes(subject.toLowerCase()))) return false
      if (term && !`${profile.name} ${t.subjects.join(' ')} ${t.school}`.toLowerCase().includes(term)) return false
      return true
    })
    .sort((a, b) => b.result.score - a.result.score)

  const request = (tutorId: string) => mutate((d) => {
    const f = d.families.find((x) => x.id === user.familyId)
    if (!f) return
    d.sessions.push({ id: uid(), tutorId, learnerId: learner?.id ?? user.id, familyId: f.id, subject: subject || 'General', status: 'requested', scheduledAt: Date.now() + 1000 * 60 * 60 * 24, durationMin: 60 })
  })

  return (
    <div className="page-view">
      <div className="page-title">
        <div>
          <span className="eyebrow">ON-DEVICE MATCHING</span>
          <h1>Find a good fit.</h1>
          <p>The private helper ranks tutors by subject, price, and fit — computed on this device with no API key.</p>
        </div>
        <div className="ai-badge">✦ <small>PMFK helper<br /><b>Ready to help</b></small></div>
      </div>

      <div className="search-wrap">⌕<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, subject, or school" /></div>

      <div className="chips" style={{ marginBottom: 20 }}>
        <button className={`chip ${subject === '' ? 'on' : ''}`} onClick={() => setSubject('')}>All subjects</button>
        {subjects.map((s) => <button className={`chip ${subject === s ? 'on' : ''}`} key={s} onClick={() => setSubject(s)}>{s}</button>)}
      </div>

      <div className="match-layout">
        <div>
          <p className="result-heading"><b>{rows.length} thoughtful matches</b><span>Sorted by learning fit</span></p>
          {rows.length === 0 && <Empty>No matches yet. Try a different subject.</Empty>}
          {rows.map(({ t, profile, result }) => (
            <div className="match-card" key={t.profileId}>
              <div className="tutor-row">
                <span className={`avatar ${avatarTone(profile!.name)}`}>{initials(profile!.name)}</span>
                <span><b>{profile!.name}</b><small>{t.subjects.join(', ')} · fit {result.score}</small></span>
                <i>★ {t.rating}<small>{t.reviewCount} reviews · {fmtMoney(t.rate)}/hr</small></i>
              </div>
              <div className="match-reason">
                <span>✦ {result.reasons.join(' · ')}</span>
                <div className="match-actions">
                  <button onClick={() => request(t.profileId)}>Request session →</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setReviewing(reviewing === t.profileId ? '' : t.profileId)}>Review</button>
                </div>
              </div>
              {reviewing === t.profileId && <ReviewForm tutorId={t.profileId} onDone={() => setReviewing('')} />}
            </div>
          ))}
        </div>
        <aside className="helper-card">
          <div className="helper-orbit">✦</div>
          <span className="eyebrow">PRIVATE HELPER</span>
          <h2>Good decisions,<br /><i>made simpler.</i></h2>
          <p>Preferences stay on your device. No ad network, no API key, no paid tier.</p>
          <b>✓ No paid upgrade</b>
          <b>✓ Works offline</b>
          <b>✓ Family-first privacy</b>
        </aside>
      </div>
    </div>
  )
}

function ReviewForm({ tutorId, onDone }: { tutorId: string; onDone: () => void }) {
  const { mutate } = useApp()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  const submit = () => {
    mutate((d) => {
      d.reviews.push({ id: uid(), tutorId, familyId: d.currentUserId ?? '', rating, comment: comment.trim(), createdAt: Date.now() })
      const t = d.tutors.find((x) => x.profileId === tutorId)
      if (t) {
        const all = d.reviews.filter((r) => r.tutorId === tutorId)
        t.rating = Math.round((all.reduce((s, r) => s + r.rating, 0) / all.length) * 10) / 10
        t.reviewCount = all.length
      }
    })
    if (getToken()) { void api.review(tutorId, rating, comment.trim()).catch(() => {}) }
    onDone()
  }

  return (
    <div className="review-form">
      <div className="stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>★</button>
        ))}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was the session?" />
      <div className="review-actions">
        <button className="btn btn-primary btn-sm" onClick={submit}>Post review</button>
        <button className="btn btn-ghost btn-sm" onClick={onDone}>Cancel</button>
      </div>
    </div>
  )
}

export function Sessions() {
  const { db, mutate } = useApp()
  const user = db.profiles.find((p) => p.id === db.currentUserId)
  if (!user) return null

  const family = db.families.find((f) => f.id === user.familyId)
  let sessions = db.sessions.slice().sort((a, b) => b.scheduledAt - a.scheduledAt)
  if (user.role === 'tutor') sessions = sessions.filter((s) => s.tutorId === user.id)
  else if (user.role === 'learner') sessions = sessions.filter((s) => s.learnerId === user.id)
  else if (family) sessions = sessions.filter((s) => s.familyId === family.id)

  const name = (id: string) => db.profiles.find((p) => p.id === id)?.name ?? 'Someone'
  const setStatus = (id: string, status: 'confirmed' | 'cancelled' | 'completed') => mutate((d) => {
    const s = d.sessions.find((x) => x.id === id)
    if (s) s.status = status
  })

  return (
    <div className="page-view">
      <div className="page-title">
        <div>
          <span className="eyebrow">SCHEDULE</span>
          <h1>Sessions.</h1>
          <p>Approve, track, and complete tutoring sessions — all in one place.</p>
        </div>
      </div>
      <div className="list">
        {sessions.length === 0 && <Empty>No sessions yet. Visit Matches to book one.</Empty>}
        {sessions.map((s) => (
          <div className="list-row" key={s.id}>
            <span className={`avatar ${avatarTone(name(s.tutorId))}`}>{initials(name(s.tutorId))}</span>
            <div className="list-main">
              <b>{s.subject}</b>
              <small>Tutor: {name(s.tutorId)} · Learner: {name(s.learnerId)} · {dayLabel(s.scheduledAt)} · {s.durationMin} min</small>
            </div>
            <Badge tone={statusTone(s.status)}>{s.status}</Badge>
            {user.role === 'parent' && s.status === 'requested' && <button className="btn btn-primary btn-sm" onClick={() => setStatus(s.id, 'confirmed')}>Approve</button>}
            {user.role === 'tutor' && s.status === 'confirmed' && <button className="btn btn-primary btn-sm" onClick={() => setStatus(s.id, 'completed')}>Complete</button>}
            {s.status !== 'cancelled' && s.status !== 'completed' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(s.id, 'cancelled')}>Cancel</button>}
          </div>
        ))}
      </div>
    </div>
  )
}

const HUB = { name: 'Northview Library', lat: 40.7128, lon: -74.006 }

export function CheckIn() {
  const { db, mutate } = useApp()
  const user = db.profiles.find((p) => p.id === db.currentUserId)
  const [state, setState] = useState<'idle' | 'checking' | 'inside' | 'outside' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  if (!user) return null

  const recent = db.checkIns.slice().reverse().slice(0, 6)

  const run = () => {
    setState('checking')
    setMsg('')
    if (!navigator.geolocation) {
      setState('error')
      setMsg('Geolocation is not available on this device. Use the simulate buttons below.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const inside = insideSafeZone(pos.coords.latitude, pos.coords.longitude, HUB.lat, HUB.lon)
        mutate((d) => { d.checkIns.push({ id: uid(), sessionId: '', role: user.role, insideZone: inside, at: Date.now() }) })
        setState(inside ? 'inside' : 'outside')
        setMsg(`You are ${inside ? 'inside' : 'outside'} the 50-metre safe zone around ${HUB.name}. Raw coordinates were discarded — only this yes/no result was stored.`)
      },
      (err) => {
        setState('error')
        setMsg(`Location unavailable (${err.message}). You can simulate a check-in below.`)
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  const simulate = (inside: boolean) => {
    mutate((d) => { d.checkIns.push({ id: uid(), sessionId: '', role: user.role, insideZone: inside, at: Date.now() }) })
    setState(inside ? 'inside' : 'outside')
    setMsg('Simulated result stored. No coordinates were ever saved.')
  }

  return (
    <div className="page-view">
      <div className="page-title">
        <div>
          <span className="eyebrow">SAFE-ZONE CHECK-IN</span>
          <h1>Check in.</h1>
          <p>Haversine math runs on your device. The app stores only inside/outside — never your location.</p>
        </div>
      </div>

      <div className="checkin-card">
        <div className="pulse" />
        <h2>{HUB.name}</h2>
        <p>50-metre safe zone · coordinates are never logged</p>
        <div className="checkin-actions">
          <button className="btn btn-primary" onClick={run} disabled={state === 'checking'}>{state === 'checking' ? 'Checking…' : 'Check in now'}</button>
          <button className="btn btn-ghost" onClick={() => simulate(true)}>Simulate inside</button>
          <button className="btn btn-ghost" onClick={() => simulate(false)}>Simulate outside</button>
        </div>
        {msg && <p className={`checkin-result ${state === 'inside' ? 'ok' : state === 'outside' ? 'warn' : ''}`}>{msg}</p>}
      </div>

      <SectionHeader eyebrow="RECENT" title="Check-in history" />
      <div className="list">
        {recent.length === 0 && <Empty>No check-ins yet.</Empty>}
        {recent.map((c) => (
          <div className="list-row" key={c.id}>
            <div className="list-main"><b>{c.insideZone ? 'Inside safe zone' : 'Outside safe zone'}</b><small>{dayLabel(c.at)} · as {c.role}</small></div>
            <Badge tone={c.insideZone ? 'green' : 'coral'}>{c.insideZone ? 'inside' : 'outside'}</Badge>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Ledger() {
  const { db, mutate } = useApp()
  const user = db.profiles.find((p) => p.id === db.currentUserId)
  const [amount, setAmount] = useState('')
  if (!user) return null
  const family = db.families.find((f) => f.id === user.familyId)
  if (!family) return <Empty>No family yet.</Empty>

  const txns = db.txns.filter((t) => t.familyId === family.id).slice().reverse()
  const isParent = user.role === 'parent'
  const pct = family.goalTarget > 0 ? Math.min(100, Math.round((family.goalSaved / family.goalTarget) * 100)) : 0
  const save = family.balance * 0.5
  const spend = family.balance * 0.3
  const give = family.balance * 0.2

  const add = () => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return
    mutate((d) => {
      const f = d.families.find((x) => x.id === family.id)
      if (f) {
        f.balance += amt
        d.txns.push({ id: uid(), familyId: family.id, tutorId: '', amount: amt, status: 'paid', note: 'Manual top-up', createdAt: Date.now() })
      }
    })
    setAmount('')
  }

  return (
    <div className="page-view">
      <div className="page-title">
        <div>
          <span className="eyebrow">POCKET MONEY</span>
          <h1>Money map.</h1>
          <p>Simple goals, a clear balance, and three jars: save, spend, give.</p>
        </div>
      </div>

      <div className="money-layout">
        <section>
          <div className="big-goal">
            <span className="eyebrow">YOUR ACTIVE GOAL</span>
            <h2>{family.goalName}</h2>
            <p>{fmtMoney(Math.max(0, family.goalTarget - family.goalSaved))} to go</p>
            <strong>{fmtMoney(family.goalSaved)} <small>of {fmtMoney(family.goalTarget)}</small></strong>
            <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          </div>
          <div className="money-columns">
            <b>Save jar<strong>{fmtMoney(save)}</strong><small>50% of balance</small></b>
            <b>Spend jar<strong>{fmtMoney(spend)}</strong><small>30% of balance</small></b>
            <b>Give jar<strong>{fmtMoney(give)}</strong><small>20% of balance</small></b>
          </div>
          {isParent && (
            <div className="card" style={{ marginTop: 15 }}>
              <div className="inline-form">
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount to add" />
                <button className="btn btn-primary" onClick={add}>Add money</button>
              </div>
            </div>
          )}
        </section>
        <aside className="settings-card">
          <span className="eyebrow">BALANCE</span>
          <h2>{fmtMoney(family.balance)}</h2>
          <p>Money is a ledger entry on your family account — safe, traceable, and reversible by a parent.</p>
        </aside>
      </div>

      <SectionHeader eyebrow="HISTORY" title="Transactions" />
      <div className="list">
        {txns.length === 0 && <Empty>No transactions yet.</Empty>}
        {txns.map((t) => (
          <div className="list-row" key={t.id}>
            <div className="list-main"><b>{t.note}</b><small>{dayLabel(t.createdAt)}</small></div>
            <span className="amount pos">+{fmtMoney(t.amount)}</span>
            <Badge tone={statusTone(t.status)}>{t.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Assistant() {
  const { db, mutate } = useApp()
  const [input, setInput] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  const reply = (t: string) => {
    const subjects = Array.from(new Set(db.tutors.flatMap((x) => x.subjects)))
    const hit = subjects.find((s) => t.toLowerCase().includes(s.toLowerCase()))
    return hit ? bestTutorReasoning(db.tutors, hit) : ask(t)
  }

  const send = (text: string) => {
    const t = text.trim()
    if (!t) return
    mutate((d) => {
      d.aiChat.push({ role: 'user', text: t, at: Date.now() })
      d.aiChat.push({ role: 'assistant', text: reply(t), at: Date.now() })
    })
    setInput('')
    setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }), 50)
  }

  const quick = ['How does pricing work?', 'Is my location stored?', 'How do I find a tutor?', 'Can I delete my data?']

  return (
    <div className="page-view">
      <div className="page-title">
        <div>
          <span className="eyebrow">AI ASSISTANT</span>
          <h1>Ask the<br /><i>PMFK helper.</i></h1>
          <p>Friendly answers about pricing, safety, parent controls, and privacy — fully offline, no API key.</p>
        </div>
        <div className="ai-badge">✦ <small>on-device<br /><b>No API key</b></small></div>
      </div>

      <div className="chat">
        <div className="chat-log" ref={logRef}>
          {db.aiChat.length === 0 && <p className="bubble ai">Hi! I'm the PMFK helper. Ask me anything about the app — pricing, safety, or how to find a great tutor.</p>}
          {db.aiChat.map((m, i) => (
            <p className={`bubble ${m.role === 'user' ? 'user' : 'ai'}`} key={i}>{m.text}</p>
          ))}
        </div>
        <div className="quick-chips">
          {quick.map((q) => <button className="chip" key={q} onClick={() => send(q)}>{q}</button>)}
        </div>
        <div className="chat-input">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(input) }} placeholder="Type your question…" />
          <button className="btn btn-primary" onClick={() => send(input)}>Send</button>
        </div>
      </div>
    </div>
  )
}
