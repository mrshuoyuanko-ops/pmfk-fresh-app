import { useState } from 'react'
import { useApp } from '../lib/AppContext'
import { fmtMoney, dayLabel, avatarTone, initials } from '../lib/format'
import { uid } from '../lib/db'
import type { Profile } from '../types'
import { Badge, Empty, SectionHeader, StatCard, cap, statusTone } from '../components'

export function ParentDashboard() {
  const { db, mutate } = useApp()
  const user = db.profiles.find((p) => p.id === db.currentUserId)
  const family = db.families.find((f) => f.id === user?.familyId)
  const [newName, setNewName] = useState('')
  const [allowance, setAllowance] = useState('')
  if (!user || !family) return null

  const members = family.memberIds.map((id) => db.profiles.find((p) => p.id === id)).filter((p): p is Profile => Boolean(p))
  const requests = db.sessions.filter((s) => s.familyId === family.id && s.status === 'requested')
  const upcoming = db.sessions.filter((s) => s.familyId === family.id && s.status === 'confirmed')
  const txns = db.txns.filter((t) => t.familyId === family.id).slice().reverse()
  const pct = family.goalTarget > 0 ? Math.min(100, Math.round((family.goalSaved / family.goalTarget) * 100)) : 0

  const tutorName = (id: string) => db.profiles.find((p) => p.id === id)?.name ?? 'Tutor'

  const confirm = (id: string) => mutate((d) => { const s = d.sessions.find((x) => x.id === id); if (s) s.status = 'confirmed' })
  const cancel = (id: string) => mutate((d) => { const s = d.sessions.find((x) => x.id === id); if (s) s.status = 'cancelled' })
  const addMember = () => {
    if (!newName.trim()) return
    mutate((d) => {
      const f = d.families.find((x) => x.id === family.id)
      const lid = uid()
      d.profiles.push({ id: lid, name: newName.trim(), email: `${newName.trim().toLowerCase().replace(/\s+/g, '.')}@pmfk.app`, role: 'learner', familyId: family.id, avatar: (newName.trim()[0] || 'L').toUpperCase(), birthYear: 2013, createdAt: Date.now() })
      f?.memberIds.push(lid)
    })
    setNewName('')
  }
  const addAllowance = () => {
    const amt = parseFloat(allowance)
    if (!amt || amt <= 0) return
    mutate((d) => {
      const f = d.families.find((x) => x.id === family.id)
      if (f) {
        f.balance += amt
        f.goalSaved = Math.min(f.goalTarget, f.goalSaved + amt)
        d.txns.push({ id: uid(), familyId: family.id, tutorId: '', amount: amt, status: 'paid', note: 'Weekly allowance', createdAt: Date.now() })
      }
    })
    setAllowance('')
  }

  return (
    <div className="page-view">
      <div className="page-title">
        <div>
          <span className="eyebrow">PARENT DASHBOARD</span>
          <h1>Good morning,<br /><i>{user.name}.</i></h1>
          <p>{family.name} · {members.length} members · consent {family.consent ? 'recorded' : 'pending'}</p>
        </div>
        <button className="coral-button" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}>Manage family</button>
      </div>

      <div className="dashboard-grid">
        <StatCard tone="mint-card" title="Family balance" value={fmtMoney(family.balance)} detail="Ready to allocate" />
        <StatCard tone="coral-card" title="Upcoming sessions" value={String(upcoming.length)} unit=" booked" detail={`${requests.length} waiting for approval`} />
        <StatCard tone="green-card" title="Saving goal" value={`${pct}`} unit="%" detail={`${fmtMoney(family.goalSaved)} of ${fmtMoney(family.goalTarget)}`} />
      </div>

      {requests.length > 0 && (
        <>
          <SectionHeader eyebrow="NEEDS YOUR OK" title="Session requests" />
          <div className="list">
            {requests.map((s) => (
              <div className="list-row" key={s.id}>
                <span className={`avatar ${avatarTone(tutorName(s.tutorId))}`}>{initials(tutorName(s.tutorId))}</span>
                <div className="list-main"><b>{tutorName(s.tutorId)}</b><small>{s.subject} · {dayLabel(s.scheduledAt)} · {s.durationMin} min</small></div>
                <Badge tone="yellow">requested</Badge>
                <button className="btn btn-primary btn-sm" onClick={() => confirm(s.id)}>Approve</button>
                <button className="btn btn-ghost btn-sm" onClick={() => cancel(s.id)}>Decline</button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="lower-grid">
        <section>
          <SectionHeader eyebrow="FAMILY MEMBERS" title="Who's in the family" />
          <div className="list">
            {members.map((m) => (
              <div className="list-row" key={m.id}>
                <span className={`avatar ${avatarTone(m.name)}`}>{initials(m.name)}</span>
                <div className="list-main"><b>{m.name}</b><small>{cap(m.role)} · {m.birthYear ? `${new Date().getFullYear() - m.birthYear} yrs old` : 'adult'}</small></div>
                <Badge tone={m.role === 'parent' ? 'green' : 'gray'}>{m.role}</Badge>
              </div>
            ))}
          </div>
          <div className="inline-form">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add a child's name" />
            <button className="btn btn-outline" onClick={addMember}>Add</button>
          </div>
        </section>
        <section>
          <SectionHeader eyebrow="POCKET MONEY" title="Weekly allowance" />
          <div className="card">
            <div className="inline-form">
              <input type="number" value={allowance} onChange={(e) => setAllowance(e.target.value)} placeholder="Amount" />
              <button className="btn btn-primary" onClick={addAllowance}>Add</button>
            </div>
            <p className="muted small">Added to the family balance and counted toward {family.goalName}.</p>
          </div>
          <SectionHeader eyebrow="RECENT" title="Transactions" />
          <div className="list">
            {txns.length === 0 && <Empty>No transactions yet.</Empty>}
            {txns.slice(0, 4).map((t) => (
              <div className="list-row" key={t.id}>
                <div className="list-main"><b>{t.note}</b><small>{dayLabel(t.createdAt)}</small></div>
                <span className={`amount ${t.amount >= 0 ? 'pos' : ''}`}>+{fmtMoney(t.amount)}</span>
                <Badge tone={statusTone(t.status)}>{t.status}</Badge>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export function TutorDashboard() {
  const { db, mutate } = useApp()
  const user = db.profiles.find((p) => p.id === db.currentUserId)
  const [subjects, setSubjects] = useState('Maths, English')
  const [rate, setRate] = useState('18')
  const [school, setSchool] = useState('')
  const [bio, setBio] = useState('')
  const [days, setDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  if (!user) return null

  const toggleDay = (d: string) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))

  const info = db.tutors.find((t) => t.profileId === user.id)

  if (!info) {
    return (
      <div className="page-view">
        <div className="page-title">
          <div>
            <span className="eyebrow">TUTOR MODE</span>
            <h1>Become a<br /><i>founding tutor.</i></h1>
            <p>A prestigious leadership role that builds real-world work experience — and helps a local learner grow.</p>
          </div>
        </div>
        <div className="card form-card">
          <label className="field">Subjects <small>comma separated</small><input value={subjects} onChange={(e) => setSubjects(e.target.value)} /></label>
          <div className="grid-2">
            <label className="field">Hourly rate ($)<input type="number" value={rate} onChange={(e) => setRate(e.target.value)} /></label>
            <label className="field">School<input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Northview Academy" /></label>
          </div>
          <label className="field">Short bio<textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell families why you love this subject." /></label>
          <label className="field">Available days</label>
          <div className="chips" style={{ marginBottom: 18 }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <button key={d} className={`chip ${days.includes(d) ? 'on' : ''}`} onClick={() => toggleDay(d)}>{d}</button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => mutate((d) => { d.tutors.push({ profileId: user.id, pseudonym: user.name, subjects: subjects.split(',').map((s) => s.trim()).filter(Boolean), availability: days, rate: parseFloat(rate) || 0, school: school.trim(), bio: bio.trim(), verified: false, rating: 5, reviewCount: 0 }) })}>Start tutoring</button>
        </div>
      </div>
    )
  }

  const sessions = db.sessions.filter((s) => s.tutorId === user.id)
  const upcoming = sessions.filter((s) => s.status === 'confirmed' || s.status === 'requested')
  const completed = sessions.filter((s) => s.status === 'completed').length
  const earnings = db.txns.filter((t) => t.tutorId === user.id && t.status === 'paid').reduce((sum, t) => sum + t.amount, 0)

  const complete = (id: string) => mutate((d) => {
    const s = d.sessions.find((x) => x.id === id)
    if (s) {
      s.status = 'completed'
      d.txns.push({ id: uid(), familyId: s.familyId, tutorId: user.id, amount: info.rate, status: 'paid', note: `${s.subject} session`, createdAt: Date.now() })
    }
  })

  return (
    <div className="page-view">
      <div className="page-title">
        <div>
          <span className="eyebrow">TUTOR DASHBOARD</span>
          <h1>You're teaching<br /><i>great things.</i></h1>
          <p>{info.school || 'Your school'} · {info.subjects.join(', ')}</p>
        </div>
        <div className="chips">{info.subjects.map((s) => <span className="chip" key={s}>{s}</span>)}</div>
      </div>

      <div className="dashboard-grid">
        <StatCard tone="green-card" title="Earnings" value={fmtMoney(earnings)} detail="Paid to your account" />
        <StatCard tone="mint-card" title="Upcoming" value={String(upcoming.length)} unit=" sessions" detail="Confirmed and requested" />
        <StatCard tone="yellow-card" title="Completed" value={String(completed)} unit=" sessions" detail={`Hourly rate ${fmtMoney(info.rate)}`} />
      </div>

      <SectionHeader eyebrow="YOUR SCHEDULE" title="Sessions" />
      <div className="list">
        {upcoming.length === 0 && <Empty>No upcoming sessions. Check Matches to get discovered.</Empty>}
        {upcoming.map((s) => (
          <div className="list-row" key={s.id}>
            <div className="list-main"><b>{s.subject}</b><small>{dayLabel(s.scheduledAt)} · {s.durationMin} min</small></div>
            <Badge tone={statusTone(s.status)}>{s.status}</Badge>
            {s.status === 'confirmed' && <button className="btn btn-primary btn-sm" onClick={() => complete(s.id)}>Mark done</button>}
          </div>
        ))}
      </div>
    </div>
  )
}

export function LearnerDashboard() {
  const { db } = useApp()
  const user = db.profiles.find((p) => p.id === db.currentUserId)
  const family = db.families.find((f) => f.id === user?.familyId)
  if (!user || !family) return null

  const learner = family.memberIds.map((id) => db.profiles.find((p) => p.id === id)).find((p) => p?.role === 'learner') ?? user
  const sessions = db.sessions.filter((s) => s.learnerId === learner.id)
  const upcoming = sessions.filter((s) => s.status === 'confirmed' || s.status === 'requested')
  const pct = family.goalTarget > 0 ? Math.min(100, Math.round((family.goalSaved / family.goalTarget) * 100)) : 0

  return (
    <div className="page-view">
      <div className="page-title">
        <div>
          <span className="eyebrow">LEARNER DASHBOARD</span>
          <h1>Small steps,<br /><i>big goals.</i></h1>
          <p>You've saved {fmtMoney(family.goalSaved)} toward {family.goalName}.</p>
        </div>
      </div>

      <div className="big-goal">
        <span className="eyebrow">YOUR ACTIVE GOAL</span>
        <h2>{family.goalName}</h2>
        <p>{fmtMoney(family.goalTarget - family.goalSaved)} to go</p>
        <strong>{fmtMoney(family.goalSaved)} <small>of {fmtMoney(family.goalTarget)}</small></strong>
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 15 }}>
        <StatCard tone="mint-card" title="Wallet balance" value={fmtMoney(family.balance)} detail="From allowance and rewards" />
        <StatCard tone="coral-card" title="Upcoming sessions" value={String(upcoming.length)} unit=" booked" detail="Learning streak growing" />
        <StatCard tone="yellow-card" title="Saving goal" value={`${pct}`} unit="%" detail="Keep going!" />
      </div>

      <SectionHeader eyebrow="COMING UP" title="Your sessions" />
      <div className="list">
        {upcoming.length === 0 && <Empty>Nothing booked yet. Ask a parent to find a tutor.</Empty>}
        {upcoming.map((s) => (
          <div className="list-row" key={s.id}>
            <div className="list-main"><b>{s.subject}</b><small>{dayLabel(s.scheduledAt)} · {s.durationMin} min</small></div>
            <Badge tone={statusTone(s.status)}>{s.status}</Badge>
          </div>
        ))}
      </div>

      <SectionHeader eyebrow="ACHIEVEMENTS" title="Badges earned" />
      <div className="badge-row">
        {db.badges.filter((b) => b.profileId === learner.id).length === 0 && <Empty>Badges appear as goals and habits grow.</Empty>}
        {db.badges.filter((b) => b.profileId === learner.id).map((b) => (
          <div className="badge-card" key={b.id}><span>{b.emoji}</span><b>{b.title}</b><small>{dayLabel(b.earnedAt)}</small></div>
        ))}
      </div>
    </div>
  )
}
