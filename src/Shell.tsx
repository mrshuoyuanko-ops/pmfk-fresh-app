import { useEffect, useState } from 'react'
import { AppProvider, useApp } from './lib/AppContext'
import { Auth } from './screens/Auth'
import { ParentDashboard, TutorDashboard, LearnerDashboard } from './screens/Dashboards'
import { Matches, Sessions, CheckIn, Ledger, Assistant } from './screens/Features'
import { Messages } from './screens/Messages'
import { Chores } from './screens/Chores'
import { Calendar } from './screens/Calendar'
import { Payments } from './screens/Payments'
import { Meeting } from './screens/Meeting'
import { Privacy, Admin, ConsentGate } from './screens/PrivacyAdmin'
import { cap } from './components'
import { avatarTone, initials } from './lib/format'
import type { Role } from './types'
import './App.css'
import './ui.css'

type View = 'Home' | 'Matches' | 'Sessions' | 'Messages' | 'Calendar' | 'Check-in' | 'Chores' | 'Ledger' | 'Payments' | 'Assistant' | 'Meeting' | 'Privacy' | 'Admin'

interface NavItem {
  view: View
  label: string
  icon: string
  roles: Role[]
}

const NAV: NavItem[] = [
  { view: 'Home', label: 'Home', icon: '⌂', roles: ['parent', 'tutor', 'learner'] },
  { view: 'Matches', label: 'Matches', icon: '✦', roles: ['parent', 'learner'] },
  { view: 'Sessions', label: 'Sessions', icon: '◷', roles: ['parent', 'tutor', 'learner'] },
  { view: 'Messages', label: 'Messages', icon: '✉', roles: ['parent', 'tutor', 'learner'] },
  { view: 'Calendar', label: 'Calendar', icon: '▦', roles: ['parent', 'tutor', 'learner'] },
  { view: 'Meeting', label: 'Live Lesson', icon: '▶', roles: ['parent', 'tutor', 'learner'] },
  { view: 'Check-in', label: 'Check-in', icon: '◎', roles: ['tutor', 'learner'] },
  { view: 'Chores', label: 'Chores', icon: '✓', roles: ['parent', 'learner'] },
  { view: 'Ledger', label: 'Money', icon: '◌', roles: ['parent', 'learner'] },
  { view: 'Payments', label: 'Payments', icon: '¤', roles: ['parent'] },
  { view: 'Assistant', label: 'PMFK Helper', icon: '◒', roles: ['parent', 'tutor', 'learner'] },
  { view: 'Privacy', label: 'Privacy', icon: '⌾', roles: ['parent', 'tutor', 'learner'] },
  { view: 'Admin', label: 'Admin', icon: '⚙', roles: ['parent'] },
]

const ROLES: Role[] = ['parent', 'tutor', 'learner']

function Shell() {
  const { db, mutate } = useApp()
  const [view, setView] = useState<View>('Home')
  const [mode, setMode] = useState<Role | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [route, setRoute] = useState(location.hash)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    const onHash = () => setRoute(location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const user = db.profiles.find((p) => p.id === db.currentUserId)
  if (!user) return <Auth />

  const family = db.families.find((f) => f.id === user.familyId)
  const activeMode = mode ?? user.role
  if (user.role === 'parent' && family && !family.consent) return <ConsentGate />
  if (route.startsWith('#/meeting')) return <Meeting />

  const items = NAV.filter((n) => n.roles.includes(activeMode))
  const signOut = () => mutate((d) => { d.currentUserId = null })
  const switchMode = (r: Role) => { setMode(r); setView('Home') }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">pmfk</div>
          <div><strong>pmfk</strong><small>learn. earn. grow.</small></div>
        </div>
        <div className="profile-switcher">
          <span className={`avatar ${avatarTone(user.name)}`}>{initials(user.name)}</span>
          <div><b>{user.name}</b><span>{family?.name ?? 'Account'}</span></div>
        </div>
        <div className="mode-switch">
          {ROLES.map((r) => (
            <button key={r} className={activeMode === r ? 'on' : ''} onClick={() => switchMode(r)}>{cap(r)}</button>
          ))}
        </div>
        <nav>
          {items.map((n) => (
            <button key={n.view} className={view === n.view ? 'nav-item active' : 'nav-item'} onClick={() => { if (n.view === 'Meeting') { location.hash = '#/meeting'; return } setView(n.view) }}>
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="offline-note">
            <i className={online ? 'online-dot' : 'offline-dot'} />
            {online ? 'Synced just now' : 'Offline mode'}
            <small>Your data stays on this device</small>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
          <div className="made-by">Made by <b>Shawn Kong</b></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <span>Workspace <b>/</b> <strong>{view}</strong></span>
          <div>
            <small className="sync-pill">● {online ? 'All changes saved' : 'Working offline'}</small>
            <button className="top-user">
              <span className={`avatar ${avatarTone(user.name)}`}>{initials(user.name)}</span>
              {user.name}⌄
            </button>
          </div>
        </header>
        <div className="content">
          {view === 'Home' && activeMode === 'parent' && <ParentDashboard />}
          {view === 'Home' && activeMode === 'tutor' && <TutorDashboard />}
          {view === 'Home' && activeMode === 'learner' && <LearnerDashboard />}
          {view === 'Matches' && <Matches />}
          {view === 'Sessions' && <Sessions />}
          {view === 'Messages' && <Messages />}
          {view === 'Calendar' && <Calendar />}
          {view === 'Check-in' && <CheckIn />}
          {view === 'Chores' && <Chores />}
          {view === 'Ledger' && <Ledger />}
          {view === 'Payments' && <Payments />}
          {view === 'Assistant' && <Assistant />}
          {view === 'Privacy' && <Privacy />}
          {view === 'Admin' && <Admin />}
        </div>
      </section>
    </main>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
