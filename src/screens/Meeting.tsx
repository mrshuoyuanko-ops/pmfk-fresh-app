import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ChangeEvent as ReactChangeEvent } from 'react'
import { useApp } from '../lib/AppContext'
import { API_BASE } from '../lib/api'
import { initials, avatarTone } from '../lib/format'

interface Peer { id: string; name: string }
interface ChatMsg { name: string; text: string }

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
const wsUrl = () => {
  if (API_BASE) return `${API_BASE.replace(/^http/, 'ws')}/ws`
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
}
const hashCode = () => (location.hash.match(/^#\/meeting\/([A-Za-z0-9]+)/) || [])[1] || ''
const COLORS = ['#1e5249', '#ed765e', '#eeb12f', '#2f7c9e', '#111111']

export function Meeting() {
  const { db } = useApp()
  const user = db.profiles.find((p) => p.id === db.currentUserId)
  const [inRoom, setInRoom] = useState(Boolean(hashCode()))
  const [code, setCode] = useState(hashCode())
  const [joinInput, setJoinInput] = useState(hashCode())
  const [error, setError] = useState('')
  const [members, setMembers] = useState<Peer[]>([])
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [draft, setDraft] = useState('')
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [raised, setRaised] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [raisedIds, setRaisedIds] = useState<Set<string>>(new Set())
  const [boardOn, setBoardOn] = useState(true)
  const [color, setColor] = useState('#1e5249')
  const [penSize, setPenSize] = useState(3)
  const [panel, setPanel] = useState<'board' | 'notes'>('board')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<{ name: string; from: string; dataUrl: string }[]>([])
  const [recording, setRecording] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localRef = useRef<HTMLVideoElement>(null)
  const remoteRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const screenRef = useRef<MediaStream | null>(null)
  const peerIdRef = useRef(uid())
  const remoteIdRef = useRef('')
  const hostRef = useRef(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 })
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const noteTimerRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const send = (msg: unknown) => { if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify(msg)) }
  const signal = (to: string, data: unknown) => send({ type: 'signal', to, data })

  const drawSegment = (x0: number, y0: number, x1: number, y1: number, c: string, s: number) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = c
    ctx.lineWidth = s
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
  }

  const createPC = () => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
    pcRef.current = pc
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => pc.addTrack(t, streamRef.current!))
    pc.onicecandidate = (e) => { if (e.candidate && remoteIdRef.current) signal(remoteIdRef.current, { type: 'ice', candidate: e.candidate }) }
    pc.ontrack = (e) => { if (remoteRef.current) remoteRef.current.srcObject = e.streams[0] }
    return pc
  }

  const initiate = async (to: string) => {
    remoteIdRef.current = to
    const pc = createPC()
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    signal(to, { type: 'offer', sdp: pc.localDescription })
  }

  const handleOffer = async (from: string, sdp: RTCSessionDescriptionInit) => {
    remoteIdRef.current = from
    const pc = createPC()
    await pc.setRemoteDescription(sdp)
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    signal(from, { type: 'answer', sdp: pc.localDescription })
  }

  function connect(roomCode: string, host: boolean) {
    hostRef.current = host
    setError('')
    setInRoom(true)
    setCode(roomCode)
    if (!navigator.onLine) {
      setError('Offline mode — live video needs the cloud backend. The whiteboard and notes still work.')
      return
    }
    const ws = new WebSocket(`${wsUrl()}?room=${roomCode}&id=${peerIdRef.current}&user=${encodeURIComponent(user?.name || 'Guest')}`)
    wsRef.current = ws
    ws.onopen = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        streamRef.current = s
        if (localRef.current) localRef.current.srcObject = s
      } catch {
        /* camera/mic denied — still join */
      }
    }
    ws.onmessage = (e) => {
      let m: { type: string; from?: string; name?: string; data?: { type?: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; x0?: number; y0?: number; x1?: number; y1?: number; color?: string; size?: number }; members?: Peer[]; text?: string; raised?: boolean; dataUrl?: string }
      try { m = JSON.parse(e.data as string) } catch { return }
      if (m.type === 'presence' && m.members) {
        setMembers(m.members)
        const others = m.members.filter((p) => p.id !== peerIdRef.current)
        if (hostRef.current && others.length > 0 && !remoteIdRef.current) void initiate(others[0].id)
      } else if (m.type === 'signal' && m.from && m.data) {
        if (m.data.type === 'offer' && m.data.sdp) void handleOffer(m.from, m.data.sdp)
        else if (m.data.type === 'answer' && m.data.sdp && pcRef.current) void pcRef.current.setRemoteDescription(m.data.sdp)
        else if (m.data.type === 'ice' && m.data.candidate && pcRef.current) void pcRef.current.addIceCandidate(m.data.candidate).catch(() => {})
      } else if (m.type === 'chat' && m.name) {
        setChat((c) => [...c, { name: m.name!, text: String(m.text || '') }])
      } else if (m.type === 'raise' && m.from && m.name) {
        setRaisedIds((prev) => { const n = new Set(prev); if (m.raised) n.add(m.from!); else n.delete(m.from!); return n })
      } else if (m.type === 'draw' && m.data) {
        drawSegment(m.data.x0 ?? 0, m.data.y0 ?? 0, m.data.x1 ?? 0, m.data.y1 ?? 0, m.data.color ?? '#111', m.data.size ?? 3)
      } else if (m.type === 'boardClear') {
        const ctx = canvasRef.current?.getContext('2d')
        if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      } else if (m.type === 'note') {
        setNotes(String(m.text || ''))
      } else if (m.type === 'file' && m.name) {
        setFiles((f) => [...f, { name: m.name!, from: m.from || 'Peer', dataUrl: m.dataUrl || '' }])
      }
    }
    ws.onclose = () => { setError('Live connection ended — the whiteboard and notes still work locally.') }
    ws.onerror = () => { setError('Live video needs the cloud backend — the whiteboard and notes still work offline.') }
  }

  useEffect(() => () => {
    wsRef.current?.close()
    pcRef.current?.close()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    screenRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  // Auto-join when opened from a shared #/meeting/CODE link
  useEffect(() => {
    const c = hashCode()
    if (c && !wsRef.current) connect(c, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    c.width = 1000
    c.height = 560
    const ctx = c.getContext('2d')
    if (ctx) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height) }
  }, [inRoom])

  if (!user) return null

  const createRoom = () => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase()
    location.hash = `#/meeting/${code}`
    connect(code, true)
  }
  const joinRoom = () => {
    const c = joinInput.trim().toUpperCase()
    if (!c) return
    location.hash = `#/meeting/${c}`
    connect(c, false)
  }
  const leave = () => { location.hash = '' }

  const toggleMute = () => {
    const next = !muted
    streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next })
    setMuted(next)
  }
  const toggleCam = () => {
    const next = !camOff
    streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !next })
    setCamOff(next)
  }
  const toggleRaise = () => {
    const next = !raised
    setRaised(next)
    send({ type: 'raise', raised: next })
  }
  const toggleShare = async () => {
    if (sharing) {
      screenRef.current?.getTracks().forEach((t) => t.stop())
      const cam = streamRef.current?.getVideoTracks()[0]
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video')
      if (sender && cam) await sender.replaceTrack(cam)
      setSharing(false)
    } else {
      try {
        const s = await navigator.mediaDevices.getDisplayMedia({ video: true })
        screenRef.current = s
        const sender = pcRef.current?.getSenders().find((x) => x.track?.kind === 'video')
        if (sender) await sender.replaceTrack(s.getVideoTracks()[0])
        setSharing(true)
      } catch { /* user cancelled */ }
    }
  }
  const sendChat = () => {
    const t = draft.trim()
    if (!t) return
    send({ type: 'chat', text: t })
    if (!wsRef.current || wsRef.current.readyState !== 1) {
      setChat((c) => [...c, { name: user?.name || 'You', text: t }])
    }
    setDraft('')
  }

  const boardPos = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }
  }
  const onDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const p = boardPos(e)
    drawingRef.current = { active: true, x: p.x, y: p.y }
    drawSegment(p.x, p.y, p.x, p.y, color, penSize)
  }
  const onMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const d = drawingRef.current
    if (!d.active) return
    const p = boardPos(e)
    drawSegment(d.x, d.y, p.x, p.y, color, penSize)
    send({ type: 'draw', data: { x0: d.x, y0: d.y, x1: p.x, y1: p.y, color, size: penSize } })
    drawingRef.current = { active: true, x: p.x, y: p.y }
  }
  const onUp = () => { drawingRef.current.active = false }
  const clearBoard = () => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    send({ type: 'boardClear' })
  }

  const toggleRecording = () => {
    if (recording) {
      recorderRef.current?.stop()
      setRecording(false)
      return
    }
    if (!streamRef.current) { setError('No camera or mic to record.'); return }
    chunksRef.current = []
    const rec = new MediaRecorder(streamRef.current)
    recorderRef.current = rec
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pmfk-lesson-${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(url)
    }
    rec.start()
    setRecording(true)
  }

  const onNotesChange = (v: string) => {
    setNotes(v)
    if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current)
    noteTimerRef.current = window.setTimeout(() => send({ type: 'note', text: v }), 500)
  }

  const onFileChange = (e: ReactChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2.5 * 1024 * 1024) { setError('File too large — keep it under 2.5 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      send({ type: 'file', name: file.name, dataUrl })
      setFiles((f) => [...f, { name: file.name, from: 'You', dataUrl }])
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const remote = members.find((m) => m.id !== peerIdRef.current)

  return (
    <div className="meet-full">
      {!inRoom ? (
        <div className="meet-lobby-full">
          <div className="meet-brand-big"><div className="brand-mark big">pmfk</div><div><b>PMFK</b><small>Live lessons</small></div></div>
          <h1>Meet your tutor,<br /><i>face to face.</i></h1>
          <p>Video, a shared whiteboard, screen share, raise-hand, and chat — built for 1-to-1 learning.</p>
          <div className="lobby-cards">
            <div className="card form-card">
              <h2>Start a lesson</h2>
              <p className="muted small">Creates a room with a 6-letter code to share.</p>
              <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={createRoom}>Create room</button>
            </div>
            <div className="card form-card">
              <h2>Join a lesson</h2>
              <p className="muted small">Enter the room code from your tutor.</p>
              <div className="inline-form" style={{ marginTop: 14 }}>
                <input value={joinInput} onChange={(e) => setJoinInput(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={6} />
                <button className="btn btn-primary" onClick={joinRoom}>Join</button>
              </div>
            </div>
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button className="btn btn-ghost" onClick={() => { location.hash = '' }}>← Back to app</button>
        </div>
      ) : (
        <div className="meet-room-full">
          <header className="meet-top">
            <div className="meet-brand-sm"><b>pmfk</b><span>Live lesson</span></div>
            <div className="meet-room-code">Room <b>{code}</b><small>{members.length} in room</small></div>
            <div className="meet-members">
              {members.map((m) => <span key={m.id} className={`avatar ${avatarTone(m.name)}`} title={m.name}>{initials(m.name)}{raisedIds.has(m.id) && <em className="hand">✋</em>}</span>)}
            </div>
            <button className="btn btn-danger btn-sm" onClick={leave}>Leave</button>
          </header>

          <div className="meet-stage">
            <div className="video-stack">
              <div className="video-tile">
                <video ref={localRef} autoPlay playsInline muted />
                <span className="video-label">You{sharing ? ' · sharing screen' : ''}</span>
              </div>
              {remote ? (
                <div className="video-tile">
                  <video ref={remoteRef} autoPlay playsInline />
                  <span className="video-label">{remote.name}</span>
                </div>
              ) : (
                <div className="video-tile waiting">
                  <div className="pulse" />
                  <p>Waiting for your tutor to join…</p>
                  <span>Share code {code}</span>
                </div>
              )}
            </div>

            {boardOn && (
              <div className="board">
                <div className="board-tabs">
                  <button className={panel === 'board' ? 'on' : ''} onClick={() => setPanel('board')}>Whiteboard</button>
                  <button className={panel === 'notes' ? 'on' : ''} onClick={() => setPanel('notes')}>Notes</button>
                </div>
                {panel === 'board' ? (
                  <>
                    <div className="board-tools">
                      {COLORS.map((c) => <button key={c} className={color === c ? 'swatch on' : 'swatch'} style={{ background: c }} onClick={() => setColor(c)} aria-label="pen colour" />)}
                      <button className={penSize === 2 ? 'tool on' : 'tool'} onClick={() => setPenSize(2)} aria-label="thin pen">•</button>
                      <button className={penSize === 6 ? 'tool on' : 'tool'} onClick={() => setPenSize(6)} aria-label="thick pen">●</button>
                      <button className="tool" onClick={clearBoard}>Clear</button>
                    </div>
                    <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} />
                  </>
                ) : (
                  <textarea className="notes-editor" value={notes} onChange={(e) => onNotesChange(e.target.value)} placeholder="Shared lesson notes — type and both sides see it live…" />
                )}
              </div>
            )}

            <div className="meet-side">
              {files.length > 0 && (
                <div className="files-row">
                  {files.map((f, i) => <a key={i} className="file-chip" href={f.dataUrl} download={f.name} title={`from ${f.from}`}>📎 {f.name}</a>)}
                </div>
              )}
              <div className="chat-log">
                {chat.length === 0 && <p className="bubble ai">Lesson chat — say hi or share notes.</p>}
                {chat.map((c, i) => <p className="bubble ai" key={i}><b>{c.name}:</b> {c.text}</p>)}
              </div>
              <div className="chat-input">
                <button className="attach" onClick={() => fileInputRef.current?.click()} title="Share a file">📎</button>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendChat() }} placeholder="Message the lesson…" />
                <button className="btn btn-primary" onClick={sendChat}>Send</button>
              </div>
              <input ref={fileInputRef} type="file" hidden onChange={onFileChange} />
            </div>
          </div>

          <footer className="meet-controls">
            <button className={muted ? 'ctl on' : 'ctl'} onClick={toggleMute}>{muted ? '🔇' : '🎙'} <span>Mute</span></button>
            <button className={camOff ? 'ctl on' : 'ctl'} onClick={toggleCam}>{camOff ? '🚫' : '📷'} <span>Camera</span></button>
            <button className={sharing ? 'ctl on' : 'ctl'} onClick={toggleShare}>🖥 <span>Share</span></button>
            <button className={boardOn ? 'ctl on' : 'ctl'} onClick={() => setBoardOn(!boardOn)}>▦ <span>Board</span></button>
            <button className={raised ? 'ctl on' : 'ctl'} onClick={toggleRaise}>✋ <span>Raise</span></button>
            <button className={recording ? 'ctl on' : 'ctl'} onClick={toggleRecording}>{recording ? '⏹' : '⏺'} <span>{recording ? 'Stop' : 'Record'}</span></button>
            <button className="ctl danger" onClick={leave}>📞 <span>Leave</span></button>
          </footer>
          {error && <p className="auth-error" style={{ padding: '0 20px' }}>{error}</p>}
        </div>
      )}
    </div>
  )
}
