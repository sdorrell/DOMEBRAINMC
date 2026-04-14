import { useState, useEffect, useRef, useCallback } from 'react';

type OracleState = 'idle' | 'thinking' | 'answering';
type ViewMode = 'oracle' | 'browse';

interface Particle {
  rainX: number;
  rainY: number;
  vy: number;
  targetX: number;
  targetY: number;
  char: string;
  charTimer: number;
  charInterval: number;
  brightness: number;
}

interface WisdomEntry {
  id?: string;
  title: string;
  insight: string;
  insight_type?: string;
  priority?: string;
  status?: string;
  evidence?: string;
  relevant_projects?: string[];
  relevant_team_members?: string[];
  tags?: string[];
  created_at?: string;
  run_date?: string;
}

interface ConversationTurn {
  question: string;
  answer: string;
  timestamp: Date;
}

const ORACLE_BASE = 'https://domebrain-production.up.railway.app';
const ORACLE_KEY: string = (typeof window !== 'undefined' && (window as any).__DOME_ENV__?.ORACLE_KEY) || '';

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  risk:          { label: '⚠ Risk',        color: '#f87171', bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.2)' },
  opportunity:   { label: '◆ Opportunity',  color: '#34d399', bg: 'rgba(52,211,153,0.07)',  border: 'rgba(52,211,153,0.2)' },
  strategic:     { label: '✦ Strategic',    color: '#a78bfa', bg: 'rgba(167,139,250,0.07)', border: 'rgba(167,139,250,0.2)' },
  pattern:       { label: '◈ Pattern',      color: '#60a5fa', bg: 'rgba(96,165,250,0.07)',  border: 'rgba(96,165,250,0.2)' },
  anomaly:       { label: '⊗ Anomaly',      color: '#fb923c', bg: 'rgba(251,146,60,0.07)',  border: 'rgba(251,146,60,0.2)' },
  cross_project: { label: '⊕ Cross-Project',color: '#fbbf24', bg: 'rgba(251,191,36,0.07)',  border: 'rgba(251,191,36,0.2)' },
};
const TYPE_ALL = 'all';

const MATRIX_CHARS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' +
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモ' +
  '∑∆Ω∞∂∇◈◆◇✦✧★☆♦♣♠⌬⊕⊗∮≡≈≠';

function randChar() {
  return MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
}

function buildFigurePoints(w: number, h: number): { x: number; y: number }[] {
  const cx = w * 0.5;
  const cy = h * 0.46;
  const s = Math.min(w, h) * 0.31;
  const pts: { x: number; y: number }[] = [];

  for (let i = 0; i < 52; i++) {
    const a = (i / 52) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * s * 0.29, y: cy - s * 0.53 + Math.sin(a) * s * 0.09 });
  }
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * s * 0.22, y: cy - s * 0.53 + Math.sin(a) * s * 0.065 });
  }
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * s * 0.085, y: cy - s * 0.34 + Math.sin(a) * s * 0.105 });
  }
  for (let i = 0; i < 10; i++) {
    pts.push({ x: cx + ((i / 9) - 0.5) * s * 0.08, y: cy - s * 0.215 });
  }
  for (let i = 0; i < 24; i++) {
    const t = (i / 23) - 0.5;
    pts.push({ x: cx + t * s * 0.52, y: cy - s * 0.175 + t * t * s * 0.07 });
  }
  for (let row = 0; row < 18; row++) {
    const t = row / 17;
    const y = cy - s * 0.13 + t * s * 0.68;
    const hw = s * (0.17 + t * 0.32);
    const n = Math.floor(8 + t * 16);
    for (let i = 0; i < n; i++) {
      const frac = i / (n - 1);
      const px = cx + (frac - 0.5) * hw * 2;
      const edgeness = Math.abs(frac - 0.5) * 2;
      const wave = edgeness > 0.65 ? Math.sin(t * Math.PI * 5 + i * 0.4) * s * 0.018 : 0;
      pts.push({ x: px + wave, y });
    }
  }
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    pts.push({ x: cx - s * (0.23 + t * 0.25), y: cy + s * (-0.14 + t * 0.12) });
  }
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    pts.push({ x: cx + s * (0.23 + t * 0.25), y: cy + s * (-0.14 + t * 0.12) });
  }
  const rayCY = cy - s * 0.08;
  for (let ray = 0; ray < 12; ray++) {
    const baseAngle = (ray / 12) * Math.PI * 2;
    for (let i = 5; i < 14; i++) {
      const r = s * (0.3 + i * 0.044);
      const jitter = (Math.random() - 0.5) * 0.07;
      pts.push({ x: cx + Math.cos(baseAngle + jitter) * r, y: rayCY + Math.sin(baseAngle + jitter) * r });
    }
  }
  return pts;
}

export default function WisdomOracle({ currentUserId }: { currentUserId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<OracleState>('idle');
  const particlesRef = useRef<Particle[]>([]);
  const figurePointsRef = useRef<{ x: number; y: number }[]>([]);
  const convergenceRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const thinkOscRef = useRef<OscillatorNode[]>([]);

  // Oracle state
  const [question, setQuestion] = useState('');
  const [oracleState, setOracleState] = useState<OracleState>('idle');
  const [oracleAnswer, setOracleAnswer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('Seek knowledge from the DOME Oracle...');
  const [answerVisible, setAnswerVisible] = useState(false);

  // Conversation state
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  // Browse state
  const [viewMode, setViewMode] = useState<ViewMode>('oracle');
  const [wisdomEntries, setWisdomEntries] = useState<WisdomEntry[]>([]);
  const [wisdomFilter, setWisdomFilter] = useState<string>(TYPE_ALL);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [wisdomLoading, setWisdomLoading] = useState(false);

  // ── Fetch wisdom entries ────────────────────────────────────────────────────
  const fetchWisdom = useCallback(async () => {
    setWisdomLoading(true);
    try {
      const res = await fetch(`${ORACLE_BASE}/wisdom`, {
        headers: { 'Authorization': `Bearer ${ORACLE_KEY}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWisdomEntries(Array.isArray(data) ? data : []);
      }
    } catch {}
    setWisdomLoading(false);
  }, []);

  useEffect(() => {
    if (viewMode === 'browse' && wisdomEntries.length === 0) {
      fetchWisdom();
    }
  }, [viewMode, wisdomEntries.length, fetchWisdom]);

  // ── Init particles ──────────────────────────────────────────────────────────
  const initParticles = useCallback((w: number, h: number) => {
    const COUNT = 300;
    const figPts = buildFigurePoints(w, h);
    figurePointsRef.current = figPts;
    particlesRef.current = Array.from({ length: COUNT }, (_, i) => ({
      rainX: Math.random() * w,
      rainY: Math.random() * h,
      vy: 0.9 + Math.random() * 2.8,
      targetX: figPts[i % figPts.length].x,
      targetY: figPts[i % figPts.length].y,
      char: randChar(),
      charTimer: Math.floor(Math.random() * 10),
      charInterval: 5 + Math.floor(Math.random() * 12),
      brightness: 0.35 + Math.random() * 0.65,
    }));
  }, []);

  // ── Animation loop ──────────────────────────────────────────────────────────
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const state = stateRef.current;
    const now = Date.now();

    ctx.fillStyle = 'rgba(5, 5, 16, 0.17)';
    ctx.fillRect(0, 0, W, H);

    const targetConv = state === 'idle' ? 0 : 1;
    const lerp = state === 'idle' ? 0.022 : 0.032;
    convergenceRef.current += (targetConv - convergenceRef.current) * lerp;
    const c = convergenceRef.current;

    particlesRef.current.forEach((p, idx) => {
      p.rainY += p.vy;
      if (p.rainY > H + 24) { p.rainY = -24; p.rainX = Math.random() * W; }
      p.charTimer++;
      if (p.charTimer >= p.charInterval) {
        p.charTimer = 0;
        p.char = randChar();
        p.charInterval = state === 'idle' ? 5 + Math.floor(Math.random() * 12) : 10 + Math.floor(Math.random() * 20);
      }
      const drawX = p.rainX + (p.targetX - p.rainX) * c;
      const drawY = p.rainY + (p.targetY - p.rainY) * c;
      let r = 0, g = 0, b = 0, a = 0;
      if (state === 'answering' && c > 0.55) {
        const convT = Math.min(1, (c - 0.55) / 0.45);
        const pulse = 0.45 + 0.55 * Math.sin(now * 0.0024 + idx * 0.09);
        const mix = convT * pulse;
        r = 255; g = Math.floor(120 + 135 * mix); b = 0;
        a = (0.5 + 0.5 * mix) * p.brightness;
      } else if (c > 0.08) {
        const t = Math.min(1, c / 0.75);
        r = Math.floor(60 + t * 120); g = Math.floor(170 + t * 85); b = Math.floor(190 + t * 65);
        a = (0.45 + t * 0.45) * p.brightness;
      } else {
        const lead = idx % 8 === 0; const bright = idx % 3 === 0;
        r = 0; g = lead ? 240 : bright ? 100 + Math.floor(Math.random() * 80) : 50 + Math.floor(Math.random() * 50);
        b = lead ? 40 : 0; a = lead ? 0.95 : bright ? 0.6 : 0.35;
      }
      const sz = 11 + (c > 0.4 ? Math.floor(c * 3) : 0);
      ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, a).toFixed(2)})`;
      ctx.font = `${sz}px monospace`;
      ctx.fillText(p.char, drawX, drawY);
    });

    if (state === 'answering' && c > 0.45) {
      const intensity = Math.min(1, (c - 0.45) / 0.55) * (0.65 + 0.35 * Math.sin(now * 0.0018));
      const grd = ctx.createRadialGradient(W / 2, H * 0.46, 0, W / 2, H * 0.46, Math.min(W, H) * 0.45);
      grd.addColorStop(0, `rgba(255, 210, 0, ${(0.14 * intensity).toFixed(2)})`);
      grd.addColorStop(0.4, `rgba(255, 130, 0, ${(0.06 * intensity).toFixed(2)})`);
      grd.addColorStop(1, 'rgba(255, 80, 0, 0)');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    }
    if (state === 'thinking' && c > 0.3) {
      const pulse = 0.3 + 0.7 * ((Math.sin(now * 0.003) + 1) / 2);
      const rad = Math.min(W, H) * (0.28 + pulse * 0.06);
      ctx.beginPath(); ctx.arc(W / 2, H * 0.46, rad, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(100, 200, 255, ${(0.08 * pulse * c).toFixed(2)})`;
      ctx.lineWidth = 1.5; ctx.stroke();
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width; canvas.height = rect.height;
      initParticles(canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);
    animFrameRef.current = requestAnimationFrame(animate);
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animFrameRef.current); };
  }, [animate, initParticles]);

  // ── Audio helpers ───────────────────────────────────────────────────────────
  const getCtx = () => {
    const w = window as typeof window & { __domeAudioCtx?: AudioContext };
    if (!w.__domeAudioCtx) {
      w.__domeAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (w.__domeAudioCtx.state === 'suspended') w.__domeAudioCtx.resume();
    audioCtxRef.current = w.__domeAudioCtx;
    return w.__domeAudioCtx;
  };
  const playThinking = () => {
    try {
      const ctx = getCtx();
      thinkOscRef.current.forEach(o => { try { o.stop(); } catch {} });
      thinkOscRef.current = [];
      [82.4, 110, 164.8, 220, 293.7].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(freq * 1.62, ctx.currentTime + 4.5);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 1.0);
        osc.connect(gain); gain.connect(ctx.destination); osc.start();
        thinkOscRef.current.push(osc);
      });
    } catch {}
  };
  const stopThinking = () => {
    const ctx = audioCtxRef.current;
    thinkOscRef.current.forEach(o => { try { o.stop(ctx ? ctx.currentTime + 0.5 : 0); } catch {} });
    thinkOscRef.current = [];
  };
  const playAnswer = () => {
    try {
      const ctx = getCtx();
      [528, 660, 792, 990, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.16;
        gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.07, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 3.2);
        osc.connect(gain); gain.connect(ctx.destination); osc.start(t); osc.stop(t + 3.5);
      });
      const sw = ctx.createOscillator(); const swg = ctx.createGain();
      sw.type = 'triangle';
      sw.frequency.setValueAtTime(1600, ctx.currentTime + 0.5);
      sw.frequency.exponentialRampToValueAtTime(6000, ctx.currentTime + 2.0);
      swg.gain.setValueAtTime(0, ctx.currentTime + 0.5); swg.gain.linearRampToValueAtTime(0.022, ctx.currentTime + 0.8);
      swg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
      sw.connect(swg); swg.connect(ctx.destination); sw.start(ctx.currentTime + 0.5); sw.stop(ctx.currentTime + 2.8);
    } catch {}
  };

  // ── Ask the Oracle ──────────────────────────────────────────────────────────
  const handleAsk = async () => {
    if (!question.trim() || isLoading || oracleState !== 'idle') return;
    const asked = question.trim();
    setQuestion('');
    setIsLoading(true); setOracleAnswer(null); setAnswerVisible(false);
    stateRef.current = 'thinking'; setOracleState('thinking');
    setStatusText('The Oracle channels the depths of DOME knowledge...');
    playThinking();
    try {
      // Build history for Claude from prior turns
      const history: { role: string; content: string }[] = [];
      conversation.forEach(t => {
        history.push({ role: 'user', content: t.question });
        history.push({ role: 'assistant', content: t.answer });
      });

      const [res] = await Promise.all([
        fetch(`${ORACLE_BASE}/oracle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ORACLE_KEY}` },
          body: JSON.stringify({
            question: asked,
            history,
            session_id: sessionId ?? undefined,
          }),
        }),
        new Promise(r => setTimeout(r, 3000)),
      ]);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Oracle server error ${res.status}`);
      }
      const { answer, session_id } = await res.json();
      stopThinking(); playAnswer();
      stateRef.current = 'answering'; setOracleState('answering');
      setStatusText('The Oracle has spoken.');
      setOracleAnswer(answer);
      if (session_id && !sessionId) setSessionId(session_id);
      // Append to conversation thread
      const turn: ConversationTurn = { question: asked, answer, timestamp: new Date() };
      setConversation(prev => [...prev, turn]);
      setTimeout(() => setAnswerVisible(true), 400);
      setTimeout(() => {
        stateRef.current = 'idle'; setOracleState('idle');
        setStatusText('Continue the conversation or ask something new...');
        setAnswerVisible(false);
        setTimeout(() => setOracleAnswer(null), 800);
      }, 18000);
    } catch (err: any) {
      stopThinking(); stateRef.current = 'idle'; setOracleState('idle');
      setStatusText(`Oracle unreachable: ${err?.message ?? 'unknown error'}. Try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── New conversation ────────────────────────────────────────────────────────
  const handleNewConversation = () => {
    setConversation([]);
    setSessionId(null);
    setOracleAnswer(null);
    setAnswerVisible(false);
    stateRef.current = 'idle'; setOracleState('idle');
    setStatusText('Seek knowledge from the DOME Oracle...');
  };

  // ── Auto-scroll to latest answer ─────────────────────────────────────────
  useEffect(() => {
    if (conversation.length > 0) {
      setTimeout(() => conversationEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);
    }
  }, [conversation.length]);

  // ── Derived browse data ─────────────────────────────────────────────────────
  const filteredEntries = wisdomFilter === TYPE_ALL
    ? wisdomEntries
    : wisdomEntries.filter(e => e.insight_type === wisdomFilter);

  const availableTypes = Array.from(new Set(wisdomEntries.map(e => e.insight_type ?? 'other').filter(Boolean)));

  // ── State colors ────────────────────────────────────────────────────────────
  const STATE_LABEL: Record<OracleState, string> = { idle: 'DORMANT', thinking: 'CHANNELING', answering: 'ORACLE SPEAKS' };
  const STATE_COLOR: Record<OracleState, string> = { idle: '#374151', thinking: '#60a5fa', answering: '#fbbf24' };

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #04040e 0%, #060612 100%)' }}>

      {/* ── Status / nav bar ─────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.4)' }}>
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: STATE_COLOR[oracleState], boxShadow: `0 0 8px ${STATE_COLOR[oracleState]}`, animation: oracleState === 'thinking' ? 'pulse 0.7s ease-in-out infinite alternate' : undefined }} />
        <span className="text-[10px] tracking-widest font-bold shrink-0" style={{ color: STATE_COLOR[oracleState] }}>{STATE_LABEL[oracleState]}</span>
        {viewMode === 'oracle' && <span className="text-[10px] text-gray-600 truncate">{statusText}</span>}

        {/* View toggle */}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button
            onClick={() => setViewMode('oracle')}
            className="text-[10px] tracking-widest px-2.5 py-1 rounded-lg transition-all"
            style={{
              background: viewMode === 'oracle' ? 'rgba(99,102,241,0.2)' : 'transparent',
              border: `1px solid ${viewMode === 'oracle' ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`,
              color: viewMode === 'oracle' ? '#a5b4fc' : '#4b5563',
            }}
          >
            ✦ Oracle
          </button>
          <button
            onClick={() => setViewMode('browse')}
            className="text-[10px] tracking-widest px-2.5 py-1 rounded-lg transition-all"
            style={{
              background: viewMode === 'browse' ? 'rgba(251,191,36,0.12)' : 'transparent',
              border: `1px solid ${viewMode === 'browse' ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.06)'}`,
              color: viewMode === 'browse' ? '#fbbf24' : '#4b5563',
            }}
          >
            ◈ Wisdom Log {wisdomEntries.length > 0 && `(${wisdomEntries.length})`}
          </button>
        </div>
      </div>

      {/* ── BROWSE VIEW ──────────────────────────────────────────────────────── */}
      {viewMode === 'browse' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Filter tabs */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 overflow-x-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.3)' }}>
            <button
              onClick={() => setWisdomFilter(TYPE_ALL)}
              className="shrink-0 text-[10px] tracking-wider px-2.5 py-1 rounded-lg transition-all"
              style={{
                background: wisdomFilter === TYPE_ALL ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: `1px solid ${wisdomFilter === TYPE_ALL ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)'}`,
                color: wisdomFilter === TYPE_ALL ? '#e2e8f0' : '#4b5563',
              }}
            >
              All ({wisdomEntries.length})
            </button>
            {availableTypes.map(type => {
              const cfg = TYPE_CONFIG[type] ?? { label: type, color: '#9ca3af', bg: 'rgba(156,163,175,0.07)', border: 'rgba(156,163,175,0.2)' };
              const count = wisdomEntries.filter(e => e.insight_type === type).length;
              return (
                <button
                  key={type}
                  onClick={() => setWisdomFilter(type)}
                  className="shrink-0 text-[10px] tracking-wider px-2.5 py-1 rounded-lg transition-all"
                  style={{
                    background: wisdomFilter === type ? cfg.bg : 'transparent',
                    border: `1px solid ${wisdomFilter === type ? cfg.border : 'rgba(255,255,255,0.05)'}`,
                    color: wisdomFilter === type ? cfg.color : '#4b5563',
                  }}
                >
                  {cfg.label} ({count})
                </button>
              );
            })}
            <button
              onClick={fetchWisdom}
              className="shrink-0 ml-auto text-[10px] px-2.5 py-1 rounded-lg transition-all"
              style={{ border: '1px solid rgba(255,255,255,0.06)', color: '#374151' }}
              title="Refresh"
            >
              ↻
            </button>
          </div>

          {/* Entries list */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
            {wisdomLoading && (
              <div className="flex items-center justify-center py-16">
                <span className="text-[11px] tracking-widest text-gray-600 animate-pulse">LOADING WISDOM...</span>
              </div>
            )}
            {!wisdomLoading && filteredEntries.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <span className="text-2xl opacity-20">◈</span>
                <span className="text-[11px] tracking-widest text-gray-600">No wisdom entries yet</span>
                <span className="text-[10px] text-gray-700">Run the nightly synthesis or ask the Oracle a question</span>
              </div>
            )}
            {!wisdomLoading && filteredEntries.map(entry => {
              const type = entry.insight_type ?? 'other';
              const cfg = TYPE_CONFIG[type] ?? { label: type, color: '#9ca3af', bg: 'rgba(156,163,175,0.07)', border: 'rgba(156,163,175,0.15)' };
              const isExpanded = expandedId === (entry.id ?? entry.title);
              const dateStr = entry.run_date ?? entry.created_at?.slice(0, 10) ?? '';
              const priorityColor = entry.priority === 'high' ? '#f87171' : entry.priority === 'medium' ? '#fbbf24' : '#6b7280';
              return (
                <div
                  key={entry.id ?? entry.title}
                  className="rounded-xl cursor-pointer transition-all"
                  style={{ background: cfg.bg, border: `1px solid ${isExpanded ? cfg.border : 'rgba(255,255,255,0.05)'}` }}
                  onClick={() => setExpandedId(isExpanded ? null : (entry.id ?? entry.title) ?? null)}
                >
                  {/* Header row */}
                  <div className="flex items-start gap-2.5 px-3.5 py-2.5">
                    <span className="shrink-0 text-[9px] tracking-wider mt-0.5 px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.3)', color: cfg.color, border: `1px solid ${cfg.border}` }}>
                      {TYPE_CONFIG[type]?.label ?? type}
                    </span>
                    <span className="flex-1 text-xs font-medium leading-snug" style={{ color: '#d1d5db' }}>{entry.title}</span>
                    <div className="shrink-0 flex items-center gap-2">
                      {entry.priority && (
                        <span className="text-[9px] font-bold" style={{ color: priorityColor }}>{entry.priority.toUpperCase()}</span>
                      )}
                      <span className="text-[9px] text-gray-700">{dateStr}</span>
                      <span className="text-[10px] text-gray-600">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Preview (collapsed) */}
                  {!isExpanded && (
                    <p className="px-3.5 pb-2.5 text-[11px] text-gray-600 leading-relaxed line-clamp-2">
                      {entry.insight}
                    </p>
                  )}

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 space-y-2.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                      <p className="pt-2.5 text-[12px] leading-relaxed" style={{ color: '#9ca3af' }}>{entry.insight}</p>
                      {entry.evidence && (
                        <div>
                          <span className="text-[9px] tracking-widest text-gray-600 font-bold block mb-1">EVIDENCE</span>
                          <p className="text-[11px] leading-relaxed text-gray-600">{entry.evidence}</p>
                        </div>
                      )}
                      {entry.relevant_projects && entry.relevant_projects.length > 0 && (
                        <div>
                          <span className="text-[9px] tracking-widest text-gray-600 font-bold block mb-1">PROJECTS</span>
                          <div className="flex flex-wrap gap-1">
                            {entry.relevant_projects.map(p => (
                              <span key={p} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa' }}>{p}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {entry.relevant_team_members && entry.relevant_team_members.length > 0 && (
                        <div>
                          <span className="text-[9px] tracking-widest text-gray-600 font-bold block mb-1">TEAM</span>
                          <div className="flex flex-wrap gap-1">
                            {entry.relevant_team_members.map(m => (
                              <span key={m} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa' }}>{m}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {entry.tags.map(t => (
                            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#4b5563' }}>#{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ORACLE VIEW ──────────────────────────────────────────────────────── */}
      {viewMode === 'oracle' && (
        <>
          {/* Canvas: shrinks when conversation is active */}
          <div className="relative shrink-0 transition-all duration-500" style={{ height: conversation.length > 0 ? '90px' : 'auto', flex: conversation.length > 0 ? 'none' : '1 1 0%', minHeight: 0 }}>
            <canvas ref={canvasRef} className="w-full h-full block" />
            {oracleState === 'idle' && conversation.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingBottom: '8%' }}>
                <div className="text-[11px] tracking-[0.35em] font-bold" style={{ color: 'rgba(75,85,99,0.8)', textShadow: '0 0 20px rgba(99,102,241,0.2)' }}>
                  ✦ DOME WISDOM ORACLE ✦
                </div>
              </div>
            )}
            {oracleState === 'thinking' && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="text-[10px] tracking-[0.3em] font-bold px-3 py-1 rounded-full" style={{ color: '#60a5fa', background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(96,165,250,0.2)', animation: 'pulse 1.2s ease-in-out infinite alternate' }}>
                  CHANNELING...
                </div>
              </div>
            )}
          </div>

          {/* ── Conversation thread ──────────────────────────────────────────── */}
          {conversation.length > 0 && (
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,102,241,0.3) transparent' }}>
              {conversation.map((turn, i) => (
                <div key={i} className="space-y-2">
                  {/* User question */}
                  <div className="flex justify-end">
                    <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm"
                      style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', color: '#c7d2fe' }}>
                      {turn.question}
                    </div>
                  </div>
                  {/* Oracle answer */}
                  <div className="flex justify-start">
                    <div className="max-w-[88%] space-y-1.5">
                      <div className="text-[9px] tracking-[0.3em] font-bold" style={{ color: 'rgba(251,191,36,0.5)' }}>◈ ORACLE</div>
                      <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
                        style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(251,191,36,0.2)', color: '#d1d5db', boxShadow: '0 0 20px rgba(251,191,36,0.04)' }}>
                        {turn.answer}
                      </div>
                      <div className="text-[9px] text-gray-700 pl-1">
                        {turn.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {/* Latest streaming answer while thinking/answering */}
              {oracleState === 'answering' && oracleAnswer && answerVisible && (
                <div className="flex justify-start">
                  <div className="max-w-[88%] space-y-1.5">
                    <div className="text-[9px] tracking-[0.3em] font-bold" style={{ color: 'rgba(251,191,36,0.5)' }}>◈ ORACLE</div>
                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
                      style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(251,191,36,0.35)', color: '#d1d5db', boxShadow: '0 0 30px rgba(251,191,36,0.08)', opacity: answerVisible ? 1 : 0, transition: 'opacity 0.6s ease' }}>
                      {oracleAnswer}
                    </div>
                  </div>
                </div>
              )}
              <div ref={conversationEndRef} />
            </div>
          )}

          {/* First-ask answer overlay (no history yet) */}
          {conversation.length === 0 && oracleAnswer && answerVisible && (
            <div className="shrink-0 px-4 pb-2 flex justify-center" style={{ opacity: answerVisible ? 1 : 0, transition: 'opacity 0.8s ease' }}>
              <div className="w-full max-w-2xl rounded-2xl p-5 space-y-3" style={{ background: 'rgba(0,0,0,0.92)', border: '1px solid rgba(251,191,36,0.4)', boxShadow: '0 0 40px rgba(251,191,36,0.12)' }}>
                <div className="text-[10px] tracking-[0.4em] font-bold" style={{ color: '#fbbf24' }}>◈ THE ORACLE SPEAKS ◈</div>
                <div className="text-sm leading-relaxed" style={{ color: '#d1d5db' }}>{oracleAnswer}</div>
              </div>
            </div>
          )}

          {/* ── Input area ───────────────────────────────────────────────────── */}
          <div className="shrink-0 p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
            <div className="max-w-2xl mx-auto flex gap-3 items-end">
              <div className="flex-1">
                <textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
                  placeholder={conversation.length > 0 ? 'Continue the conversation...' : 'What do you seek from the DOME Oracle?'}
                  rows={2}
                  disabled={isLoading || oracleState !== 'idle'}
                  className="w-full resize-none rounded-xl px-4 py-3 text-sm placeholder-gray-700 outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${oracleState !== 'idle' ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.09)'}`, color: '#e2e8f0', lineHeight: '1.5' }}
                />
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={handleAsk}
                  disabled={!question.trim() || isLoading || oracleState !== 'idle'}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: question.trim() && oracleState === 'idle' ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' : 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: question.trim() && oracleState === 'idle' ? '#e0e7ff' : '#374151',
                    boxShadow: question.trim() && oracleState === 'idle' ? '0 0 24px rgba(99,102,241,0.45)' : 'none',
                    cursor: question.trim() && oracleState === 'idle' ? 'pointer' : 'not-allowed',
                  }}
                >
                  <span style={{ fontSize: '14px' }}>{oracleState === 'thinking' ? '⟳' : '✦'}</span>
                  <span>{oracleState === 'thinking' ? 'Channeling...' : oracleState === 'answering' ? 'Speaking...' : 'Ask'}</span>
                </button>
                {conversation.length > 0 && (
                  <button
                    onClick={handleNewConversation}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#4b5563' }}
                  >
                    ↺ New
                  </button>
                )}
              </div>
            </div>
            <p className="text-center text-[10px] text-gray-700 mt-2">
              {conversation.length > 0
                ? `Session active · ${conversation.length} exchange${conversation.length > 1 ? 's' : ''} · Stored in DOME Brain`
                : 'Oracle queries all 7 DOME databases live · Sessions stored in DOME Brain · Press Enter to ask'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
