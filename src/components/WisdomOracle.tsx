import { useState, useEffect, useRef, useCallback } from 'react';

type OracleState = 'idle' | 'thinking' | 'answering';
type ViewMode = 'oracle' | 'browse';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Particle {
  rainX: number; rainY: number; vy: number;
  targetX: number; targetY: number;
  char: string; charTimer: number; charInterval: number; brightness: number;
}

interface WisdomEntry {
  id?: string; title: string; insight: string;
  insight_type?: string; priority?: string;
  evidence?: string; relevant_projects?: string[];
  relevant_team_members?: string[]; tags?: string[];
  created_at?: string; run_date?: string;
}

// ── Particle config ───────────────────────────────────────────────────────────
const MATRIX_CHARS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' +
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ' +
  '∑∆Ω∞∂∇◈◆◇✦✧★☆♦∮≡≈≠⌬⊕⊗';

function randChar() { return MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]; }

function buildFigurePoints(w: number, h: number): { x: number; y: number }[] {
  const cx = w * 0.5, cy = h * 0.46, s = Math.min(w, h) * 0.31;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 52; i++) { const a = (i/52)*Math.PI*2; pts.push({ x: cx+Math.cos(a)*s*0.29, y: cy-s*0.53+Math.sin(a)*s*0.09 }); }
  for (let i = 0; i < 36; i++) { const a = (i/36)*Math.PI*2; pts.push({ x: cx+Math.cos(a)*s*0.22, y: cy-s*0.53+Math.sin(a)*s*0.065 }); }
  for (let i = 0; i < 36; i++) { const a = (i/36)*Math.PI*2; pts.push({ x: cx+Math.cos(a)*s*0.085, y: cy-s*0.34+Math.sin(a)*s*0.105 }); }
  for (let i = 0; i < 10; i++) pts.push({ x: cx+((i/9)-0.5)*s*0.08, y: cy-s*0.215 });
  for (let i = 0; i < 24; i++) { const t=(i/23)-0.5; pts.push({ x: cx+t*s*0.52, y: cy-s*0.175+t*t*s*0.07 }); }
  for (let row = 0; row < 18; row++) {
    const t=row/17, y=cy-s*0.13+t*s*0.68, hw=s*(0.17+t*0.32), n=Math.floor(8+t*16);
    for (let i=0;i<n;i++) { const frac=i/(n-1), px=cx+(frac-0.5)*hw*2, edge=Math.abs(frac-0.5)*2; pts.push({ x: px+(edge>0.65?Math.sin(t*Math.PI*5+i*0.4)*s*0.018:0), y }); }
  }
  for (let i=0;i<22;i++) { const t=i/21; pts.push({ x:cx-s*(0.23+t*0.25), y:cy+s*(-0.14+t*0.12) }); pts.push({ x:cx+s*(0.23+t*0.25), y:cy+s*(-0.14+t*0.12) }); }
  const rayCY=cy-s*0.08;
  for (let ray=0;ray<12;ray++) { const ba=(ray/12)*Math.PI*2; for(let i=5;i<14;i++){const r=s*(0.3+i*0.044),j=(Math.random()-0.5)*0.07; pts.push({x:cx+Math.cos(ba+j)*r,y:rayCY+Math.sin(ba+j)*r});}}
  return pts;
}

// ── Badge colors ──────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  risk:         { color: '#f87171', bg: 'rgba(239,68,68,0.15)',   label: 'RISK' },
  opportunity:  { color: '#34d399', bg: 'rgba(52,211,153,0.15)',  label: 'OPPORTUNITY' },
  strategic:    { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', label: 'STRATEGIC' },
  pattern:      { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',  label: 'PATTERN' },
  anomaly:      { color: '#fb923c', bg: 'rgba(251,146,60,0.15)',  label: 'ANOMALY' },
  cross_project:{ color: '#22d3ee', bg: 'rgba(34,211,238,0.15)',  label: 'CROSS-PROJECT' },
};
const DEFAULT_TYPE = { color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', label: 'INSIGHT' };
const PRIORITY_COLOR: Record<string, string> = { high: '#f87171', medium: '#fbbf24', low: '#6b7280' };

const ORACLE_URL = 'https://domebrain-production.up.railway.app';

// ─────────────────────────────────────────────────────────────────────────────
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
  const [answer, setAnswer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('Seek knowledge from the DOME Oracle...');
  const [answerVisible, setAnswerVisible] = useState(false);

  // Browse state
  const [view, setView] = useState<ViewMode>('oracle');
  const [wisdomEntries, setWisdomEntries] = useState<WisdomEntry[]>([]);
  const [wisdomFilter, setWisdomFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [wisdomLoading, setWisdomLoading] = useState(false);

  const ORACLE_KEY = (import.meta.env.VITE_ORACLE_KEY as string) ?? '';

  // ── Particles ───────────────────────────────────────────────────────────────
  const initParticles = useCallback((w: number, h: number) => {
    const COUNT = 300, figPts = buildFigurePoints(w, h);
    figurePointsRef.current = figPts;
    particlesRef.current = Array.from({ length: COUNT }, (_, i) => ({
      rainX: Math.random()*w, rainY: Math.random()*h, vy: 0.9+Math.random()*2.8,
      targetX: figPts[i%figPts.length].x, targetY: figPts[i%figPts.length].y,
      char: randChar(), charTimer: Math.floor(Math.random()*10),
      charInterval: 5+Math.floor(Math.random()*12), brightness: 0.35+Math.random()*0.65,
    }));
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const W=canvas.width, H=canvas.height, state=stateRef.current, now=Date.now();
    ctx.fillStyle='rgba(5,5,16,0.17)'; ctx.fillRect(0,0,W,H);
    const targetConv=state==='idle'?0:1, lerp=state==='idle'?0.022:0.032;
    convergenceRef.current+=(targetConv-convergenceRef.current)*lerp;
    const c=convergenceRef.current;
    particlesRef.current.forEach((p,idx)=>{
      p.rainY+=p.vy; if(p.rainY>H+24){p.rainY=-24;p.rainX=Math.random()*W;}
      p.charTimer++; if(p.charTimer>=p.charInterval){p.charTimer=0;p.char=randChar();p.charInterval=state==='idle'?5+Math.floor(Math.random()*12):10+Math.floor(Math.random()*20);}
      const drawX=p.rainX+(p.targetX-p.rainX)*c, drawY=p.rainY+(p.targetY-p.rainY)*c;
      let r=0,g=0,b=0,a=0;
      if(state==='answering'&&c>0.55){const cT=Math.min(1,(c-0.55)/0.45),pulse=0.45+0.55*Math.sin(now*0.0024+idx*0.09),mix=cT*pulse;r=255;g=Math.floor(120+135*mix);b=0;a=(0.5+0.5*mix)*p.brightness;}
      else if(c>0.08){const t=Math.min(1,c/0.75);r=Math.floor(60+t*120);g=Math.floor(170+t*85);b=Math.floor(190+t*65);a=(0.45+t*0.45)*p.brightness;}
      else{const lead=idx%8===0,bright=idx%3===0;r=0;g=lead?240:bright?100+Math.floor(Math.random()*80):50+Math.floor(Math.random()*50);b=lead?40:0;a=lead?0.95:bright?0.6:0.35;}
      const sz=11+(c>0.4?Math.floor(c*3):0);
      ctx.fillStyle=`rgba(${r},${g},${b},${Math.min(1,a).toFixed(2)})`;
      ctx.font=`${sz}px monospace`; ctx.fillText(p.char,drawX,drawY);
    });
    if(state==='answering'&&c>0.45){const intensity=Math.min(1,(c-0.45)/0.55)*(0.65+0.35*Math.sin(now*0.0018));const grd=ctx.createRadialGradient(W/2,H*0.46,0,W/2,H*0.46,Math.min(W,H)*0.45);grd.addColorStop(0,`rgba(255,210,0,${(0.14*intensity).toFixed(2)})`);grd.addColorStop(0.4,`rgba(255,130,0,${(0.06*intensity).toFixed(2)})`);grd.addColorStop(1,'rgba(255,80,0,0)');ctx.fillStyle=grd;ctx.fillRect(0,0,W,H);}
    if(state==='thinking'&&c>0.3){const pulse=0.3+0.7*((Math.sin(now*0.003)+1)/2);ctx.beginPath();ctx.arc(W/2,H*0.46,Math.min(W,H)*(0.28+pulse*0.06),0,Math.PI*2);ctx.strokeStyle=`rgba(100,200,255,${(0.08*pulse*c).toFixed(2)})`;ctx.lineWidth=1.5;ctx.stroke();}
    animFrameRef.current=requestAnimationFrame(animate);
  }, []);

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const resize=()=>{ const r=canvas.getBoundingClientRect(); canvas.width=r.width; canvas.height=r.height; initParticles(canvas.width,canvas.height); };
    resize(); window.addEventListener('resize',resize); animFrameRef.current=requestAnimationFrame(animate);
    return()=>{ window.removeEventListener('resize',resize); cancelAnimationFrame(animFrameRef.current); };
  },[animate,initParticles]);

  // ── Fetch wisdom entries ────────────────────────────────────────────────────
  const fetchWisdom = useCallback(async () => {
    setWisdomLoading(true);
    try {
      const res = await fetch(`${ORACLE_URL}/wisdom`, {
        headers: { 'Authorization': `Bearer ${ORACLE_KEY}` },
      });
      if (res.ok) setWisdomEntries(await res.json());
    } catch {}
    setWisdomLoading(false);
  }, [ORACLE_KEY]);

  useEffect(() => { fetchWisdom(); }, [fetchWisdom]);

  // ── Audio ───────────────────────────────────────────────────────────────────
  const getCtx=()=>{ if(!audioCtxRef.current) audioCtxRef.current=new(window.AudioContext||(window as any).webkitAudioContext)(); return audioCtxRef.current; };
  const playThinking=()=>{ try{ const ctx=getCtx(); thinkOscRef.current.forEach(o=>{try{o.stop();}catch{}}); thinkOscRef.current=[]; [82.4,110,164.8,220,293.7].forEach((freq,i)=>{ const osc=ctx.createOscillator(),gain=ctx.createGain(); osc.type=i%2===0?'sine':'triangle'; osc.frequency.setValueAtTime(freq,ctx.currentTime); osc.frequency.linearRampToValueAtTime(freq*1.62,ctx.currentTime+4.5); gain.gain.setValueAtTime(0,ctx.currentTime); gain.gain.linearRampToValueAtTime(0.03,ctx.currentTime+1.0); osc.connect(gain); gain.connect(ctx.destination); osc.start(); thinkOscRef.current.push(osc); }); }catch{} };
  const stopThinking=()=>{ const ctx=audioCtxRef.current; thinkOscRef.current.forEach(o=>{try{o.stop(ctx?ctx.currentTime+0.5:0);}catch{}}); thinkOscRef.current=[]; };
  const playAnswer=()=>{ try{ const ctx=getCtx(); [528,660,792,990,1320].forEach((freq,i)=>{ const osc=ctx.createOscillator(),gain=ctx.createGain(); osc.type='sine'; osc.frequency.value=freq; const t=ctx.currentTime+i*0.16; gain.gain.setValueAtTime(0,t); gain.gain.linearRampToValueAtTime(0.07,t+0.04); gain.gain.exponentialRampToValueAtTime(0.001,t+3.2); osc.connect(gain); gain.connect(ctx.destination); osc.start(t); osc.stop(t+3.5); }); const sw=ctx.createOscillator(),swg=ctx.createGain(); sw.type='triangle'; sw.frequency.setValueAtTime(1600,ctx.currentTime+0.5); sw.frequency.exponentialRampToValueAtTime(6000,ctx.currentTime+2.0); swg.gain.setValueAtTime(0,ctx.currentTime+0.5); swg.gain.linearRampToValueAtTime(0.022,ctx.currentTime+0.8); swg.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+2.5); sw.connect(swg); swg.connect(ctx.destination); sw.start(ctx.currentTime+0.5); sw.stop(ctx.currentTime+2.8); }catch{} };

  // ── Ask the Oracle ──────────────────────────────────────────────────────────
  const handleAsk = async () => {
    if (!question.trim() || isLoading || oracleState !== 'idle') return;
    setIsLoading(true); setAnswer(null); setAnswerVisible(false);
    stateRef.current = 'thinking'; setOracleState('thinking');
    setStatusText('The Oracle channels the depths of DOME knowledge...');
    playThinking();

    try {
      const [res] = await Promise.all([
        fetch(`${ORACLE_URL}/oracle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ORACLE_KEY}` },
          body: JSON.stringify({ question: question.trim() }),
        }),
        new Promise(r => setTimeout(r, 3000)),
      ]);
      if (!res.ok) { const e = await res.json().catch(()=>({error:`HTTP ${res.status}`})); throw new Error(e.error||`${res.status}`); }
      const { answer: ans } = await res.json();
      stopThinking(); playAnswer();
      stateRef.current = 'answering'; setOracleState('answering');
      setStatusText('The Oracle has spoken.');
      setAnswer(ans);
      setTimeout(() => setAnswerVisible(true), 600);
      setTimeout(()=>{ stateRef.current='idle'; setOracleState('idle'); setStatusText('Seek knowledge from the DOME Oracle...'); setAnswerVisible(false); setTimeout(()=>setAnswer(null),800); }, 20000);
      // Refresh wisdom list after question (it got stored)
      setTimeout(fetchWisdom, 2000);
    } catch (err: any) {
      stopThinking(); stateRef.current='idle'; setOracleState('idle');
      setStatusText(`Oracle unreachable: ${err?.message ?? 'unknown error'}`);
    } finally { setIsLoading(false); }
  };

  // ── Derived browse data ─────────────────────────────────────────────────────
  // Filter out raw question log entries and deduplicate by title
  const seenTitles = new Set<string>();
  const cleanedWisdom = wisdomEntries.filter(e => {
    const title = e.title || '';
    if (title.startsWith('[User Question from DOME Oracle]')) return false;
    if (seenTitles.has(title)) return false;
    seenTitles.add(title);
    return true;
  });

  const allTypes = ['all', ...Array.from(new Set(cleanedWisdom.map(e => e.insight_type || 'insight').filter(Boolean)))];
  const filteredWisdom = wisdomFilter === 'all'
    ? cleanedWisdom
    : cleanedWisdom.filter(e => (e.insight_type || '') === wisdomFilter);

  const STATE_LABEL: Record<OracleState, string> = { idle: 'DORMANT', thinking: 'CHANNELING', answering: 'ORACLE SPEAKS' };
  const STATE_COLOR: Record<OracleState, string> = { idle: '#374151', thinking: '#60a5fa', answering: '#fbbf24' };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg,#04040e 0%,#060612 100%)' }}>

      {/* ── Status / nav bar ──────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.5)' }}>
        {/* State dot */}
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: STATE_COLOR[oracleState], boxShadow: `0 0 8px ${STATE_COLOR[oracleState]}`, animation: oracleState==='thinking'?'pulse 0.7s ease-in-out infinite alternate':undefined }} />
        <span className="text-[10px] tracking-widest font-bold shrink-0" style={{ color: STATE_COLOR[oracleState] }}>{STATE_LABEL[oracleState]}</span>
        <span className="text-[10px] text-gray-600 truncate flex-1">{statusText}</span>

        {/* View toggle */}
        <div className="flex shrink-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '2px' }}>
          {(['oracle','browse'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-3 py-1 rounded-md text-[10px] font-semibold tracking-wider transition-all"
              style={view === v
                ? { background: 'rgba(99,102,241,0.3)', color: '#e0e7ff', border: '1px solid rgba(99,102,241,0.4)' }
                : { color: '#4b5563', border: '1px solid transparent' }}>
              {v === 'oracle' ? '✦ Oracle' : `◈ Wisdom Log${cleanedWisdom.length > 0 ? ` (${cleanedWisdom.length})` : ''}`}
            </button>
          ))}
        </div>
      </div>

      {/* ── ORACLE VIEW ───────────────────────────────────────────────────── */}
      {view === 'oracle' && (
        <>
          <div className="relative flex-1 min-h-0">
            <canvas ref={canvasRef} className="w-full h-full block" />
            {oracleState === 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingBottom: '8%' }}>
                <div className="text-[11px] tracking-[0.35em] font-bold" style={{ color: 'rgba(75,85,99,0.7)' }}>✦ DOME WISDOM ORACLE ✦</div>
              </div>
            )}
            {oracleState === 'thinking' && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="text-[11px] tracking-[0.3em] font-bold px-4 py-1.5 rounded-full"
                  style={{ color: '#60a5fa', background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(96,165,250,0.2)', animation: 'pulse 1.2s ease-in-out infinite alternate' }}>
                  CHANNELING DOME KNOWLEDGE...
                </div>
              </div>
            )}
            {answer && answerVisible && (
              <div className="absolute bottom-4 left-0 right-0 px-4 flex justify-center">
                <div className="w-full max-w-2xl rounded-2xl p-5" style={{ background: 'rgba(0,0,0,0.93)', border: '1px solid rgba(251,191,36,0.4)', boxShadow: '0 0 40px rgba(251,191,36,0.12)' }}>
                  <div className="text-[10px] tracking-[0.4em] font-bold mb-3" style={{ color: '#fbbf24' }}>◈ THE ORACLE SPEAKS ◈</div>
                  <p className="text-sm leading-relaxed" style={{ color: '#e2e8f0' }}>{answer}</p>
                  <div className="text-[10px] mt-3" style={{ color: 'rgba(251,191,36,0.3)' }}>
                    Answer synthesized from real-time DOME Brain data · Questions inform the nightly wisdom synthesis
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="shrink-0 p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
            <div className="max-w-2xl mx-auto flex gap-3 items-end">
              <textarea value={question} onChange={e=>setQuestion(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleAsk();} }}
                placeholder="What do you seek from the DOME Oracle? Ask about any project, metric, or strategy..."
                rows={2} disabled={isLoading||oracleState!=='idle'}
                className="flex-1 resize-none rounded-xl px-4 py-3 text-sm placeholder-gray-700 outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${oracleState!=='idle'?'rgba(251,191,36,0.25)':'rgba(255,255,255,0.09)'}`, color: '#e2e8f0', lineHeight: 1.5 }} />
              <button onClick={handleAsk} disabled={!question.trim()||isLoading||oracleState!=='idle'}
                className="shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: question.trim()&&oracleState==='idle'?'linear-gradient(135deg,#4f46e5,#7c3aed)':'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: question.trim()&&oracleState==='idle'?'#e0e7ff':'#374151', boxShadow: question.trim()&&oracleState==='idle'?'0 0 24px rgba(99,102,241,0.45)':'none', cursor: question.trim()&&oracleState==='idle'?'pointer':'not-allowed' }}>
                <span>{oracleState==='thinking'?'⟳':'✦'}</span>
                <span>{oracleState==='thinking'?'Channeling...':oracleState==='answering'?'Speaking...':'Ask'}</span>
              </button>
            </div>
            <p className="text-center text-[10px] text-gray-700 mt-2">
              The Oracle queries live DOME data in real time · Questions are stored and inform the nightly synthesis · Enter to ask
            </p>
          </div>
        </>
      )}

      {/* ── BROWSE VIEW ───────────────────────────────────────────────────── */}
      {view === 'browse' && (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Filter bar */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-3 overflow-x-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-[10px] text-gray-600 shrink-0 mr-1">FILTER</span>
            {allTypes.map(type => {
              const cfg = type === 'all' ? { color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', label: 'ALL' } : (TYPE_CONFIG[type] || DEFAULT_TYPE);
              const active = wisdomFilter === type;
              return (
                <button key={type} onClick={() => setWisdomFilter(type)}
                  className="shrink-0 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider transition-all"
                  style={{ color: active ? cfg.color : '#4b5563', background: active ? cfg.bg : 'transparent', border: `1px solid ${active ? cfg.color + '60' : 'rgba(255,255,255,0.07)'}` }}>
                  {cfg.label}
                </button>
              );
            })}
            <button onClick={fetchWisdom} className="ml-auto shrink-0 px-3 py-1 rounded-full text-[10px] text-gray-600 transition-all hover:text-gray-400" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
              {wisdomLoading ? '⟳ Loading...' : '↺ Refresh'}
            </button>
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {wisdomLoading && wisdomEntries.length === 0 && (
              <div className="flex items-center justify-center h-32 text-gray-600 text-sm">Loading wisdom...</div>
            )}
            {!wisdomLoading && filteredWisdom.length === 0 && (
              <div className="flex items-center justify-center h-32 text-gray-600 text-sm">No entries for this filter</div>
            )}
            {filteredWisdom.map((entry, i) => {
              const type = entry.insight_type || 'insight';
              const cfg = TYPE_CONFIG[type] || DEFAULT_TYPE;
              const pColor = PRIORITY_COLOR[entry.priority || ''] || '#6b7280';
              const isExpanded = expandedId === (entry.id || String(i));
              const dateStr = entry.run_date || (entry.created_at ? entry.created_at.slice(0,10) : '');
              return (
                <div key={entry.id || i}
                  onClick={() => setExpandedId(isExpanded ? null : (entry.id || String(i)))}
                  className="rounded-xl p-4 cursor-pointer transition-all"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${isExpanded ? cfg.color + '40' : 'rgba(255,255,255,0.06)'}`, boxShadow: isExpanded ? `0 0 20px ${cfg.color}15` : 'none' }}>
                  {/* Card header */}
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1.5 shrink-0 pt-0.5">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wider" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                      {entry.priority && <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wider text-center" style={{ color: pColor, background: `${pColor}18` }}>{entry.priority.toUpperCase()}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white leading-snug">{entry.title}</div>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed" style={{ display: isExpanded ? undefined : '-webkit-box', WebkitLineClamp: isExpanded ? undefined : 2, WebkitBoxOrient: isExpanded ? undefined : 'vertical' as any, overflow: isExpanded ? undefined : 'hidden' }}>
                        {entry.insight}
                      </p>
                    </div>
                    <div className="shrink-0 text-[10px] text-gray-600 ml-2">{dateStr}</div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {entry.evidence && (
                        <div>
                          <div className="text-[10px] text-gray-600 font-bold tracking-wider mb-1">EVIDENCE</div>
                          <p className="text-xs text-gray-400 leading-relaxed">{entry.evidence}</p>
                        </div>
                      )}
                      {entry.relevant_projects && entry.relevant_projects.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[10px] text-gray-600 font-bold tracking-wider self-center">PROJECTS</span>
                          {entry.relevant_projects.map(p => (
                            <span key={p} className="px-2 py-0.5 rounded text-[10px]" style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>{p}</span>
                          ))}
                        </div>
                      )}
                      {entry.relevant_team_members && entry.relevant_team_members.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[10px] text-gray-600 font-bold tracking-wider self-center">TEAM</span>
                          {entry.relevant_team_members.map(m => (
                            <span key={m} className="px-2 py-0.5 rounded text-[10px]" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>{m}</span>
                          ))}
                        </div>
                      )}
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {entry.tags.map(t => (
                            <span key={t} className="px-2 py-0.5 rounded text-[9px]" style={{ background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.08)' }}>#{t}</span>
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
    </div>
  );
}
