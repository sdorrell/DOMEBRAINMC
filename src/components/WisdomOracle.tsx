import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

type OracleState = 'idle' | 'thinking' | 'answering';

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
  priority?: number;
}

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

  // ── Outer halo ring
  for (let i = 0; i < 52; i++) {
    const a = (i / 52) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * s * 0.29, y: cy - s * 0.53 + Math.sin(a) * s * 0.09 });
  }
  // Inner halo
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * s * 0.22, y: cy - s * 0.53 + Math.sin(a) * s * 0.065 });
  }

  // ── Head (ellipse)
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * s * 0.085, y: cy - s * 0.34 + Math.sin(a) * s * 0.105 });
  }

  // ── Neck
  for (let i = 0; i < 10; i++) {
    pts.push({ x: cx + ((i / 9) - 0.5) * s * 0.08, y: cy - s * 0.215 });
  }

  // ── Shoulders (slight droop at edges)
  for (let i = 0; i < 24; i++) {
    const t = (i / 23) - 0.5;
    pts.push({ x: cx + t * s * 0.52, y: cy - s * 0.175 + t * t * s * 0.07 });
  }

  // ── Robe — rows that flare toward bottom, with subtle wave on edges
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

  // ── Left arm (curves outward and downward)
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    pts.push({
      x: cx - s * (0.23 + t * 0.25),
      y: cy + s * (-0.14 + t * 0.12),
    });
  }
  // Right arm
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    pts.push({
      x: cx + s * (0.23 + t * 0.25),
      y: cy + s * (-0.14 + t * 0.12),
    });
  }

  // ── Light rays (10 spokes radiating from figure center)
  const rayCY = cy - s * 0.08;
  for (let ray = 0; ray < 12; ray++) {
    const baseAngle = (ray / 12) * Math.PI * 2;
    for (let i = 5; i < 14; i++) {
      const r = s * (0.3 + i * 0.044);
      const jitter = (Math.random() - 0.5) * 0.07;
      pts.push({
        x: cx + Math.cos(baseAngle + jitter) * r,
        y: rayCY + Math.sin(baseAngle + jitter) * r,
      });
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

  const [question, setQuestion] = useState('');
  const [oracleState, setOracleState] = useState<OracleState>('idle');
  const [answers, setAnswers] = useState<WisdomEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('Seek knowledge from the DOME Oracle...');
  const [answerVisible, setAnswerVisible] = useState(false);

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

    // Fade trail
    ctx.fillStyle = 'rgba(5, 5, 16, 0.17)';
    ctx.fillRect(0, 0, W, H);

    // Smooth convergence
    const targetConv = state === 'idle' ? 0 : 1;
    const lerp = state === 'idle' ? 0.022 : 0.032;
    convergenceRef.current += (targetConv - convergenceRef.current) * lerp;
    const c = convergenceRef.current;

    // Draw particles
    particlesRef.current.forEach((p, idx) => {
      // Always advance rain simulation
      p.rainY += p.vy;
      if (p.rainY > H + 24) {
        p.rainY = -24;
        p.rainX = Math.random() * W;
      }

      // Cycle chars
      p.charTimer++;
      if (p.charTimer >= p.charInterval) {
        p.charTimer = 0;
        p.char = randChar();
        p.charInterval = state === 'idle' ? 5 + Math.floor(Math.random() * 12) : 10 + Math.floor(Math.random() * 20);
      }

      // Draw position: lerp between rain and figure target
      const drawX = p.rainX + (p.targetX - p.rainX) * c;
      const drawY = p.rainY + (p.targetY - p.rainY) * c;

      // Color
      let r = 0, g = 0, b = 0, a = 0;

      if (state === 'answering' && c > 0.55) {
        const convT = Math.min(1, (c - 0.55) / 0.45);
        const pulse = 0.45 + 0.55 * Math.sin(now * 0.0024 + idx * 0.09);
        const mix = convT * pulse;
        r = 255;
        g = Math.floor(120 + 135 * mix);
        b = 0;
        a = (0.5 + 0.5 * mix) * p.brightness;
      } else if (c > 0.08) {
        const t = Math.min(1, c / 0.75);
        // Transition from green → cyan/white
        r = Math.floor(60 + t * 120);
        g = Math.floor(170 + t * 85);
        b = Math.floor(190 + t * 65);
        a = (0.45 + t * 0.45) * p.brightness;
      } else {
        // Matrix rain: green cascade
        const lead = idx % 8 === 0;
        const bright = idx % 3 === 0;
        r = 0;
        g = lead ? 240 : bright ? 100 + Math.floor(Math.random() * 80) : 50 + Math.floor(Math.random() * 50);
        b = lead ? 40 : 0;
        a = lead ? 0.95 : bright ? 0.6 : 0.35;
      }

      const sz = 11 + (c > 0.4 ? Math.floor(c * 3) : 0);
      ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, a).toFixed(2)})`;
      ctx.font = `${sz}px monospace`;
      ctx.fillText(p.char, drawX, drawY);
    });

    // Golden aura when answering
    if (state === 'answering' && c > 0.45) {
      const intensity = Math.min(1, (c - 0.45) / 0.55) * (0.65 + 0.35 * Math.sin(now * 0.0018));
      const grd = ctx.createRadialGradient(W / 2, H * 0.46, 0, W / 2, H * 0.46, Math.min(W, H) * 0.45);
      grd.addColorStop(0, `rgba(255, 210, 0, ${(0.14 * intensity).toFixed(2)})`);
      grd.addColorStop(0.4, `rgba(255, 130, 0, ${(0.06 * intensity).toFixed(2)})`);
      grd.addColorStop(1, 'rgba(255, 80, 0, 0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    }

    // Thinking pulse ring
    if (state === 'thinking' && c > 0.3) {
      const pulse = 0.3 + 0.7 * ((Math.sin(now * 0.003) + 1) / 2);
      const rad = Math.min(W, H) * (0.28 + pulse * 0.06);
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.46, rad, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(100, 200, 255, ${(0.08 * pulse * c).toFixed(2)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // ── Canvas setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      initParticles(canvas.width, canvas.height);
    };

    resize();
    window.addEventListener('resize', resize);
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [animate, initParticles]);

  // ── Audio helpers ───────────────────────────────────────────────────────────
  const getCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  const playThinking = () => {
    try {
      const ctx = getCtx();
      thinkOscRef.current.forEach(o => { try { o.stop(); } catch {} });
      thinkOscRef.current = [];
      [82.4, 110, 164.8, 220, 293.7].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(freq * 1.62, ctx.currentTime + 4.5);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 1.0);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        thinkOscRef.current.push(osc);
      });
    } catch {}
  };

  const stopThinking = () => {
    const ctx = audioCtxRef.current;
    thinkOscRef.current.forEach(o => {
      try { o.stop(ctx ? ctx.currentTime + 0.5 : 0); } catch {}
    });
    thinkOscRef.current = [];
  };

  const playAnswer = () => {
    try {
      const ctx = getCtx();
      // Bell tones — pentatonic scale
      [528, 660, 792, 990, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.16;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.07, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 3.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 3.5);
      });
      // Shimmer sweep
      const sw = ctx.createOscillator();
      const swg = ctx.createGain();
      sw.type = 'triangle';
      sw.frequency.setValueAtTime(1600, ctx.currentTime + 0.5);
      sw.frequency.exponentialRampToValueAtTime(6000, ctx.currentTime + 2.0);
      swg.gain.setValueAtTime(0, ctx.currentTime + 0.5);
      swg.gain.linearRampToValueAtTime(0.022, ctx.currentTime + 0.8);
      swg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
      sw.connect(swg);
      swg.connect(ctx.destination);
      sw.start(ctx.currentTime + 0.5);
      sw.stop(ctx.currentTime + 2.8);
    } catch {}
  };

  // ── Ask the Oracle ──────────────────────────────────────────────────────────
  const handleAsk = async () => {
    if (!question.trim() || isLoading || oracleState !== 'idle') return;

    setIsLoading(true);
    setAnswers(null);
    setAnswerVisible(false);
    stateRef.current = 'thinking';
    setOracleState('thinking');
    setStatusText('The Oracle searches the depths of DOME knowledge...');
    playThinking();

    try {
      // Store question so nightly agent picks it up
      await supabase.from('dome_wisdom').insert({
        title: question.trim().slice(0, 200),
        insight: `[User Question] ${question.trim()}`,
        insight_type: 'user_question',
        priority: 3,
        reviewed: false,
        source_data: {
          asked_by: currentUserId,
          asked_at: new Date().toISOString(),
          question: question.trim(),
        },
      });

      // Fetch non-question wisdom
      const { data } = await supabase
        .from('dome_wisdom')
        .select('id, title, insight, insight_type, priority')
        .not('insight_type', 'eq', 'user_question')
        .order('priority', { ascending: false })
        .limit(80);

      // Keyword relevance scoring
      const stopWords = new Set(['what','when','where','which','will','does','should','have','with','that','this','from','they','there','their','about','some','more','been','into','over','just','like','also','than','then','much']);
      const qWords = question
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.has(w));

      let results: WisdomEntry[] = [];

      if (data && qWords.length > 0) {
        const scored = data
          .map(e => {
            const haystack = `${e.title} ${e.insight}`.toLowerCase();
            const score = qWords.reduce((s, w) => s + (haystack.includes(w) ? 1 : 0), 0);
            return { ...e, _score: score };
          })
          .filter(e => e._score > 0)
          .sort((a, b) => b._score - a._score || (b.priority ?? 0) - (a.priority ?? 0));
        results = scored.slice(0, 3);
      }

      if (results.length === 0 && data) {
        results = data.slice(0, 2);
      }

      // Minimum theatrical pause
      await new Promise(r => setTimeout(r, 3000));

      stopThinking();
      playAnswer();

      stateRef.current = 'answering';
      setOracleState('answering');
      setStatusText('The Oracle has spoken.');
      setAnswers(
        results.length > 0
          ? results
          : [{
              title: 'Your Question Has Been Received',
              insight:
                'The Oracle has recorded your inquiry and will weave it into the nightly wisdom synthesis. Return tomorrow — the intelligence cycle will have an answer.',
            }]
      );

      // Brief delay before revealing answer panel
      setTimeout(() => setAnswerVisible(true), 600);

      // Return to idle
      setTimeout(() => {
        stateRef.current = 'idle';
        setOracleState('idle');
        setStatusText('Seek knowledge from the DOME Oracle...');
        setAnswerVisible(false);
        setTimeout(() => setAnswers(null), 800);
      }, 16000);
    } catch {
      stateRef.current = 'idle';
      setOracleState('idle');
      setStatusText('The Oracle is momentarily unreachable. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── State metadata ──────────────────────────────────────────────────────────
  const STATE_LABEL: Record<OracleState, string> = {
    idle: 'DORMANT',
    thinking: 'CHANNELING',
    answering: 'ORACLE SPEAKS',
  };
  const STATE_COLOR: Record<OracleState, string> = {
    idle: '#374151',
    thinking: '#60a5fa',
    answering: '#fbbf24',
  };

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #04040e 0%, #060612 100%)' }}
    >
      {/* ── Status bar ─────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center gap-3 px-5 py-2.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.4)' }}
      >
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: STATE_COLOR[oracleState],
            boxShadow: `0 0 8px ${STATE_COLOR[oracleState]}`,
            animation: oracleState === 'thinking' ? 'pulse 0.7s ease-in-out infinite alternate' : undefined,
          }}
        />
        <span
          className="text-[10px] tracking-widest font-bold shrink-0"
          style={{ color: STATE_COLOR[oracleState] }}
        >
          {STATE_LABEL[oracleState]}
        </span>
        <span className="text-[10px] text-gray-600 truncate">{statusText}</span>

        {/* Subtle title */}
        <span className="ml-auto text-[10px] text-gray-700 tracking-widest shrink-0 font-medium">
          ✦ DOME ORACLE ✦
        </span>
      </div>

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Oracle label overlay — visible in idle */}
        {oracleState === 'idle' && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            style={{ paddingBottom: '8%' }}
          >
            <div
              className="text-[11px] tracking-[0.35em] font-bold"
              style={{ color: 'rgba(75,85,99,0.8)', textShadow: '0 0 20px rgba(99,102,241,0.2)' }}
            >
              ✦ DOME WISDOM ORACLE ✦
            </div>
          </div>
        )}

        {/* Thinking label */}
        {oracleState === 'thinking' && (
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none"
          >
            <div
              className="text-[11px] tracking-[0.3em] font-bold px-4 py-1.5 rounded-full"
              style={{
                color: '#60a5fa',
                background: 'rgba(0,0,0,0.7)',
                border: '1px solid rgba(96,165,250,0.2)',
                animation: 'pulse 1.2s ease-in-out infinite alternate',
              }}
            >
              CHANNELING DOME KNOWLEDGE...
            </div>
          </div>
        )}

        {/* ── Answer overlay ─────────────────────────────────────────────── */}
        {answers && answerVisible && (
          <div
            className="absolute bottom-4 left-0 right-0 px-4 flex justify-center"
            style={{
              opacity: answerVisible ? 1 : 0,
              transition: 'opacity 0.8s ease',
            }}
          >
            <div
              className="w-full max-w-2xl rounded-2xl p-5 space-y-3"
              style={{
                background: 'rgba(0,0,0,0.92)',
                border: '1px solid rgba(251,191,36,0.4)',
                boxShadow: '0 0 40px rgba(251,191,36,0.12), 0 0 80px rgba(251,191,36,0.05)',
              }}
            >
              <div
                className="text-[10px] tracking-[0.4em] font-bold"
                style={{ color: '#fbbf24' }}
              >
                ◈ THE ORACLE SPEAKS ◈
              </div>

              {answers.map((a, i) => (
                <div key={i}>
                  {i > 0 && (
                    <div
                      className="my-3"
                      style={{ borderTop: '1px solid rgba(251,191,36,0.15)' }}
                    />
                  )}
                  <div
                    className="text-sm font-semibold mb-1.5"
                    style={{ color: '#fcd34d' }}
                  >
                    {a.title}
                  </div>
                  <div className="text-sm leading-relaxed" style={{ color: '#d1d5db' }}>
                    {a.insight}
                  </div>
                </div>
              ))}

              <div
                className="text-[10px] pt-1"
                style={{ color: 'rgba(251,191,36,0.35)' }}
              >
                This wisdom has been drawn from the DOME Brain. Your question will inform tomorrow's synthesis.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Input area ─────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 p-4"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="max-w-2xl mx-auto flex gap-3 items-end">
          <div className="flex-1">
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
              placeholder="What do you seek from the DOME Oracle?"
              rows={2}
              disabled={isLoading || oracleState !== 'idle'}
              className="w-full resize-none rounded-xl px-4 py-3 text-sm placeholder-gray-700 outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${oracleState !== 'idle' ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.09)'}`,
                color: '#e2e8f0',
                lineHeight: '1.5',
              }}
            />
          </div>

          <button
            onClick={handleAsk}
            disabled={!question.trim() || isLoading || oracleState !== 'idle'}
            className="shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{
              background:
                question.trim() && oracleState === 'idle'
                  ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
                  : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: question.trim() && oracleState === 'idle' ? '#e0e7ff' : '#374151',
              boxShadow:
                question.trim() && oracleState === 'idle'
                  ? '0 0 24px rgba(99,102,241,0.45)'
                  : 'none',
              cursor: question.trim() && oracleState === 'idle' ? 'pointer' : 'not-allowed',
            }}
          >
            <span style={{ fontSize: '14px' }}>
              {oracleState === 'thinking' ? '⟳' : '✦'}
            </span>
            <span>{oracleState === 'thinking' ? 'Channeling...' : oracleState === 'answering' ? 'Speaking...' : 'Ask'}</span>
          </button>
        </div>

        <p className="text-center text-[10px] text-gray-700 mt-2">
          Questions are recorded in DOME Brain and shape the nightly wisdom synthesis · Press Enter to ask
        </p>
      </div>
    </div>
  );
}
