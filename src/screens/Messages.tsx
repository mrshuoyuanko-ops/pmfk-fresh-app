import { useState } from 'react'
import { useApp } from '../lib/AppContext'
import { uid } from '../lib/db'
import { dayLabel, avatarTone, initials } from '../lib/format'
import { Badge, Empty, statusTone } from '../components'

export function Messages() {
  const { db, mutate } = useApp()
  const user = db.profiles.find((p) => p.id === db.currentUserId)
  const [activeId, setActiveId] = useState('')
  const [draft, setDraft] = useState('')
  if (!user) return null

  const family = db.families.find((f) => f.id === user.familyId)
  let sessions = db.sessions.slice().sort((a, b) => b.scheduledAt - a.scheduledAt)
  if (user.role === 'tutor') sessions = sessions.filter((s) => s.tutorId === user.id)
  else if (user.role === 'learner') sessions = sessions.filter((s) => s.learnerId === user.id)
  else if (family) sessions = sessions.filter((s) => s.familyId === family.id)

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0]
  const name = (id: string) => db.profiles.find((p) => p.id === id)?.name ?? 'Someone'
  const messages = active ? db.messages.filter((m) => m.sessionId === active.id) : []

  const provider = (() => {
    const e = (user.email || '').toLowerCase()
    if (e.includes('gmail') || e.includes('googlemail')) return { name: 'Gmail', icon: '✉', accent: '#d14836' }
    if (e.includes('icloud') || e.includes('me.com') || e.includes('mac.com')) return { name: 'iMessage', icon: '💬', accent: '#0b93f6' }
    if (e.includes('outlook') || e.includes('hotmail') || e.includes('live.com') || e.includes('microsoft')) return { name: 'Outlook', icon: '✉', accent: '#0078d4' }
    return { name: 'Mail', icon: '✉', accent: '#1e5249' }
  })()
  const otherId = active ? (user.role === 'tutor' ? active.learnerId : active.tutorId) : ''
  const otherProfile = otherId ? db.profiles.find((p) => p.id === otherId) : undefined
  const otherEmail = (otherProfile?.email || '').replace(/\/child$/, '')
  const subject = encodeURIComponent(`PMFK — ${active?.subject ?? 'lesson'}`)
  const mailto = otherEmail && otherEmail.includes('@') ? `mailto:${otherEmail}?subject=${subject}` : ''
  const gmailCompose = otherEmail && otherEmail.includes('@') ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(otherEmail)}&su=${subject}` : ''

  const send = () => {
    const t = draft.trim()
    if (!t || !active) return
    mutate((d) => { d.messages.push({ id: uid(), sessionId: active.id, senderId: user.id, body: t, createdAt: Date.now() }) })
    setDraft('')
  }

  return (
    <div className="page-view">
      <div className="page-title">
        <div>
          <span className="eyebrow">MESSAGES</span>
          <h1>Stay in touch.</h1>
          <p>Messages are tied to each session and synced across devices when you're online.</p>
        </div>
      </div>

      <div className="mailbox-bar">
        <div className="mailbox-id">
          <span style={{ background: provider.accent }}>{provider.icon}</span>
          <div><b>{provider.name}</b><small>Linked mailbox</small></div>
        </div>
        {mailto && (
          <a className="btn btn-outline btn-sm" href={provider.name === 'Gmail' ? gmailCompose : mailto} target={provider.name === 'Gmail' ? '_blank' : undefined} rel="noreferrer">
            ✉ Compose in {provider.name}
          </a>
        )}
        <span className="muted small">In-app messages stay private in PMFK · compose opens your real {provider.name}.</span>
      </div>

      {sessions.length === 0 && <Empty>No sessions yet — book one in Matches to start a conversation.</Empty>}

      {sessions.length > 0 && (
        <div className="messages-layout">
          <div className="session-list">
            {sessions.map((s) => (
              <button key={s.id} className={active?.id === s.id ? 'session-item active' : 'session-item'} onClick={() => setActiveId(s.id)}>
                <span className={`avatar ${avatarTone(name(s.tutorId))}`}>{initials(name(s.tutorId))}</span>
                <div>
                  <b>{s.subject}</b>
                  <small>with {name(s.tutorId)}</small>
                </div>
                <Badge tone={statusTone(s.status)}>{s.status}</Badge>
              </button>
            ))}
          </div>
          <div className="chat">
            <div className="chat-log">
              {messages.length === 0 && <p className="bubble ai">Say hello — coordinate times, share a friendly note, or check on progress.</p>}
              {messages.map((m) => {
                const mine = m.senderId === user.id
                return (
                  <div className={`msg ${mine ? 'mine' : ''}`} key={m.id}>
                    <p className={`bubble ${mine ? 'user' : 'ai'}`}>{m.body}</p>
                    <small>{name(m.senderId)} · {dayLabel(m.createdAt)}</small>
                  </div>
                )
              })}
            </div>
            <div className="chat-input">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send() }} placeholder="Write a message…" />
              <button className="btn btn-primary" onClick={send}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
