import { useState } from 'react'
import { useApp } from '../lib/AppContext'
import { fmtMoney } from '../lib/format'
import { uid } from '../lib/db'
import { Badge, SectionHeader } from '../components'
import type { PaymentMethod } from '../types'

const KINDS: { kind: PaymentMethod['kind']; label: string; icon: string }[] = [
  { kind: 'visa', label: 'Visa', icon: '💳' },
  { kind: 'mastercard', label: 'Mastercard', icon: '💳' },
  { kind: 'paypal', label: 'PayPal', icon: '🅿️' },
  { kind: 'token', label: 'PMFK Token', icon: '🪙' },
]

export function Payments() {
  const { db, mutate } = useApp()
  const user = db.profiles.find((p) => p.id === db.currentUserId)
  const family = db.families.find((f) => f.id === user?.familyId)
  const [kind, setKind] = useState<PaymentMethod['kind']>('visa')
  const [last4, setLast4] = useState('')
  const [amount, setAmount] = useState('20')
  if (!user || !family) return null

  const iconFor = (k: PaymentMethod['kind']) => KINDS.find((x) => x.kind === k)?.icon ?? '💳'

  const add = () => {
    const k = KINDS.find((x) => x.kind === kind)!
    mutate((d) => {
      d.paymentMethods.push({ id: uid(), kind, label: k.label, last4: kind === 'paypal' || kind === 'token' ? '••••' : last4.slice(-4) || '••••', createdAt: Date.now() })
    })
    setLast4('')
  }

  const topUp = () => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return
    mutate((d) => {
      const f = d.families.find((x) => x.id === family.id)
      if (f) {
        f.balance += amt
        d.txns.push({ id: uid(), familyId: family.id, tutorId: '', amount: amt, status: 'paid', note: 'Wallet top-up', createdAt: Date.now() })
      }
    })
  }

  return (
    <div className="page-view">
      <div className="page-title">
        <div>
          <span className="eyebrow">PAYMENTS</span>
          <h1>Pay, simply.</h1>
          <p>Visa, Mastercard, PayPal, and PMFK Tokens. No ads, no hidden fees — parents pay only for completed sessions.</p>
        </div>
      </div>

      <div className="money-layout">
        <section>
          <div className="big-goal">
            <span className="eyebrow">WALLET BALANCE</span>
            <h2>{fmtMoney(family.balance)}</h2>
            <p>Used to pay tutors after each completed lesson.</p>
            <div className="inline-form" style={{ marginTop: 18 }}>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" style={{ background: '#ffffff22', borderColor: '#ffffff33', color: '#fff' }} />
              <button className="btn btn-primary" onClick={topUp}>Top up wallet</button>
            </div>
          </div>

          <SectionHeader eyebrow="YOUR CARDS & WALLETS" title="Payment methods" />
          <div className="list">
            {db.paymentMethods.length === 0 && <p className="muted small" style={{ padding: '14px 4px' }}>No payment methods yet — add one below.</p>}
            {db.paymentMethods.map((m) => (
              <div className="list-row" key={m.id}>
                <div className="list-main"><b>{iconFor(m.kind)} {m.label}</b><small>ending in {m.last4}</small></div>
                <Badge tone="green">active</Badge>
              </div>
            ))}
          </div>
        </section>
        <aside className="settings-card">
          <span className="eyebrow">ADD A METHOD</span>
          <h2 style={{ fontSize: 20 }}>Link a card or wallet</h2>
          <div className="chips" style={{ margin: '14px 0' }}>
            {KINDS.map((k) => (
              <button key={k.kind} className={`chip ${kind === k.kind ? 'on' : ''}`} onClick={() => setKind(k.kind)}>{k.icon} {k.label}</button>
            ))}
          </div>
          {(kind === 'visa' || kind === 'mastercard') && (
            <label className="field">Card number<input value={last4} onChange={(e) => setLast4(e.target.value)} placeholder="1234 5678 9012 3456" inputMode="numeric" /></label>
          )}
          <button className="btn btn-primary" onClick={add}>Add method</button>
          <p className="muted small" style={{ marginTop: 14 }}>Real card processing is powered by Stripe when you connect your merchant account — the app never stores full card numbers.</p>
        </aside>
      </div>
    </div>
  )
}
