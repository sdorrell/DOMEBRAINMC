import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

type OracleState = 'idle' | 'thinking' | 'answering';
type ViewMode = 'oracle' | 'history' | 'browse' | 'grade';

// ── Types ─────────────────────────────────────────────────────────────────────
interface OracleSession {
  id: string;
  question: string;
  answer: string;
  team_member: string | null;
  created_at: string;
}

interface OracleIntelligence {
  id: string;
  assessed_at: string;
  career_level: string;
  career_score: number;
  domain_scores: Record<string, number>;
  strengths: string[];
  knowledge_gaps: string[];
  next_milestone: string | null;
  self_assessment: string | null;
  data_sources_used: string[];
  questions_answered: number;
  sessions_analyzed: number;
}

// ── Career ladder ──────────────────────────────────────────────────────────────
const CAREER_LADDER = [
  { level: 'Intern',          min: 0,  max: 18,  color: '#6b7280', glow: 'rgba(107,114,128,0.4)',  icon: '🎓', desc: 'Still learning the org chart' },
  { level: 'Analyst',         min: 18, max: 35,  color: '#3b82f6', glow: 'rgba(59,130,246,0.4)',   icon: '📊', desc: 'Reading dashboards, spotting patterns' },
  { level: 'Sr. Analyst',     min: 35, max: 50,  color: '#8b5cf6', glow: 'rgba(139,92,246,0.4)',   icon: '🔍', desc: 'Cross-functional data fluency' },
  { level: 'Manager',         min: 50, max: 62,  color: '#06b6d4', glow: 'rgba(6,182,212,0.4)',    icon: '👔', desc: 'Driving decisions in one department' },
  { level: 'Director',        min: 62, max: 74,  color: '#f59e0b', glow: 'rgba(245,158,11,0.4)',   icon: '🎯', desc: 'Multi-department strategic thinking' },
  { level: 'VP',              min: 74, max: 83,  color: '#f97316', glow: 'rgba(249,115,22,0.4)',   icon: '⭐', desc: 'Org-wide optimization authority' },
  { level: 'COO',             min: 83, max: 88,  color: '#10b981', glow: 'rgba(16,185,129,0.4)',   icon: '⚙️', desc: 'Full operational command' },
  { level: 'CMO',             min: 83, max: 88,  color: '#ec4899', glow: 'rgba(236,72,153,0.4)',   icon: '📣', desc: 'Growth and brand mastery' },
  { level: 'CFO',             min: 83, max: 88,  color: '#22c55e', glow: 'rgba(34,197,94,0.4)',    icon: '💰', desc: 'Financial architecture command' },
  { level: 'CTO',             min: 83, max: 88,  color: '#60a5fa', glow: 'rgba(96,165,250,0.4)',   icon: '🔧', desc: 'Full-stack technology mastery' },
  { level: 'CEO',             min: 94, max: 100, color: '#fbbf24', glow: 'rgba(251,191,36,0.6)',   icon: '👑', desc: 'Runs the company better than humans' },
];

const DOMAINS = [
  { key: 'sales',      label: 'Sales',       icon: '💼', desc: 'Member volume, plan mix, agent production' },
  { key: 'marketing',  label: 'Marketing',   icon: '📣', desc: 'Channel ROI, cost/call, conversion rates' },
  { key: 'finance',    label: 'Finance',     icon: '💰', desc: 'Revenue, commissions, cash flow, P&L' },
  { key: 'operations', label: 'Operations',  icon: '⚙️', desc: 'Call center KPIs, service levels, efficiency' },
  { key: 'technology', label: 'Technology',  icon: '🔧', desc: 'Systems, integrations, data pipelines' },
  { key: 'hr',         label: 'People',      icon: '👥', desc: 'Team performance, agent behavior, retention' },
  { key: 'strategy',   label: 'Strategy',    icon: '🎯', desc: 'Cross-functional synthesis, growth levers' },
];

function getCareerTier(score: number) {
  return CAREER_LADDER.find(t => score >= t.min && score < t.max) || CAREER_LADDER[CAREER_LADDER.length - 1];
}

// Self-grading prompt sent to Oracle server
const SELF_GRADE_PROMPT = `You are the DOME Oracle. Conduct a rigorous self-assessment of your current intelligence and understanding of the DOME business.

DOME is a health benefits sales organization that sells subscription-based benefit plans (dental, vision, wellness, limited benefit health insurance, fixed indemnity, value-added benefits) averaging $280-$480/month. They operate a call center with tracked agents, run paid advertising campaigns across multiple channels, and manage tens of thousands of active members.

Your available data sources include:
- commission_members: 80,000+ customer records (product, state, revenue, agent, activity)
- commission_transactions: payment and commission history
- cs_agent_snapshots: daily agent call metrics (calls, talk time, pause categories, bonus scores)
- cs_nim_daily: call center daily KPIs (answer rate, queue time, service level, drops)
- cs_kpi_targets: performance targets
- dome_wisdom: nightly synthesis insights
- dome_oracle_sessions: full Q&A history with the team
- QuickBooks: financial data (P&L, cash flow, accounts)

Grade yourself across 7 domains on a scale of 0-100. Be HONEST and HARSH about gaps.

Respond ONLY with this exact JSON format (no other text):
{
  "career_score": <0-100 integer>,
  "career_level": "<one of: Intern, Analyst, Sr. Analyst, Manager, Director, VP, COO, CMO, CFO, CTO, CEO>",
  "domain_scores": {
    "sales": <0-100>,
    "marketing": <0-100>,
    "finance": <0-100>,
    "operations": <0-100>,
    "technology": <0-100>,
    "hr": <0-100>,
    "strategy": <0-100>
  },
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "knowledge_gaps": ["<gap 1>", "<gap 2>", "<gap 3>", "<gap 4>"],
  "next_milestone": "<what specific data/queries I need to level up>",
  "self_assessment": "<2-3 sentence honest narrative of current capabilities and what's holding me back>"
}`;
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

  // Browse / history state
  const [view, setView] = useState<ViewMode>('oracle');
  const [wisdomEntries, setWisdomEntries] = useState<WisdomEntry[]>([]);
  const [wisdomFilter, setWisdomFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [wisdomLoading, setWisdomLoading] = useState(false);
  // Q&A history
  const [sessions, setSessions] = useState<OracleSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  // Oracle intelligence / self-grading
  const [intelligence, setIntelligence] = useState<OracleIntelligence | null>(null);
  const [grading, setGrading] = useState(false);

  const ORACLE_KEY = (window as any).__DOME_ENV__?.ORACLE_KEY || (import.meta.env.VITE_ORACLE_KEY as string) || '';

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

  // ── Fetch Q&A session history ────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    const { data } = await supabase
      .from('dome_oracle_sessions')
      .select('id, question, answer, team_member, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setSessions(data as OracleSession[]);
    setSessionsLoading(false);
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // ── Load latest intelligence assessment ────────────────────────────────────
  const loadIntelligence = useCallback(async () => {
    const { data } = await supabase
      .from('dome_oracle_intelligence')
      .select('*')
      .order('assessed_at', { ascending: false })
      .limit(1)
      .single();
    if (data) setIntelligence(data as OracleIntelligence);
  }, []);

  useEffect(() => { loadIntelligence(); }, [loadIntelligence]);

  // ── Self-grading engine ─────────────────────────────────────────────────────
  const runSelfAssessment = useCallback(async () => {
    if (grading || oracleState !== 'idle') return;
    setGrading(true);
    try {
      const [sessCount, wisdomCount] = await Promise.all([
        supabase.from('dome_oracle_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('dome_wisdom').select('id', { count: 'exact', head: true }),
      ]);
      const res = await fetch(`${ORACLE_URL}/oracle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ORACLE_KEY}` },
        body: JSON.stringify({ question: SELF_GRADE_PROMPT }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const { answer } = await res.json();
      // Extract JSON from the answer (might have surrounding text)
      const jsonMatch = answer.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      const parsed = JSON.parse(jsonMatch[0]);
      // Save to Supabase
      const { data: saved } = await supabase.from('dome_oracle_intelligence').insert({
        career_level: parsed.career_level,
        career_score: parsed.career_score,
        domain_scores: parsed.domain_scores,
        strengths: parsed.strengths,
        knowledge_gaps: parsed.knowledge_gaps,
        next_milestone: parsed.next_milestone,
        self_assessment: parsed.self_assessment,
        data_sources_used: ['commission_members','commission_transactions','cs_agent_snapshots','cs_nim_daily','dome_wisdom','dome_oracle_sessions'],
        questions_answered: sessCount.count || 0,
        sessions_analyzed: wisdomCount.count || 0,
      }).select().single();
      if (saved) setIntelligence(saved as OracleIntelligence);
    } catch(e) {
      console.error('Self-assessment failed:', e);
    }
    setGrading(false);
  }, [grading, oracleState, ORACLE_KEY]);

  // ── Audio ───────────────────────────────────────────────────────────────────
  const getCtx=()=>{ if(!audioCtxRef.current) audioCtxRef.current=new(window.AudioContext||(window as any).webkitAudioContext)(); return audioCtxRef.current; };
  const playThinking=()=>{ try{ const ctx=getCtx(); thinkOscRef.current.forEach(o=>{try{o.stop();}catch{}}); thinkOscRef.current=[]; [82.4,110,164.8,220,293.7].forEach((freq,i)=>{ const osc=ctx.createOscillator(),gain=ctx.createGain(); osc.type=i%2===0?'sine':'triangle'; osc.frequency.setValueAtTime(freq,ctx.currentTime); osc.frequency.linearRampToValueAtTime(freq*1.62,ctx.currentTime+4.5); gain.gain.setValueAtTime(0,ctx.currentTime); gain.gain.linearRampToValueAtTime(0.03,ctx.currentTime+1.0); osc.connect(gain); gain.connect(ctx.destination); osc.start(); thinkOscRef.current.push(osc); }); }catch{} };
  const stopThinking=()=>{ const ctx=audioCtxRef.current; thinkOscRef.current.forEach(o=>{try{o.stop(ctx?ctx.currentTime+0.5:0);}catch{}}); thinkOscRef.current=[]; };
  const playAnswer=()=>{ try{ const ctx=getCtx(); [528,660,792,990,1320].forEach((freq,i)=>{ const osc=ctx.createOscillator(),gain=ctx.createGain(); osc.type='sine'; osc.frequency.value=freq; const t=ctx.currentTime+i*0.16; gain.gain.setValueAtTime(0,t); gain.gain.linearRampToValueAtTime(0.07,t+0.04); gain.gain.exponentialRampToValueAtTime(0.001,t+3.2); osc.connect(gain); gain.connect(ctx.destination); osc.start(t); osc.stop(t+3.5); }); const sw=ctx.createOscillator(),swg=ctx.createGain(); sw.type='triangle'; sw.frequency.setValueAtTime(1600,ctx.currentTime+0.5); sw.frequency.exponentialRampToValueAtTime(6000,ctx.currentTime+2.0); swg.gain.setValueAtTime(0,ctx.currentTime+0.5); swg.gain.linearRampToValueAtTime(0.022,ctx.currentTime+0.8); swg.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+2.5); sw.connect(swg); swg.connect(ctx.destination); sw.start(ctx.currentTime+0.5); sw.stop(ctx.currentTime+2.8); }catch{} };

  // ── Ask the Oracle ──────────────────────────────────────────────────────────
  const handleAsk = async () => {
    if (!question.trim() || isLoading || oracleState !== 'idle') return;
    setIsLoading(true); setAnswer(null); setAnswerVisible(false);
    setQuestion('');
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
      // Return canvas to idle after animation, keep answer panel visible
      setTimeout(() => { stateRef.current = 'idle'; setOracleState('idle'); }, 3000);
      // Refresh history after question
      setTimeout(() => { fetchWisdom(); loadSessions(); }, 2000);
    } catch (err: any) {
      stopThinking(); stateRef.current='idle'; setOracleState('idle');
      setStatusText(`Oracle unreachable: ${err?.message ?? 'unknown error'}`);
      setAnswerVisible(false);
    } finally { setIsLoading(false); }
  };

  // ── Derived browse data ─────────────────────────────────────────────────────
  // Filter out raw question log entries and deduplicate by title
  const seenTitles = new Set<string>();
  const cleanedWisdom = wisdomEntries.filter(e => {
    // Filter out raw question log entries (the insight field contains the prefix)
    if ((e.insight || '').startsWith('[User Question from DOME Oracle]')) return false;
    // Deduplicate by title
    const title = e.title || '';
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

  // ── Markdown renderer ────────────────────────────────────────────────────────
  function renderMarkdown(text: string) {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      // Table detection — consecutive | rows
      if (line.trim().startsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        const rows = tableLines.filter(l => !l.match(/^\|[\s\-|]+\|$/)); // skip separator rows
        elements.push(
          <div key={`tbl-${i}`} className="overflow-x-auto my-2">
            <table className="text-xs w-full border-collapse">
              {rows.map((row, ri) => {
                const cells = row.split('|').filter((_, ci) => ci > 0 && ci < row.split('|').length - 1);
                const Tag = ri === 0 ? 'th' : 'td';
                return (
                  <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {cells.map((cell, ci) => (
                      <Tag key={ci} className={`px-2 py-1 text-left ${ri === 0 ? 'font-bold text-yellow-300/80' : 'text-gray-300'}`}
                        dangerouslySetInnerHTML={{ __html: inlineFormat(cell.trim()) }} />
                    ))}
                  </tr>
                );
              })}
            </table>
          </div>
        );
        continue;
      }
      // Numbered list
      if (/^\d+\.\s/.test(line.trim())) {
        const listItems: string[] = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
          listItems.push(lines[i].trim().replace(/^\d+\.\s/, ''));
          i++;
        }
        elements.push(
          <ol key={`ol-${i}`} className="list-decimal list-inside space-y-0.5 my-1 text-sm text-gray-300">
            {listItems.map((item, li) => <li key={li} dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />)}
          </ol>
        );
        continue;
      }
      // Bullet list
      if (/^[-*]\s/.test(line.trim())) {
        const listItems: string[] = [];
        while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
          listItems.push(lines[i].trim().replace(/^[-*]\s/, ''));
          i++;
        }
        elements.push(
          <ul key={`ul-${i}`} className="space-y-0.5 my-1 text-sm text-gray-300">
            {listItems.map((item, li) => (
              <li key={li} className="flex gap-1.5">
                <span className="text-yellow-400/60 shrink-0 mt-0.5">·</span>
                <span dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
              </li>
            ))}
          </ul>
        );
        continue;
      }
      // Header
      if (line.startsWith('##')) {
        elements.push(<div key={`h-${i}`} className="text-xs font-bold text-yellow-300/70 tracking-wider uppercase mt-3 mb-1">{line.replace(/^#+\s*/, '')}</div>);
        i++; continue;
      }
      // Empty line
      if (!line.trim()) { elements.push(<div key={`br-${i}`} className="h-2" />); i++; continue; }
      // Regular paragraph
      elements.push(<p key={`p-${i}`} className="text-sm text-gray-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />);
      i++;
    }
    return elements;
  }

  function inlineFormat(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="text-gray-200">$1</em>')
      .replace(/`(.+?)`/g, '<code class="text-yellow-300/80 bg-white/5 px-1 rounded text-xs">$1</code>');
  }

  function timeAgoSession(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg,#04040e 0%,#060612 100%)' }}>

      {/* ── Status / nav bar ──────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.5)' }}>
        {/* State dot */}
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: STATE_COLOR[oracleState], boxShadow: `0 0 8px ${STATE_COLOR[oracleState]}`, animation: oracleState==='thinking'?'pulse 0.7s ease-in-out infinite alternate':undefined }} />
        <span className="text-[10px] tracking-widest font-bold shrink-0" style={{ color: STATE_COLOR[oracleState] }}>{STATE_LABEL[oracleState]}</span>
        <span className="text-[10px] text-gray-600 truncate flex-1">{statusText}</span>

        {/* Career level badge */}
        {intelligence && (() => {
          const tier = getCareerTier(intelligence.career_score);
          return (
            <button onClick={() => setView('grade')}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all hover:scale-105"
              style={{ background: `${tier.glow}`, border: `1px solid ${tier.color}60`, color: tier.color, boxShadow: `0 0 10px ${tier.glow}` }}>
              <span>{tier.icon}</span>
              <span>{intelligence.career_level}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{intelligence.career_score}</span>
            </button>
          );
        })()}

        {/* View toggle */}
        <div className="flex shrink-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '2px' }}>
          {([
            { id: 'oracle',   label: '✦ Ask' },
            { id: 'history',  label: `💬 History${sessions.length > 0 ? ` (${sessions.length})` : ''}` },
            { id: 'browse',   label: `◈ Insights${cleanedWisdom.length > 0 ? ` (${cleanedWisdom.length})` : ''}` },
            { id: 'grade',    label: `🎓 Level Up` },
          ] as { id: ViewMode; label: string }[]).map(({ id, label }) => (
            <button key={id} onClick={() => setView(id)}
              className="px-3 py-1 rounded-md text-[10px] font-semibold tracking-wider transition-all"
              style={view === id
                ? { background: 'rgba(99,102,241,0.3)', color: '#e0e7ff', border: '1px solid rgba(99,102,241,0.4)' }
                : { color: '#4b5563', border: '1px solid transparent' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── ORACLE VIEW ───────────────────────────────────────────────────── */}
      {view === 'oracle' && (
        <>
          {/* Canvas — shrinks when answer is shown */}
          <div className="relative shrink-0 transition-all duration-500" style={{ height: answer && answerVisible ? '160px' : 'calc(100% - 180px)', minHeight: '100px' }}>
            <canvas ref={canvasRef} className="w-full h-full block" />
            {oracleState === 'idle' && !answer && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-[11px] tracking-[0.35em] font-bold" style={{ color: 'rgba(75,85,99,0.7)' }}>✦ DOME WISDOM ORACLE ✦</div>
              </div>
            )}
            {oracleState === 'thinking' && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="text-[11px] tracking-[0.3em] font-bold px-4 py-1.5 rounded-full"
                  style={{ color: '#60a5fa', background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(96,165,250,0.2)', animation: 'pulse 1.2s ease-in-out infinite alternate' }}>
                  CHANNELING DOME KNOWLEDGE...
                </div>
              </div>
            )}
          </div>

          {/* Answer panel — persists until next question */}
          {answer && answerVisible && (
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3" style={{ borderTop: '1px solid rgba(251,191,36,0.2)', background: 'rgba(0,0,0,0.85)' }}>
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] tracking-[0.35em] font-bold" style={{ color: '#fbbf24' }}>◈ ORACLE ANSWER</div>
                  <button onClick={() => { setAnswer(null); setAnswerVisible(false); stateRef.current='idle'; setOracleState('idle'); setStatusText('Seek knowledge from the DOME Oracle...'); }}
                    className="text-gray-600 hover:text-gray-400 text-xs px-2 py-0.5 rounded"
                    style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                    ✕ Dismiss
                  </button>
                </div>
                <div className="space-y-1">
                  {renderMarkdown(answer)}
                </div>
                <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-[10px]" style={{ color: 'rgba(251,191,36,0.3)' }}>Synthesized from live DOME data · Stored in History</span>
                  <button onClick={() => setView('history')}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors">
                    View all history →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="shrink-0 p-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
            <div className="max-w-3xl mx-auto flex gap-2 items-end">
              <textarea value={question} onChange={e=>setQuestion(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleAsk();} }}
                placeholder="Ask the Oracle anything about DOME — revenue, agent performance, marketing ROI, best states..."
                rows={2} disabled={isLoading||oracleState!=='idle'}
                className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm placeholder-gray-700 outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${oracleState!=='idle'?'rgba(251,191,36,0.25)':'rgba(255,255,255,0.09)'}`, color: '#e2e8f0', lineHeight: 1.5 }} />
              <button onClick={handleAsk} disabled={!question.trim()||isLoading||oracleState!=='idle'}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: question.trim()&&oracleState==='idle'?'linear-gradient(135deg,#4f46e5,#7c3aed)':'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: question.trim()&&oracleState==='idle'?'#e0e7ff':'#374151', boxShadow: question.trim()&&oracleState==='idle'?'0 0 24px rgba(99,102,241,0.45)':'none', cursor: question.trim()&&oracleState==='idle'?'pointer':'not-allowed' }}>
                <span>{oracleState==='thinking'?'⟳':'✦'}</span>
                <span>{oracleState==='thinking'?'Channeling...':oracleState==='answering'?'Speaking...':'Ask'}</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── HISTORY VIEW ──────────────────────────────────────────────────── */}
      {view === 'history' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="shrink-0 flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Past Questions & Answers</span>
            <button onClick={loadSessions} className="text-[10px] text-gray-600 hover:text-gray-400"
              style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '2px 8px' }}>
              {sessionsLoading ? '⟳ Loading...' : '↺ Refresh'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {sessionsLoading && sessions.length === 0 && (
              <div className="flex items-center justify-center h-32 text-gray-600 text-sm">Loading history...</div>
            )}
            {!sessionsLoading && sessions.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
                <div className="text-4xl opacity-20">💬</div>
                <div className="text-gray-600 text-sm">No questions asked yet.</div>
                <button onClick={() => setView('oracle')} className="text-xs text-indigo-400 hover:text-indigo-300">Ask the Oracle →</button>
              </div>
            )}
            {sessions.map(s => {
              const isExpanded = expandedSession === s.id;
              return (
                <div key={s.id} className="rounded-xl overflow-hidden cursor-pointer transition-all"
                  style={{ border: `1px solid ${isExpanded ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.07)'}`, background: isExpanded ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.02)' }}
                  onClick={() => setExpandedSession(isExpanded ? null : s.id)}>
                  {/* Question header */}
                  <div className="flex items-start gap-3 p-3">
                    <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5"
                      style={{ background: 'rgba(99,102,241,0.25)', color: '#a5b4fc' }}>Q</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white leading-snug">{s.question}</div>
                      <div className="text-[10px] text-gray-600 mt-0.5 flex items-center gap-2">
                        <span>{timeAgoSession(s.created_at)}</span>
                        {s.team_member && <><span>·</span><span>{s.team_member}</span></>}
                        <span>·</span>
                        <span className="text-indigo-400/60">{isExpanded ? '▲ collapse' : '▼ show answer'}</span>
                      </div>
                    </div>
                  </div>
                  {/* Answer — expanded */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="text-[10px] font-bold text-yellow-400/50 tracking-widest mb-2">◈ ANSWER</div>
                      {renderMarkdown(s.answer)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── GRADE / LEVEL UP VIEW ─────────────────────────────────────────── */}
      {view === 'grade' && (() => {
        const tier = intelligence ? getCareerTier(intelligence.career_score) : CAREER_LADDER[0];
        const nextTier = intelligence
          ? CAREER_LADDER.find(t => t.min > intelligence.career_score) || CAREER_LADDER[CAREER_LADDER.length - 1]
          : CAREER_LADDER[1];
        const pctToNext = intelligence
          ? Math.min(100, Math.round(((intelligence.career_score - tier.min) / Math.max(1, nextTier.min - tier.min)) * 100))
          : 0;

        return (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">

            {/* ── Current level card ── */}
            <div className="rounded-2xl p-5 text-center relative overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.6)', border: `2px solid ${tier.color}50`, boxShadow: `0 0 40px ${tier.glow}` }}>
              <div className="absolute inset-0 opacity-5"
                style={{ background: `radial-gradient(circle at 50% 40%, ${tier.color}, transparent 70%)` }} />
              <div className="relative">
                <div className="text-5xl mb-2">{tier.icon}</div>
                <div className="text-2xl font-black" style={{ color: tier.color }}>{intelligence?.career_level ?? 'Ungraded'}</div>
                <div className="text-xs text-gray-500 mt-1 mb-3">{tier.desc}</div>

                {/* Score bar */}
                <div className="max-w-xs mx-auto">
                  <div className="flex justify-between text-[10px] text-gray-600 mb-1">
                    <span>Score: <strong style={{ color: tier.color }}>{intelligence?.career_score ?? 0}</strong>/100</span>
                    <span>Next: {nextTier.icon} {nextTier.level} at {nextTier.min}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <div className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${pctToNext}%`, background: `linear-gradient(90deg, ${tier.color}, ${nextTier.color})`, boxShadow: `0 0 8px ${tier.glow}` }} />
                  </div>
                  <div className="text-[10px] text-gray-600 mt-1 text-right">{pctToNext}% to {nextTier.level}</div>
                </div>

                {intelligence?.self_assessment && (
                  <p className="text-xs text-gray-400 mt-3 italic max-w-md mx-auto leading-relaxed">
                    "{intelligence.self_assessment}"
                  </p>
                )}
              </div>
            </div>

            {/* ── Domain scores ── */}
            {intelligence?.domain_scores && (
              <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Domain Intelligence</div>
                <div className="space-y-2">
                  {DOMAINS.map(d => {
                    const score = intelligence.domain_scores[d.key] ?? 0;
                    const domTier = getCareerTier(score);
                    return (
                      <div key={d.key}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">{d.icon}</span>
                          <span className="text-xs font-semibold text-white w-20 shrink-0">{d.label}</span>
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${score}%`, background: domTier.color, boxShadow: `0 0 6px ${domTier.glow}` }} />
                          </div>
                          <span className="text-[10px] font-black shrink-0" style={{ color: domTier.color, width: 28, textAlign: 'right' }}>{score}</span>
                          <span className="text-[9px] shrink-0 px-1.5 py-0.5 rounded" style={{ background: `${domTier.color}20`, color: domTier.color }}>{domTier.level}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Strengths & Gaps ── */}
            <div className="grid grid-cols-2 gap-3">
              {intelligence?.strengths && intelligence.strengths.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70 mb-2">✓ Strengths</div>
                  <ul className="space-y-1.5">
                    {intelligence.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-gray-300 flex gap-1.5">
                        <span className="text-emerald-400/50 shrink-0">·</span><span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {intelligence?.knowledge_gaps && intelligence.knowledge_gaps.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-red-400/70 mb-2">⚠ Knowledge Gaps</div>
                  <ul className="space-y-1.5">
                    {intelligence.knowledge_gaps.map((g, i) => (
                      <li key={i} className="text-xs text-gray-300 flex gap-1.5">
                        <span className="text-red-400/50 shrink-0">·</span><span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* ── Next milestone ── */}
            {intelligence?.next_milestone && (
              <div className="rounded-xl p-4" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)' }}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-yellow-400/70 mb-1">To reach {nextTier.icon} {nextTier.level}:</div>
                <p className="text-sm text-gray-300">{intelligence.next_milestone}</p>
              </div>
            )}

            {/* ── Career ladder ── */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">Career Path to CEO</div>
              <div className="flex flex-wrap gap-2">
                {CAREER_LADDER.filter((t,i,arr) => arr.findIndex(x=>x.level===t.level)===i).map(t => {
                  const reached = intelligence && intelligence.career_score >= t.min;
                  return (
                    <div key={t.level} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                      style={{
                        background: reached ? `${t.glow}` : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${reached ? t.color + '70' : 'rgba(255,255,255,0.07)'}`,
                        color: reached ? t.color : '#374151',
                        boxShadow: reached ? `0 0 8px ${t.glow}` : 'none',
                      }}>
                      <span>{t.icon}</span>
                      <span>{t.level}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Grade button ── */}
            <div className="pb-4 flex flex-col items-center gap-2">
              {intelligence?.assessed_at && (
                <div className="text-[10px] text-gray-600">
                  Last assessed: {new Date(intelligence.assessed_at).toLocaleString()} · {intelligence.questions_answered} Q&As analyzed
                </div>
              )}
              <button onClick={runSelfAssessment} disabled={grading || oracleState !== 'idle'}
                className="px-6 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: grading ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  color: grading ? '#4b5563' : 'white',
                  border: 'none',
                  boxShadow: grading ? 'none' : '0 0 24px rgba(124,58,237,0.5)',
                }}>
                {grading ? '⟳ Grading...' : intelligence ? '↺ Re-Grade Myself' : '🎓 Grade Myself Now'}
              </button>
              <p className="text-[10px] text-gray-700 text-center max-w-xs">
                Oracle queries all live business data and scores its own understanding across 7 domains. Goal: reach CEO level.
              </p>
            </div>
          </div>
        );
      })()}

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
