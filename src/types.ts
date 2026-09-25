export type Role = 'parent' | 'tutor' | 'learner'

export interface Consent {
  parentEmail: string
  givenAt: number
  policyVersion: number
}

export interface Family {
  id: string
  name: string
  parentId: string
  memberIds: string[]
  consent: Consent | null
  balance: number
  goalName: string
  goalTarget: number
  goalSaved: number
}

export interface Profile {
  id: string
  name: string
  email: string
  role: Role
  familyId: string
  avatar: string
  birthYear?: number
  createdAt: number
}

export interface TutorInfo {
  profileId: string
  pseudonym: string
  subjects: string[]
  availability: string[]
  rate: number
  school: string
  bio: string
  verified: boolean
  rating: number
  reviewCount: number
}

export interface PaymentMethod {
  id: string
  kind: 'visa' | 'mastercard' | 'paypal' | 'token'
  label: string
  last4: string
  createdAt: number
}

export type SessionStatus = 'requested' | 'confirmed' | 'completed' | 'cancelled'

export interface Session {
  id: string
  tutorId: string
  learnerId: string
  familyId: string
  subject: string
  status: SessionStatus
  scheduledAt: number
  durationMin: number
}

export interface CheckIn {
  id: string
  sessionId: string
  role: Role
  insideZone: boolean
  at: number
}

export interface Txn {
  id: string
  familyId: string
  tutorId: string
  amount: number
  status: 'pending' | 'paid'
  note: string
  createdAt: number
}

export interface Message {
  id: string
  sessionId: string
  senderId: string
  body: string
  createdAt: number
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
  at: number
}

export interface Review {
  id: string
  tutorId: string
  familyId: string
  rating: number
  comment: string
  createdAt: number
}

export interface Chore {
  id: string
  familyId: string
  assigneeId: string
  title: string
  reward: number
  done: boolean
  createdAt: number
}

export interface Badge {
  id: string
  profileId: string
  key: string
  title: string
  emoji: string
  earnedAt: number
}

export interface Referral {
  id: string
  code: string
  signups: number
}

export interface DB {
  profiles: Profile[]
  families: Family[]
  tutors: TutorInfo[]
  sessions: Session[]
  checkIns: CheckIn[]
  txns: Txn[]
  messages: Message[]
  aiChat: ChatTurn[]
  reviews: Review[]
  chores: Chore[]
  badges: Badge[]
  referrals: Referral[]
  paymentMethods: PaymentMethod[]
  currentUserId: string | null
}
