import { useState } from 'react'
import { useApp } from '../lib/AppContext'
import { dayLabel } from '../lib/format'
import { Badge, SectionHeader, statusTone } from '../components'

export function Privacy() {
  const { db, mutate, cloud, eraseAccount } = useApp()
  const user = db.profiles.find((p) => p.id === db.currentUserId)
  const family = db.families.find((f) => f.id === user?.familyId)
  const [done, setDone] = useState('')

  const exportData = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pmfk-data-export.json'
    a.click()
    URL.revokeObjectURL(url)
    setDone('Export downloaded to your device.')
  }

  const erase = async () => {
    if (!window.confirm('Erase your account and all linked data everywhere? This cannot be undone.')) return
    await eraseAccount()
  }

  const revokeConsent = () => mutate((d) => {
    const f = d.families.find((x) => x.id === family?.id)
    if (f) f.consent = null
  })

  return (
    <div className="page-view">
      <div className="page-title">
        <div>
          <span className="eyebrow">TRUST CENTRE</span>
          <h1>Privacy,<br /><i>in plain language.</i></h1>
          <p>PMFK is designed around a parent's right to understand and control their family's information.</p>
        </div>
      </div>

      <div className="privacy-grid">
        <article>
          <b>01</b>
          <h2>Private by design</h2>
          <p>Public profiles use a chosen name and icon only. Guardian details and family records stay in a separate account area.</p>
          <strong>Identity stays with the family.</strong>
        </article>
        <article>
          <b>02</b>
          <h2>Location is ephemeral</h2>
          <p>Check-ins calculate the safe-zone result on the device. PMFK keeps only inside/outside, never a movement history.</p>
          <strong>We remember the result, not the route.</strong>
        </article>
        <article>
          <b>03</b>
          <h2>Control and erasure</h2>
          <p>A parent can close an account and request deletion. Adult learner profiles are scrubbed while required accounting records remain anonymous.</p>
          <strong>Your account is yours.</strong>
        </article>
      </div>

      <SectionHeader eyebrow="YOUR ACCOUNT" title="Consent & controls" />
      <p className="muted small" style={{ marginTop: 6 }}>{cloud ? '● Account synced to the PMFK cloud' : '● Stored on this device only — sign in to sync'}</p>
      <div className="card controls-card">
        <div className="controls-row">
          <div>
            <b>Parent consent</b>
            <p className="muted">{family?.consent ? `Recorded by ${family.consent.parentEmail} on ${dayLabel(family.consent.givenAt)}` : 'Not yet recorded — complete the consent screen.'}</p>
          </div>
          {family?.consent ? <Badge tone="green">recorded</Badge> : <Badge tone="yellow">pending</Badge>}
          {family?.consent && <button className="btn btn-ghost btn-sm" onClick={revokeConsent}>Revoke</button>}
        </div>
        <div className="controls-row">
          <div>
            <b>Export my data</b>
            <p className="muted">Download a full copy of everything stored on this device.</p>
          </div>
          <button className="btn btn-outline" onClick={exportData}>Export</button>
        </div>
        <div className="controls-row">
          <div>
            <b>Right to erasure</b>
            <p className="muted">Permanently delete this family's data from this device.</p>
          </div>
          <button className="btn btn-danger" onClick={erase}>Erase everything</button>
        </div>
        {done && <p className="auth-note">{done}</p>}
      </div>

      <SectionHeader eyebrow="SHARE PMFK" title="Ambassador program" />
      <div className="card controls-card">
        <div className="controls-row">
          <div>
            <b>Your referral code</b>
            <p className="muted">Share with other families at school. {db.referrals[0]?.signups ?? 0} families joined through you.</p>
          </div>
          <code className="referral-code">{db.referrals[0]?.code ?? 'PMFK-0000'}</code>
        </div>
      </div>
    </div>
  )
}

export function Admin() {
  const { db } = useApp()
  const name = (id: string) => db.profiles.find((p) => p.id === id)?.name ?? '—'

  return (
    <div className="page-view">
      <div className="page-title">
        <div>
          <span className="eyebrow">OWNER VIEW</span>
          <h1>Admin.</h1>
          <p>Read-only access for the app owner. This access is disclosed to families in the privacy policy.</p>
        </div>
      </div>
      <div className="admin-note">Owner access is disclosed, not hidden. Transaction records can be anonymized for accounting compliance while preserving totals.</div>

      <SectionHeader eyebrow="ACCOUNTS" title="Profiles" />
      <table className="table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
        <tbody>
          {db.profiles.map((p) => (
            <tr key={p.id}><td>{p.name}</td><td>{p.email}</td><td><Badge tone={p.role === 'parent' ? 'green' : p.role === 'tutor' ? 'yellow' : 'gray'}>{p.role}</Badge></td><td>{dayLabel(p.createdAt)}</td></tr>
          ))}
        </tbody>
      </table>

      <SectionHeader eyebrow="ACTIVITY" title="Sessions" />
      <table className="table">
        <thead><tr><th>Subject</th><th>Tutor</th><th>Learner</th><th>Status</th><th>When</th></tr></thead>
        <tbody>
          {db.sessions.map((s) => (
            <tr key={s.id}><td>{s.subject}</td><td>{name(s.tutorId)}</td><td>{name(s.learnerId)}</td><td><Badge tone={statusTone(s.status)}>{s.status}</Badge></td><td>{dayLabel(s.scheduledAt)}</td></tr>
          ))}
        </tbody>
      </table>

      <SectionHeader eyebrow="FINANCE" title="Transactions" />
      <table className="table">
        <thead><tr><th>Note</th><th>Amount</th><th>Status</th><th>When</th></tr></thead>
        <tbody>
          {db.txns.map((t) => (
            <tr key={t.id}><td>{t.note}</td><td>${t.amount.toFixed(2)}</td><td><Badge tone={statusTone(t.status)}>{t.status}</Badge></td><td>{dayLabel(t.createdAt)}</td></tr>
          ))}
        </tbody>
      </table>

      <SectionHeader eyebrow="LOCATION" title="Check-ins — no coordinates stored" />
      <table className="table">
        <thead><tr><th>Result</th><th>Role</th><th>When</th></tr></thead>
        <tbody>
          {db.checkIns.map((c) => (
            <tr key={c.id}><td><Badge tone={c.insideZone ? 'green' : 'coral'}>{c.insideZone ? 'inside' : 'outside'}</Badge></td><td>{c.role}</td><td>{dayLabel(c.at)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ConsentGate() {
  const { db, mutate } = useApp()
  const user = db.profiles.find((p) => p.id === db.currentUserId)
  const family = db.families.find((f) => f.id === user?.familyId)
  const [email, setEmail] = useState(user?.email ?? '')

  const agree = () => mutate((d) => {
    const f = d.families.find((x) => x.id === family?.id)
    if (f) f.consent = { parentEmail: email.trim() || user?.email || 'parent', givenAt: Date.now(), policyVersion: 1 }
  })

  const leave = () => mutate((d) => { d.currentUserId = null })

  return (
    <div className="consent-wrap">
      <div className="consent-card">
        <div className="brand-mark big">pmfk</div>
        <span className="eyebrow">PARENT CONSENT · COPPA &amp; GDPR</span>
        <h1>Before we begin</h1>
        <p>Because PMFK handles information about minors, every parent reviews and agrees before the family space opens.</p>
        <ul className="consent-list">
          <li><b>What we keep.</b> Names, a chosen icon, session bookings, the allowance ledger, and safe-zone yes/no check-ins.</li>
          <li><b>What we never store.</b> Precise location. No child profile is shared outside your family.</li>
          <li><b>Your rights.</b> Export or erase everything at any time. Adult profiles are scrubbed automatically.</li>
          <li><b>Owner access.</b> The app owner can view family data for support and safety — disclosed in the privacy policy.</li>
        </ul>
        <label className="field">Parent email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <div className="consent-actions">
          <button className="btn btn-primary" onClick={agree}>I agree as parent or guardian</button>
          <button className="btn btn-ghost" onClick={leave}>Not now</button>
        </div>
      </div>
    </div>
  )
}
