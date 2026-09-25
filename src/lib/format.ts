export const fmtMoney = (n: number) => '$' + (Math.round(n * 100) / 100).toFixed(2)

export const dayLabel = (ts: number) =>
  new Date(ts).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export const initials = (name: string) =>
  name.split(' ').map((s) => s[0]).filter(Boolean).join('').toUpperCase().slice(0, 2)

const TONES = ['coral', 'mint', 'yellow'] as const

export const avatarTone = (name: string): string => {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return TONES[hash % TONES.length]
}
