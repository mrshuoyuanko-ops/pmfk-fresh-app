// Email validation, disposable-email blocking, and role inference.
// All checks run on-device — nothing is sent to a server.

export type EmailRole = 'student' | 'tutor' | 'parent'

// Temporary / throwaway domains commonly used to bypass sign-ups.
const DISPOSABLE = new Set([
  'mailinator.com',
  '10minutemail.com',
  'guerrillamail.com',
  'tempmail.com',
  'temp-mail.org',
  'throwawaymail.com',
  'getnada.com',
  'yopmail.com',
  'sharklasers.com',
  'trashmail.com',
  'dispostable.com',
  'maildrop.cc',
  'moakt.com',
  'mytemp.email',
  'tempmailaddress.com',
  'spam4.me',
  'mailnesia.com',
  'fakeinbox.com',
  'mailcatch.com',
  'mintemail.com',
])

// Education-only top-level / second-level domains → student account.
const SCHOOL_TLDS = new Set([
  'edu',
  'edu.au',
  'edu.nz',
  'edu.sg',
  'edu.hk',
  'edu.cn',
  'edu.in',
  'ac.uk',
  'ac.nz',
  'ac.in',
  'sch.uk',
])

// Substrings that strongly suggest a school/student address.
const SCHOOL_HINTS = ['school', 'student', 'students', 'k12', 'college', 'university', 'academy', 'tafe', 'pupil']

// Substrings that suggest a tutor/coach address.
const TUTOR_HINTS = ['tutor', 'teach', 'coach']

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  if (!email) return false
  const re = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/
  if (!re.test(email)) return false
  const [local, domain] = email.split('@')
  if (!local || local.length > 64) return false
  if (!domain || domain.length > 253) return false
  if (!domain.includes('.')) return false
  const tld = domain.split('.').pop() || ''
  return tld.length >= 2
}

export function isDisposableEmail(email: string): boolean {
  const domain = (email.split('@')[1] || '').toLowerCase()
  return DISPOSABLE.has(domain)
}

// Best-effort, on-device inference of what kind of account an address belongs to.
export function detectRole(email: string): EmailRole {
  const domain = (email.split('@')[1] || '').toLowerCase()
  if (!domain) return 'parent'
  const tld = domain.split('.').pop() || ''

  if (SCHOOL_TLDS.has(tld) || SCHOOL_HINTS.some((k) => domain.includes(k))) return 'student'
  if (TUTOR_HINTS.some((k) => domain.includes(k))) return 'tutor'
  return 'parent'
}

export interface EmailCheck {
  valid: boolean
  disposable: boolean
  role: EmailRole
  label: string
  tone: 'error' | 'warn' | 'ok'
}

export function checkEmail(email: string): EmailCheck {
  const normalized = normalizeEmail(email)
  if (!normalized) {
    return { valid: false, disposable: false, role: 'parent', label: 'Enter your email address.', tone: 'error' }
  }
  if (!isValidEmail(normalized)) {
    return { valid: false, disposable: false, role: 'parent', label: 'That does not look like a valid email address.', tone: 'error' }
  }
  if (isDisposableEmail(normalized)) {
    return { valid: false, disposable: true, role: 'parent', label: 'Temporary email addresses are not allowed. Use a real email.', tone: 'error' }
  }
  const role = detectRole(normalized)
  if (role === 'student') {
    return { valid: true, disposable: false, role, label: 'Detected a school/student email — parents should use their own email to create the family account.', tone: 'warn' }
  }
  if (role === 'tutor') {
    return { valid: true, disposable: false, role, label: 'Detected a tutor email — you can switch to Tutor mode after signing in.', tone: 'ok' }
  }
  return { valid: true, disposable: false, role, label: 'Personal email — parent account.', tone: 'ok' }
}
