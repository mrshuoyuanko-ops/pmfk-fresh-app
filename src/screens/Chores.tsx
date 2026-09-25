import { useState } from 'react'
import { useApp } from '../lib/AppContext'
import { uid } from '../lib/db'
import { fmtMoney, dayLabel } from '../lib/format'
import { Badge, Empty, SectionHeader } from '../components'

export function Chores() {
  const { db, mutate } = useApp()
  const user = db.profiles.find((p) => p.id === db.currentUserId)
  const [title, setTitle] = useState('')
  const [reward, setReward] = useState('1')
  if (!user) return null
  const family = db.families.find((f) => f.id === user.familyId)
  if (!family) return <Empty>No family yet.</Empty>

  const isParent = user.role === 'parent'
  const learner = family.memberIds.map((id) => db.profiles.find((p) => p.id === id)).find((p) => p?.role === 'learner')
  const chores = db.chores.filter((c) => c.familyId === family.id)
  const name = (id: string) => db.profiles.find((p) => p.id === id)?.name ?? 'Child'
  const doneCount = chores.filter((c) => c.done).length
  const earned = chores.filter((c) => c.done).reduce((s, c) => s + c.reward, 0)

  const add = () => {
    if (!title.trim()) return
    mutate((d) => { d.chores.push({ id: uid(), familyId: family.id, assigneeId: learner?.id ?? '', title: title.trim(), reward: parseFloat(reward) || 0, done: false, createdAt: Date.now() }) })
    setTitle('')
  }

  const toggle = (id: string, done: boolean) => mutate((d) => {
    const c = d.chores.find((x) => x.id === id)
    if (!c) return
    if (done && !c.done) {
      c.done = true
      const f = d.families.find((x) => x.id === family.id)
      if (f) {
        f.balance += c.reward
        f.goalSaved = Math.min(f.goalTarget, f.goalSaved + c.reward)
        d.txns.push({ id: uid(), familyId: family.id, tutorId: '', amount: c.reward, status: 'paid', note: `Chore: ${c.title}`, createdAt: Date.now() })
      }
    } else if (!done && c.done) {
      c.done = false
    }
  })

  return (
    <div className="page-view">
      <div className="page-title">
        <div>
          <span className="eyebrow">CHORES</span>
          <h1>Earn by helping.</h1>
          <p>Complete a chore to add its reward to the family wallet and the saving goal.</p>
        </div>
        <div className="chips">
          <span className="chip">{doneCount}/{chores.length} done</span>
          <span className="chip on">{fmtMoney(earned)} earned</span>
        </div>
      </div>

      {isParent && (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="inline-form">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New chore, e.g. Water the plants" />
            <input type="number" value={reward} onChange={(e) => setReward(e.target.value)} placeholder="Reward $" style={{ maxWidth: 110 }} />
            <button className="btn btn-primary" onClick={add}>Add chore</button>
          </div>
        </div>
      )}

      <SectionHeader eyebrow="TO-DO LIST" title="This week's chores" />
      <div className="list">
        {chores.length === 0 && <Empty>No chores yet. {isParent ? 'Add one above.' : 'Ask a parent to add some.'}</Empty>}
        {chores.map((c) => (
          <div className="list-row chore-row" key={c.id}>
            <button className={`check ${c.done ? 'done' : ''}`} onClick={() => toggle(c.id, !c.done)} aria-label={c.done ? 'Mark incomplete' : 'Mark complete'}>{c.done ? '✓' : ''}</button>
            <div className="list-main"><b className={c.done ? 'struck' : ''}>{c.title}</b><small>{name(c.assigneeId)} · added {dayLabel(c.createdAt)}</small></div>
            <span className="amount pos">+{fmtMoney(c.reward)}</span>
            <Badge tone={c.done ? 'green' : 'gray'}>{c.done ? 'done' : 'to do'}</Badge>
          </div>
        ))}
      </div>
    </div>
  )
}
