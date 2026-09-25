import type { TutorInfo } from '../types'

interface Rule {
  match: RegExp
  reply: string
}

const RULES: Rule[] = [
  { match: /price|cost|fee|pay|rate|charge/i, reply: 'Tutors set their own hourly rate and parents pay only after a completed session. PMFK itself never charges an upgrade fee.' },
  { match: /safe|safety|check.?in|zone|where|location/i, reply: 'Check-in confirms the tutor and learner are both inside the 50-metre safe zone. The app stores only a yes/no result — never your coordinates.' },
  { match: /parent|guardian|adult|mom|dad/i, reply: 'Parents get their own dashboard to approve tutors, watch the pocket-money ledger, and manage consent for their children.' },
  { match: /offline|internet|network|wifi|data/i, reply: 'PMFK works offline. Your family view, goals, and saved changes are kept on this device and sync when you reconnect.' },
  { match: /privacy|private|delete|erase|gdpr|coppa|export/i, reply: 'You control your data. A parent can export or delete the account any time, and adult profiles can be scrubbed automatically.' },
  { match: /tutor|match|find|subject|learn|study/i, reply: 'I match tutors by subject, price, and fit with the learner. Tell me the subject you want and I will narrow the list.' },
  { match: /allowance|pocket money|save|saving|goal|chore|jar/i, reply: 'Set a goal in the Money view, add a weekly allowance, and split earnings into save, spend, and give jars.' },
  { match: /login|sign|account|verify|google|apple|microsoft|phone|email/i, reply: 'Sign in with email, phone, Google, Apple, or Microsoft. One account works across parent, tutor, and learner modes.' },
]

const FALLBACK = 'Ask me about pricing, safety, parent controls, privacy, or finding a tutor.'

export function ask(q: string): string {
  for (const rule of RULES) {
    if (rule.match.test(q)) return rule.reply
  }
  return FALLBACK
}

export function bestTutorReasoning(tutors: TutorInfo[], subject: string): string {
  const scored = tutors
    .map((t) => ({ t, r: scoreTutor(t, subject) }))
    .sort((a, b) => b.r.score - a.r.score)
  const top = scored[0]
  if (!top) return `No tutors teach ${subject} yet — check back soon.`
  return `For ${subject}, I'd recommend ${top.t.pseudonym}: ${top.r.reasons.join(', ')}.`
}

export function scoreTutor(tutor: TutorInfo, subject: string): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 50
  if (subject && tutor.subjects.some((s) => s.toLowerCase().includes(subject.toLowerCase()))) {
    score += 30
    reasons.push(`teaches ${subject}`)
  }
  if (tutor.verified) {
    score += 10
    reasons.push('verified by the school network')
  }
  if (tutor.rate <= 16) {
    score += 5
    reasons.push('friendly rate')
  } else if (tutor.rate > 18) {
    score -= 5
  }
  reasons.push('experienced with younger learners')
  return { score: Math.max(0, Math.min(100, score)), reasons }
}
