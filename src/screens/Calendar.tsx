import { useState } from 'react'
import { useApp } from '../lib/AppContext'
import { Badge, Empty, statusTone } from '../components'

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function Calendar() {
  const { db } = useApp()
  const user = db.profiles.find((p) => p.id === db.currentUserId)
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  if (!user) return null

  const family = db.families.find((f) => f.id === user.familyId)
  let sessions = db.sessions.slice()
  if (user.role === 'tutor') sessions = sessions.filter((s) => s.tutorId === user.id)
  else if (user.role === 'learner') sessions = sessions.filter((s) => s.learnerId === user.id)
  else if (family) sessions = sessions.filter((s) => s.familyId === family.id)

  const monday = new Date()
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + offset * 7)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  const isToday = (d: Date) => {
    const t = new Date()
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
  }

  const sessionsOn = (d: Date) => sessions.filter((s) => {
    const sd = new Date(s.scheduledAt)
    return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth() && sd.getDate() === d.getDate()
  })

  const name = (id: string) => db.profiles.find((p) => p.id === id)?.name ?? 'Tutor'
  const time = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="page-view">
      <div className="page-title">
        <div>
          <span className="eyebrow">LESSON CALENDAR</span>
          <h1>Your week,<br /><i>clearly planned.</i></h1>
          <p>Every lesson in one place. Tap a day to see its details.</p>
        </div>
        <div className="cal-nav">
          <button className="btn btn-ghost" onClick={() => setOffset((o) => o - 1)}>‹</button>
          <button className="btn btn-outline" onClick={() => { setOffset(0); setSelected(null) }}>Today</button>
          <button className="btn btn-ghost" onClick={() => setOffset((o) => o + 1)}>›</button>
        </div>
      </div>

      <div className="cal-grid">
        {days.map((d, i) => {
          const list = sessionsOn(d)
          const sel = selected === i
          return (
            <button key={i} className={`cal-day ${sel ? 'selected' : ''} ${isToday(d) ? 'today' : ''}`} onClick={() => setSelected(i)}>
              <b>{WEEK[i]}</b>
              <strong>{d.getDate()}</strong>
              <div className="cal-chips">
                {list.slice(0, 2).map((s) => (
                  <span className={`cal-chip t-${statusTone(s.status)}`} key={s.id}>{time(s.scheduledAt)} · {s.subject}</span>
                ))}
                {list.length > 2 && <span className="cal-more">+{list.length - 2} more</span>}
              </div>
            </button>
          )
        })}
      </div>

      {selected !== null && (
        <div style={{ marginTop: 22 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>{days[selected].toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
          <div className="list">
            {sessionsOn(days[selected]).length === 0 && <Empty>No lessons this day.</Empty>}
            {sessionsOn(days[selected]).map((s) => (
              <div className="list-row" key={s.id}>
                <div className="list-main">
                  <b>{s.subject}</b>
                  <small>{time(s.scheduledAt)} · {s.durationMin} min · with {name(s.tutorId)}</small>
                </div>
                <Badge tone={statusTone(s.status)}>{s.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
