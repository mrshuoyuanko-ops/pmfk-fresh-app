import type { ReactNode } from 'react'

export function StatCard({ tone, title, value, unit, detail }: { tone: string; title: string; value: string; unit?: string; detail?: string }) {
  return (
    <article className={`stat-card ${tone}`}>
      <span>{title}</span>
      <strong>
        {value}
        {unit && <small>{unit}</small>}
      </strong>
      {detail && <p>{detail}</p>}
    </article>
  )
}

export function Badge({ tone, children }: { tone: 'green' | 'yellow' | 'coral' | 'gray'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>
}

export function SectionHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  )
}

export function statusTone(status: string): 'green' | 'yellow' | 'coral' | 'gray' {
  if (status === 'confirmed' || status === 'paid' || status === 'completed') return 'green'
  if (status === 'requested' || status === 'pending') return 'yellow'
  if (status === 'cancelled') return 'coral'
  return 'gray'
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
