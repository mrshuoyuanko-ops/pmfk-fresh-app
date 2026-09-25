import { useState } from 'react'
import { useApp } from '../lib/AppContext'
import { checkEmail } from '../lib/email'

export function Auth() {
  const { register, login, syncing } = useApp()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const emailCheck = checkEmail(email)

  const create = async () => {
    if (!name.trim()) { setError('Please enter your name.'); return }
    const check = checkEmail(email)
    if (!check.valid) { setError(check.label); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setError('')
    setBusy(true)
    try {
      await register(name.trim(), email.trim(), password)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the account.')
    } finally {
      setBusy(false)
    }
  }

  const signIn = async () => {
    if (!email.trim() || !password) { setError('Enter your email and password.'); return }
    setError('')
    setBusy(true)
    try {
      await login(email.trim().toLowerCase(), password)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  const oauth = (provider: string) => {
    setNote(`${provider} sign-in needs the cloud backend (coming soon). Email sign-in works fully offline right now — no server needed.`)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-hero">
          <div className="brand-mark big">pmfk</div>
          <h1>Pocket Money<br />For Kids.</h1>
          <p>One calm place for your family to learn, earn, and grow together — private by design, free forever.</p>
          <div className="auth-points">
            <span>✓ Works offline &amp; syncs</span>
            <span>✓ No ads · no paid upgrade</span>
            <span>✓ Parent, tutor &amp; learner in one app</span>
          </div>
          <p className="auth-credit">Created by <b>Shawn Kong</b></p>
        </div>
        <div className="auth-form">
          <span className="eyebrow">WELCOME</span>
          <h2>Start your family space</h2>
          <p className="muted">One account, kept safely on this device. Switch between parent, tutor, and learner anytime.</p>

          <label className="field">
            Your name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex" />
          </label>
          <label className="field">
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" />
            {email.trim() && (
              <small className="email-status" style={{ color: emailCheck.tone === 'error' ? '#d9534f' : emailCheck.tone === 'warn' ? '#b8860b' : '#2e9e5b' }}>{emailCheck.label}</small>
            )}
          </label>
          <label className="field">
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="current-password" />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button className="btn btn-primary" onClick={create} disabled={busy}>{busy ? 'Working…' : 'Create account'}</button>
          <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={signIn} disabled={busy}>Sign in instead</button>
          {syncing && <p className="auth-note">Syncing your account…</p>}

          <div className="divider"><span>or continue with</span></div>
          <div className="oauth-row">
            <button className="oauth-btn" onClick={() => oauth('Google')}>G <span>Google</span></button>
            <button className="oauth-btn" onClick={() => oauth('Apple')}> <span>Apple</span></button>
            <button className="oauth-btn" onClick={() => oauth('Microsoft')}>▢ <span>Microsoft</span></button>
          </div>
          {note && <p className="auth-note">{note}</p>}

          <p className="muted small">Made by <b>Shawn Kong</b> · your data is yours to keep or erase</p>
        </div>
      </div>
    </div>
  )
}
