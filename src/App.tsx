import { useState, useEffect, useRef, useCallback } from 'react';

import WorldMap from './components/WorldMap';
import Dashboard from './components/Dashboard';
import CalendarView from './components/CalendarView';
import IdeasBoard from './components/IdeasBoard';
import BadgesView from './components/BadgesView';
import Leaderboard from './components/Leaderboard';
import BattleModal from './components/BattleModal';
import ProjectsView from './components/ProjectsView';
import UpdateRequests from './components/UpdateRequests';
import AdminPanel from './components/AdminPanel';
import WisdomOracle from './components/WisdomOracle';
import LoginScreen from './components/LoginScreen';
import WelcomeTour, { shouldShowWelcomeTour } from './components/WelcomeTour';
import { useSupabaseSync } from './hooks/useSupabaseSync';
import { TEAM_MEMBERS, getLevelTier, ZONES, BADGE_MAP } from './data/gameData';
import {
  sendBattleChallenge,
  fetchPendingChallenges,
  fetchOutgoingChallenges,
  subscribeToBattleChallenges,
  respondToChallenge,
  completeBattleChallenge,
  type DBBattleChallenge,
  logMeetingSession,
  getConfig,
  setConfig,
  sendChatMessage,
  updateLoginStreak,
  addXp,
  subscribeToNewBadges,
} from './lib/supabase';
import type { Zone, TeamMember, Badge } from './types';
import './index.css';

type Tab = 'world' | 'dashboard' | 'calendar' | 'projects' | 'ideas' | 'badges' | 'leaderboard' | 'battles' | 'requests' | 'admin' | 'wisdom';

export default function App() {
  const [loggedInId, setLoggedInId] = useState<string | null>(() => {
    try { return localStorage.getItem('dome_user_id'); } catch { return null; }
  });

  const handleLogin = (memberId: string) => {
    try { localStorage.setItem('dome_user_id', memberId); } catch { /* ignore */ }
    setLoggedInId(memberId);
  };

  if (!loggedInId) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <AppShell controlledMemberId={loggedInId} onLogout={() => {
    try { localStorage.removeItem('dome_user_id'); } catch { /* ignore */ }
    setLoggedInId(null);
  }} />;
}

// ─── Challenge Notification Overlay ───────────────────────────────────────────

function ChallengeNotification({
  challenge,
  challengerName,
  onAccept,
  onDecline,
}: {
  challenge: DBBattleChallenge;
  challengerName: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      {/* Animated glow ring */}
      <div className="relative flex flex-col items-center gap-5 p-8 rounded-2xl max-w-sm w-full"
        style={{
          background: 'linear-gradient(135deg, #0d1117 0%, #1a0a2e 100%)',
          border: '2px solid rgba(239,68,68,0.7)',
          boxShadow: '0 0 60px rgba(239,68,68,0.4), 0 0 120px rgba(239,68,68,0.15)',
        }}>
        {/* Pulse ring */}
        <div className="absolute inset-0 rounded-2xl animate-ping pointer-events-none"
          style={{ border: '2px solid rgba(239,68,68,0.3)', animationDuration: '1.5s' }} />

        <div className="text-5xl animate-bounce">⚔️</div>
        <div className="text-center">
          <div className="text-white font-black text-xl mb-1">YOU'VE BEEN CHALLENGED</div>
          <div className="text-red-400 font-bold text-lg">{challengerName} wants to fight!</div>
        </div>

        <div className="text-gray-400 text-xs text-center leading-relaxed">
          Accept to jump straight into battle.<br />
          Decline to avoid the fight (coward 🐔).
        </div>

        {/* Buttons */}
        <div className="flex gap-3 w-full">
          <button onClick={onDecline}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#9ca3af' }}>
            😤 Decline
          </button>
          <button onClick={onAccept}
            className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
              boxShadow: '0 0 20px rgba(239,68,68,0.5)',
              color: 'white',
              border: 'none',
            }}>
            ⚔️ FIGHT!
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Challenge Sent Banner ─────────────────────────────────────────────────────

function ChallengeSentBanner({ targetName, onDismiss }: { targetName: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl flex items-center gap-3 text-sm font-medium"
      style={{
        background: 'rgba(0,0,0,0.95)',
        border: '1px solid rgba(239,68,68,0.6)',
        boxShadow: '0 0 24px rgba(239,68,68,0.3)',
        color: 'white',
      }}>
      <span className="text-xl">⚔️</span>
      <div>
        <div className="font-black">Challenge Sent!</div>
        <div className="text-gray-400 text-xs">Waiting for {targetName} to respond...</div>
      </div>
      <button onClick={onDismiss} className="ml-2 text-gray-500 hover:text-gray-300 text-lg leading-none">×</button>
    </div>
  );
}

// ─── DOME Meeting Modal ────────────────────────────────────────────────────────

function DomeMeetingModal({
  me,
  liveMembers,
  onSendChat,
  onClose,
}: {
  me: TeamMember;
  liveMembers: TeamMember[];
  onSendChat: (text: string) => Promise<void>;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [announced, setAnnounced] = useState(false);

  // Figure out who is currently in the green_couch zone
  const couchZone = ZONES.find(z => z.id === 'green_couch');
  const couchTileKeys = new Set(couchZone?.tiles.map(t => `${t.x},${t.y}`) ?? []);

  const attendees = liveMembers.filter(m => {
    // liveMembers may carry worldX/worldY from DB player state
    const key = `${m.worldX},${m.worldY}`;
    return couchTileKeys.has(key);
  });

  const handleAnnounce = async () => {
    const names = attendees.length > 0
      ? attendees.map(m => m.name).join(', ')
      : me.name;
    await onSendChat(`🛋️ DOME Meeting started! Attendees: ${names}`);
    setAnnounced(true);
  };

  const handleLogNotes = async () => {
    if (!notes.trim()) return;
    setSaving(true);
    await logMeetingSession(me.name, notes.trim(), nextSteps.trim() || null, []);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setNotes('');
    setNextSteps('');
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative rounded-2xl p-6 flex flex-col gap-5 w-full max-w-lg"
        style={{
          background: 'linear-gradient(135deg, rgba(10,40,10,0.98), rgba(5,25,5,0.98))',
          border: '2px solid rgba(67,160,71,0.4)',
          boxShadow: '0 0 60px rgba(67,160,71,0.25), inset 0 0 0 1px rgba(255,255,255,0.04)',
        }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🛋️</span>
              <span className="text-xl font-black text-white">DOME Meeting</span>
            </div>
            <div className="text-xs text-green-400/70 mt-0.5">The legendary green couch — where decisions are made</div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)' }}>✕</button>
        </div>

        {/* Attendees */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(67,160,71,0.2)' }}>
          <div className="text-[10px] font-bold text-green-500/70 uppercase tracking-widest mb-3">On The Couch</div>
          {attendees.length === 0 ? (
            <div className="text-gray-500 text-xs">Walk to the 🛋️ zone to show up here. Only you right now.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {attendees.map(m => (
                <div key={m.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                  style={{ background: `${m.avatarColor}15`, border: `1px solid ${m.avatarColor}33` }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-black"
                    style={{ background: m.avatarColor }}>{m.name[0]}</div>
                  <span className="text-xs font-bold" style={{ color: m.avatarColor }}>{m.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Announce button */}
        <button
          onClick={handleAnnounce}
          disabled={announced}
          className="w-full py-2.5 rounded-xl font-black text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{
            background: announced ? 'rgba(34,197,94,0.15)' : 'linear-gradient(135deg, #2e7d32, #1b5e20)',
            border: `1px solid ${announced ? 'rgba(34,197,94,0.4)' : 'rgba(67,160,71,0.5)'}`,
            color: announced ? '#4ade80' : 'white',
            boxShadow: announced ? 'none' : '0 0 20px rgba(46,125,50,0.4)',
          }}>
          {announced ? '✅ Meeting Announced in Chat' : '📢 Announce Meeting in Chat'}
        </button>

        {/* Log meeting notes */}
        <div className="flex flex-col gap-3">
          <div className="text-[10px] font-bold text-green-500/70 uppercase tracking-widest">Log Meeting Notes to DOME Brain</div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="What was discussed? Key decisions made..."
            rows={3}
            className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none outline-none focus:ring-1 focus:ring-green-500/50"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <input
            value={nextSteps}
            onChange={e => setNextSteps(e.target.value)}
            placeholder="Next steps / action items..."
            className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-green-500/50"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <button
            onClick={handleLogNotes}
            disabled={!notes.trim() || saving}
            className="w-full py-2.5 rounded-xl font-black text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              background: saved ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.25)',
              border: '1px solid rgba(99,102,241,0.4)',
              color: saved ? '#a5b4fc' : 'white',
            }}>
            {saving ? '⏳ Saving...' : saved ? '✅ Logged to DOME Brain!' : '🧠 Log Notes to DOME Brain'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Challenge Inbox ──────────────────────────────────────────────────────────

function ChallengesInbox({
  currentUserId,
  incoming,
  liveMembers,
  onAccept,
  onDecline,
  onChallenge,
}: {
  currentUserId: string;
  incoming: DBBattleChallenge[];
  liveMembers: import('./types').TeamMember[];
  onAccept: (c: DBBattleChallenge) => void;
  onDecline: (c: DBBattleChallenge) => void;
  onChallenge: (targetId: string) => void;
}) {
  const [outgoing, setOutgoing] = useState<DBBattleChallenge[]>([]);
  useEffect(() => {
    fetchOutgoingChallenges(currentUserId).then(setOutgoing);
  }, [currentUserId, incoming]); // refresh when incoming changes

  const getMember = (id: string) =>
    liveMembers.find(m => m.id === id) || TEAM_MEMBERS.find(m => m.id === id);

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  }

  const ChallengeCard = ({ c, type }: { c: DBBattleChallenge; type: 'incoming' | 'outgoing' }) => {
    const other = type === 'incoming' ? getMember(c.challenger_id) : getMember(c.defender_id);
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${type === 'incoming' ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)'}` }}>
        <div className="text-2xl">{type === 'incoming' ? '⚔️' : '📤'}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white">
            {type === 'incoming' ? `${other?.name ?? 'Someone'} challenged you!` : `Challenged ${other?.name ?? 'someone'}`}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">Sent {timeAgo(c.created_at)}</div>
        </div>
        {type === 'incoming' && (
          <div className="flex gap-2 shrink-0">
            <button onClick={() => onDecline(c)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#9ca3af' }}>
              Decline
            </button>
            <button onClick={() => onAccept(c)}
              className="px-3 py-1.5 rounded-lg text-xs font-black transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: 'white', border: 'none', boxShadow: '0 0 12px rgba(239,68,68,0.4)' }}>
              ⚔️ Fight!
            </button>
          </div>
        )}
        {type === 'outgoing' && (
          <div className="shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold text-yellow-400/70"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
            Awaiting response...
          </div>
        )}
      </div>
    );
  };

  // Online teammates (excluding self)
  const onlineTeammates = liveMembers.filter(
    m => m.id !== currentUserId && m.status !== 'offline'
  );

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-1">
      <div>
        <h2 className="text-lg font-bold text-white">⚔️ Battles</h2>
        <p className="text-xs text-gray-400 mt-0.5">Challenge a teammate to a trivia duel. Winner takes coins.</p>
      </div>

      {/* ── Quick Challenge — online now ── */}
      <div className="rounded-xl p-4 flex flex-col gap-3"
        style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <div className="text-[10px] font-bold uppercase tracking-widest text-red-400/80">⚡ Challenge Someone Now</div>
        {onlineTeammates.length === 0 ? (
          <div className="text-xs text-gray-500">No teammates online right now.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {onlineTeammates.map(m => {
              const alreadyChallenged = outgoing.some(c => c.defender_id === m.id);
              return (
                <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
                    style={{ background: m.avatarColor }}>{m.name[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white">{m.name}</div>
                    <div className="text-[10px] text-gray-500">Lv{m.level} · {m.battleWins ?? 0}W {m.battleLosses ?? 0}L</div>
                  </div>
                  <button
                    disabled={alreadyChallenged}
                    onClick={() => onChallenge(m.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-black transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: alreadyChallenged ? 'rgba(245,158,11,0.15)' : 'linear-gradient(135deg, #ef4444, #b91c1c)',
                      color: alreadyChallenged ? '#f59e0b' : 'white',
                      border: 'none',
                      boxShadow: alreadyChallenged ? 'none' : '0 0 10px rgba(239,68,68,0.4)',
                    }}>
                    {alreadyChallenged ? '⏳ Pending' : '⚔️ Challenge'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Incoming challenges ── */}
      {incoming.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-red-400/70">
            Incoming ({incoming.length})
          </div>
          {incoming.map(c => <ChallengeCard key={c.id} c={c} type="incoming" />)}
        </div>
      )}

      {/* ── Outgoing challenges ── */}
      {outgoing.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-400/70">
            Sent ({outgoing.length})
          </div>
          {outgoing.map(c => <ChallengeCard key={c.id} c={c} type="outgoing" />)}
        </div>
      )}

      {incoming.length === 0 && outgoing.length === 0 && onlineTeammates.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="text-5xl opacity-20">⚔️</div>
          <div className="text-gray-500 text-sm">Nobody online right now.</div>
          <div className="text-gray-600 text-xs">Come back when the team is active to start a battle.</div>
        </div>
      )}
    </div>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

function AppShell({ controlledMemberId, onLogout }: { controlledMemberId: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('world');
  const [activeZone, setActiveZone] = useState<Zone | null>(null);
  const [toast, setToast] = useState<{ text: string; emoji: string; color?: string } | null>(null);
  const [pulseTab, setPulseTab] = useState<Tab | null>(null);
  const [battleTargetId, setBattleTargetId] = useState<string | null>(null);

  // Challenge system state
  const [pendingChallenges, setPendingChallenges] = useState<DBBattleChallenge[]>([]);
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const [challengeSentTarget, setChallengeSentTarget] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof subscribeToBattleChallenges> | null>(null);
  const prevXpRef = useRef<Record<string, number>>({});
  const xpBubbleIdRef = useRef(0);
  const [xpBubbles, setXpBubbles] = useState<Array<{ id: number; delta: number; memberId: string }>>([]);

  // Badge celebration modal
  const [badgeCelebration, setBadgeCelebration] = useState<Badge | null>(null);

  // First-time welcome tour (fires once per user per browser)
  const [showWelcomeTour, setShowWelcomeTour] = useState<boolean>(() => shouldShowWelcomeTour());

  // XP milestone fireworks
  const [xpFireworks, setXpFireworks] = useState<{ milestone: number } | null>(null);
  const milestonesHitRef = useRef<Set<string>>(new Set());

  // Live Supabase sync
  const { liveMembers, chatMessages, ready, sendChat, syncCoins } = useSupabaseSync(controlledMemberId);

  const me = liveMembers.find(m => m.id === controlledMemberId)
    || TEAM_MEMBERS.find(m => m.id === controlledMemberId)
    || TEAM_MEMBERS[0];
  const myTier = getLevelTier(me.level);

  // Local coin state (optimistic, synced to DB after battle)
  const [playerCoins, setPlayerCoins] = useState<number>(me.coins);

  // ─── Load & subscribe to incoming challenges ─────────────────────────────────
  useEffect(() => {
    // Load existing pending challenges on mount
    fetchPendingChallenges(controlledMemberId).then(challenges => {
      if (challenges.length > 0) setPendingChallenges(challenges);
    });

    // Subscribe to new challenges in realtime
    channelRef.current = subscribeToBattleChallenges(controlledMemberId, (challenge) => {
      setPendingChallenges(prev => {
        // Avoid duplicates
        if (prev.find(c => c.id === challenge.id)) return prev;
        return [challenge, ...prev];
      });
    });

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [controlledMemberId]);

  // ─── Subscribe to new badge awards — show celebration modal ─────────────────
  useEffect(() => {
    const sub = subscribeToNewBadges(controlledMemberId, (dbBadge) => {
      const badge = BADGE_MAP[dbBadge.badge_id];
      if (badge) {
        setBadgeCelebration(badge);
        // Auto-dismiss after 8 seconds
        setTimeout(() => setBadgeCelebration(b => b?.id === badge.id ? null : b), 8000);
      }
    });
    return () => { sub.unsubscribe(); };
  }, [controlledMemberId]);

  // ─── Global audio context unlock on first user interaction ──────────────────
  useEffect(() => {
    const unlock = () => {
      try {
        const w = window as typeof window & { __domeAudioCtx?: AudioContext };
        if (!w.__domeAudioCtx) {
          w.__domeAudioCtx = new AudioContext();
        }
        if (w.__domeAudioCtx.state === 'suspended') {
          w.__domeAudioCtx.resume();
        }
      } catch { /* no AudioContext support */ }
    };
    window.addEventListener('click', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // ─── Daily standup prompt — posts at 9am if not yet sent today ───────────────
  useEffect(() => {
    if (!ready) return;
    const now = new Date();
    if (now.getHours() < 9) return;
    const todayStr = now.toISOString().slice(0, 10);
    getConfig('last_standup_date').then(lastDate => {
      if (lastDate !== todayStr) {
        sendChatMessage('dome-mc', '🌅 Good morning DOME! What are you working on today?').then(() => {
          setConfig('last_standup_date', todayStr);
        });
      }
    });
  }, [ready]);

  // ─── Login streak — update on first load ──────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    updateLoginStreak(controlledMemberId);
  }, [ready, controlledMemberId]);

  // ─── XP gain detection — fires floating bubbles whenever any member gains XP ─
  const XP_MILESTONES = [500, 1000, 2500, 5000, 10000];
  useEffect(() => {
    liveMembers.forEach(m => {
      const prev = prevXpRef.current[m.id];
      if (prev !== undefined && m.xp > prev) {
        const delta = m.xp - prev;
        const id = ++xpBubbleIdRef.current;
        setXpBubbles(curr => [...curr, { id, delta, memberId: m.id }]);
        setTimeout(() => setXpBubbles(curr => curr.filter(b => b.id !== id)), 2500);

        // ── Milestone fireworks for the current user ──────────────────────────
        if (m.id === controlledMemberId) {
          XP_MILESTONES.forEach(ms => {
            const key = `${m.id}-${ms}`;
            if (prev < ms && m.xp >= ms && !milestonesHitRef.current.has(key)) {
              milestonesHitRef.current.add(key);
              setXpFireworks({ milestone: ms });
              setTimeout(() => setXpFireworks(null), 5000);
            }
          });
        }
      }
      prevXpRef.current[m.id] = m.xp;
    });
  }, [liveMembers, controlledMemberId]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const showToast = useCallback((text: string, emoji: string, color?: string) => {
    setToast({ text, emoji, color });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleZoneEnter = (zone: Zone) => setActiveZone(zone);

  // ─── Zone action (E key / button) ────────────────────────────────────────────
  const [domeMeetingOpen, setDomeMeetingOpen] = useState(false);

  const RANDOM_HOT_TAKES = [
    "Cold email still converts better than most paid ads",
    "Your CAC is lying to you — attribution is broken",
    "The best retention strategy is a great onboarding flow",
    "Most companies spend 80% on acquisition, 20% on retention — backwards",
    "Speed of follow-up matters more than the offer",
  ];

  // Track last zone visit to prevent XP farming (30s cooldown per zone)
  const lastZoneVisitRef = useRef<Record<string, number>>({});

  const handleZoneAction = (zone: Zone) => {
    const now = Date.now();
    const lastVisit = lastZoneVisitRef.current[zone.id] || 0;
    const COOLDOWN_MS = 30_000; // 30s per zone
    const canEarnXp = now - lastVisit > COOLDOWN_MS;

    switch (zone.id) {
      case 'green_couch':
        setDomeMeetingOpen(true);
        break;
      case 'grind_zone':
        setTab('dashboard');
        if (canEarnXp) {
          lastZoneVisitRef.current[zone.id] = now;
          addXp(controlledMemberId, 10, '📊 Entered the Grind Zone');
          showToast('+10 XP — grinding 💪', '📊', '#43a047');
        } else {
          showToast('Grind Zone ↗ Dashboard', '📊', '#43a047');
        }
        break;
      case 'idea_lab':
        setTab('ideas');
        if (canEarnXp) {
          lastZoneVisitRef.current[zone.id] = now;
          addXp(controlledMemberId, 10, '💡 Visited the Idea Lab');
          showToast('+10 XP — ideas are worth XP 💡', '💡', '#8e24aa');
        } else {
          showToast('Idea Lab ↗ Ideas Board', '💡', '#8e24aa');
        }
        break;
      case 'war_room':
        setTab('projects');
        if (canEarnXp) {
          lastZoneVisitRef.current[zone.id] = now;
          addXp(controlledMemberId, 10, '⚔️ Entered the War Room');
          showToast('+10 XP — strategy pays ⚔️', '⚔️', '#e64a19');
        } else {
          showToast('War Room ↗ Projects', '⚔️', '#e64a19');
        }
        break;
      case 'coffee_corner': {
        if (canEarnXp) {
          lastZoneVisitRef.current[zone.id] = now;
          addXp(controlledMemberId, 5, '☕ Coffee corner energy boost')
            .then(() => {
              showToast('+5 XP — caffeinated ☕', '⚡', '#8d6e63');
              handleSendChat(`☕ grabbed a coffee and feels energized! (+5 XP)`);
            })
            .catch(() => {
              showToast('Coffee machine broke — XP not awarded ☕', '❌', '#ef4444');
              // Roll back cooldown so user can try again
              delete lastZoneVisitRef.current[zone.id];
            });
        } else {
          const secsLeft = Math.ceil((COOLDOWN_MS - (now - lastVisit)) / 1000);
          showToast(`☕ Coffee refreshes in ${secsLeft}s — hang tight`, '☕', '#8d6e63');
        }
        break;
      }
      case 'watercooler': {
        const take = RANDOM_HOT_TAKES[Math.floor(Math.random() * RANDOM_HOT_TAKES.length)];
        handleSendChat(`💧 Hot Take: "${take}"`);
        if (canEarnXp) {
          lastZoneVisitRef.current[zone.id] = now;
          addXp(controlledMemberId, 5, '💧 Dropped a hot take at the watercooler');
          showToast('+5 XP — hot take dropped 💧', '🗣️', '#0288d1');
        } else {
          showToast('Hot take fired 💧', '🗣️', '#0288d1');
        }
        break;
      }
      case 'trophy_wall':
        setTab('leaderboard');
        if (canEarnXp) {
          lastZoneVisitRef.current[zone.id] = now;
          addXp(controlledMemberId, 5, '🏆 Checked the Trophy Wall');
          showToast('+5 XP — champions study the wall 🏆', '🏆', '#f9a825');
        } else {
          showToast('Trophy Wall ↗ Leaderboard', '🏆', '#f9a825');
        }
        break;
    }
  };

  const handleSendChat = async (text: string) => {
    // ── /log <message> quick-log shortcut ──────────────────────────────────────
    if (text.trimStart().startsWith('/log ')) {
      const logText = text.trimStart().slice(5).trim();
      if (logText.length > 0) {
        await logMeetingSession(me.name, logText, null, ['quick-log']);
        await sendChat(`📝 Logged to DOME Brain: "${logText}"`);
        showToast('Work summary saved to DOME Brain!', '📝', '#6366f1');
      }
      return;
    }
    await sendChat(text);
    if (tab !== 'world') {
      setPulseTab('world');
      setTimeout(() => setPulseTab(null), 2500);
    }
  };

  // ─── Challenge flow ───────────────────────────────────────────────────────────

  const handleChallenge = async (targetId: string) => {
    const target = liveMembers.find(m => m.id === targetId);
    const result = await sendBattleChallenge(controlledMemberId, targetId);
    if (result) {
      setChallengeSentTarget(target?.name || targetId);
      await sendChat(`challenged ${target?.name || targetId} to battle ⚔️`);
    } else {
      showToast('Failed to send challenge', '❌', '#ef4444');
    }
  };

  const handleAcceptChallenge = async (challenge: DBBattleChallenge) => {
    await respondToChallenge(challenge.id, true);
    setActiveChallengeId(challenge.id);
    setBattleTargetId(challenge.challenger_id);
    setPendingChallenges(prev => prev.filter(c => c.id !== challenge.id));
    await sendChat(`accepted ${liveMembers.find(m => m.id === challenge.challenger_id)?.name}'s battle challenge ⚔️`);
  };

  const handleDeclineChallenge = async (challenge: DBBattleChallenge) => {
    await respondToChallenge(challenge.id, false);
    setPendingChallenges(prev => prev.filter(c => c.id !== challenge.id));
    const challenger = liveMembers.find(m => m.id === challenge.challenger_id);
    showToast(`Declined ${challenger?.name}'s challenge 🐔`, '😤', '#6b7280');
  };

  const handleBattleComplete = async (won: boolean, coinsWon: number) => {
    const enemy = liveMembers.find(m => m.id === battleTargetId);
    setBattleTargetId(null);

    // Mark challenge completed in DB if this was a challenge battle
    if (activeChallengeId) {
      await completeBattleChallenge(
        activeChallengeId,
        won ? controlledMemberId : (battleTargetId || ''),
        coinsWon
      );
      setActiveChallengeId(null);
    }

    if (won) {
      const newCoins = playerCoins + coinsWon;
      setPlayerCoins(newCoins);
      await syncCoins(newCoins, me.battleWins + 1, me.battleLosses);
      showToast(`You beat ${enemy?.name}! +${coinsWon} coins stolen 💰`, '🏆', '#69f0ae');
      await sendChat(`just DESTROYED ${enemy?.name} in battle and stole ${coinsWon} coins 😤⚔️`);
    } else {
      const lostCoins = Math.floor(playerCoins * 0.2);
      const newCoins = Math.max(0, playerCoins - lostCoins);
      setPlayerCoins(newCoins);
      await syncCoins(newCoins, me.battleWins, me.battleLosses + 1);
      showToast(`${enemy?.name} destroyed you. Lost ${lostCoins} coins 💀`, '😵', '#ff5252');
      await sendChat(`just lost to ${enemy?.name} 😭 rip ${lostCoins} coins`);
    }
  };

  const isScott = controlledMemberId === 'scott';

  const TABS: { id: Tab; label: string; emoji: string; adminOnly?: boolean }[] = [
    { id: 'world', label: 'World', emoji: '🗺️' },
    { id: 'dashboard', label: 'Activity', emoji: '📋' },
    { id: 'calendar', label: 'Calendar', emoji: '📅' },
    { id: 'projects', label: 'Projects', emoji: '🏗️' },
    { id: 'ideas', label: 'Ideas', emoji: '💡' },
    { id: 'badges', label: 'Badges', emoji: '🎖️' },
    { id: 'leaderboard', label: 'Leaderboard', emoji: '🏆' },
    { id: 'battles', label: 'Battles', emoji: '⚔️' },
    { id: 'requests', label: 'Requests', emoji: '📬' },
    { id: 'wisdom', label: 'Oracle', emoji: '✦' },
    ...(isScott ? [{ id: 'admin' as Tab, label: 'Upgrades', emoji: '⚡', adminOnly: true }] : []),
  ];

  const battleEnemy = battleTargetId ? liveMembers.find(m => m.id === battleTargetId) : null;

  // First pending challenge to show (most recent)
  const topChallenge = pendingChallenges[0] ?? null;
  const topChallenger = topChallenge
    ? (liveMembers.find(m => m.id === topChallenge.challenger_id) || TEAM_MEMBERS.find(m => m.id === topChallenge.challenger_id))
    : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #080814 0%, #0d1117 50%, #080814 100%)', color: '#e2e8f0' }}>
      {/* Header */}
      <header className="flex flex-col shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}>
        {/* Top row: logo + user */}
        <div className="flex items-center gap-3 px-3 py-2">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', boxShadow: '0 0 14px rgba(99,102,241,0.6)' }}>D</div>
            <div className="hidden sm:block">
              <div className="font-black text-sm tracking-tight text-white leading-none">DOME</div>
              <div className="text-[8px] text-indigo-400 tracking-widest uppercase leading-none font-medium">Mission Control</div>
            </div>
          </div>

          {/* DB status */}
          <div className="flex items-center gap-1 text-[10px]" style={{ color: ready ? '#22c55e' : '#f59e0b' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: ready ? '#22c55e' : '#f59e0b', boxShadow: `0 0 6px ${ready ? '#22c55e' : '#f59e0b'}` }} />
            <span className="hidden sm:inline">{ready ? 'LIVE' : 'CONNECTING...'}</span>
          </div>

          {activeZone && tab === 'world' && (
            <div className="text-[10px] px-2 py-1 rounded-lg flex items-center gap-1"
              style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
              <span>{activeZone.emoji}</span>
              <span className="font-medium hidden sm:inline">{activeZone.name}</span>
            </div>
          )}

          {/* Pending challenge badge in header */}
          {pendingChallenges.length > 0 && !battleEnemy && (
            <button
              onClick={() => {
                if (topChallenge && topChallenger) {
                  // Re-show notification by forcing state trigger — it's already shown via overlay
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold animate-pulse"
              style={{
                background: 'rgba(239,68,68,0.2)',
                border: '1px solid rgba(239,68,68,0.5)',
                color: '#fca5a5',
              }}>
              <span>⚔️</span>
              <span>{pendingChallenges.length} challenge{pendingChallenges.length > 1 ? 's' : ''}!</span>
            </button>
          )}

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            {/* Coin display */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
              style={{ background: 'rgba(255,214,0,0.1)', border: '1px solid rgba(255,214,0,0.25)' }}>
              <span className="text-sm">💰</span>
              <span className="font-black text-yellow-400 text-xs">{playerCoins}</span>
            </div>

            <div className="flex items-center gap-2 px-2 py-1 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                style={{ background: me.avatarColor, boxShadow: `0 0 8px ${me.avatarColor}66` }}>{me.name[0]}</div>
              <div className="hidden sm:block">
                <div className="text-xs font-semibold text-white leading-none">{me.name}</div>
                <div className="text-[9px] leading-none mt-0.5" style={{ color: myTier.color }}>Lv{me.level} · {me.xp.toLocaleString()} XP</div>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ boxShadow: '0 0 4px #22c55e' }} />
            </div>

            <button onClick={onLogout}
              className="text-xs px-2 py-1.5 rounded-lg transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}
              title="Switch user">↩</button>
          </div>
        </div>

        {/* Nav row — scrollable on mobile */}
        <nav className="flex gap-1 px-3 pb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="relative shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
              style={tab === t.id
                ? { background: t.adminOnly ? 'rgba(245,158,11,0.25)' : 'rgba(99,102,241,0.25)', border: `1px solid ${t.adminOnly ? 'rgba(245,158,11,0.55)' : 'rgba(99,102,241,0.45)'}`, color: t.adminOnly ? '#fde68a' : '#e0e7ff' }
                : { background: t.adminOnly ? 'rgba(245,158,11,0.06)' : 'transparent', border: `1px solid ${t.adminOnly ? 'rgba(245,158,11,0.25)' : 'transparent'}`, color: t.adminOnly ? '#f59e0b' : '#6b7280' }}>
              <span>{t.emoji}</span>
              <span className="hidden sm:inline">{t.label}</span>
              {pulseTab === t.id && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 animate-ping" />}
            </button>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 p-2 sm:p-4 overflow-hidden" style={{ height: 'calc(100vh - 80px)' }}>
        {tab === 'world' && (
          <WorldMap
            controlledMemberId={controlledMemberId}
            onZoneEnter={handleZoneEnter}
            onZoneAction={handleZoneAction}
            onChallenge={handleChallenge}
            chatMessages={chatMessages}
            onSendChat={handleSendChat}
            playerCoins={playerCoins}
            liveMembers={liveMembers}
            onSpendCoins={(amount) => setPlayerCoins(c => Math.max(0, c - amount))}
          />
        )}
        {tab === 'dashboard' && <Dashboard liveMembers={liveMembers} />}
        {tab === 'calendar' && <CalendarView />}
        {tab === 'projects' && <ProjectsView />}
        {tab === 'ideas' && <IdeasBoard currentUserId={controlledMemberId} />}
        {tab === 'badges' && <BadgesView />}
        {tab === 'leaderboard' && <Leaderboard liveMembers={liveMembers} />}
        {tab === 'battles' && (
          <ChallengesInbox
            currentUserId={controlledMemberId}
            incoming={pendingChallenges}
            liveMembers={liveMembers}
            onAccept={handleAcceptChallenge}
            onDecline={handleDeclineChallenge}
            onChallenge={handleChallenge}
          />
        )}
        {tab === 'requests' && <UpdateRequests currentUserId={controlledMemberId} />}
        {tab === 'wisdom' && <WisdomOracle currentUserId={controlledMemberId} />}
        {tab === 'admin' && isScott && <AdminPanel currentUserId={controlledMemberId} />}
      </main>

      {/* ── Incoming challenge overlay (shown when not in battle) ── */}
      {topChallenge && topChallenger && !battleEnemy && (
        <ChallengeNotification
          challenge={topChallenge}
          challengerName={topChallenger.name}
          onAccept={() => handleAcceptChallenge(topChallenge)}
          onDecline={() => handleDeclineChallenge(topChallenge)}
        />
      )}

      {/* ── Challenge sent confirmation banner ── */}
      {challengeSentTarget && (
        <ChallengeSentBanner
          targetName={challengeSentTarget}
          onDismiss={() => setChallengeSentTarget(null)}
        />
      )}

      {/* Battle modal */}
      {battleEnemy && (
        <BattleModal
          player={{ ...me, coins: playerCoins }}
          enemy={battleEnemy}
          onComplete={handleBattleComplete}
          onClose={() => {
            setBattleTargetId(null);
            setActiveChallengeId(null);
          }}
        />
      )}

      {/* ── DOME Meeting Modal (Green Couch) ── */}
      {domeMeetingOpen && (
        <DomeMeetingModal
          me={me}
          liveMembers={liveMembers}
          onSendChat={handleSendChat}
          onClose={() => setDomeMeetingOpen(false)}
        />
      )}

      {/* ── First-time Welcome Tour (one-time agent onboarding) ── */}
      {showWelcomeTour && !battleEnemy && !topChallenge && (
        <WelcomeTour
          memberName={me.name.split(' ')[0]}
          onDismiss={() => setShowWelcomeTour(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl text-sm font-medium text-white flex items-center gap-2 z-50"
          style={{ background: 'rgba(0,0,0,0.9)', border: `1px solid ${toast.color || 'rgba(99,102,241,0.5)'}`, boxShadow: `0 0 20px ${toast.color || 'rgba(99,102,241,0.3)'}` }}>
          <span className="text-lg">{toast.emoji}</span>
          <span>{toast.text}</span>
        </div>
      )}

      {/* XP Gain Bubbles — float up whenever any team member earns XP */}
      {xpBubbles.map((bubble, idx) => {
        const member = liveMembers.find(m => m.id === bubble.memberId) ?? TEAM_MEMBERS.find(m => m.id === bubble.memberId);
        const isMe = bubble.memberId === controlledMemberId;
        return (
          <div key={bubble.id} style={{
            position: 'fixed',
            top: `${60 + idx * 34}px`,
            right: '12px',
            zIndex: 90,
            animation: 'xpFloat 2.5s ease-out forwards',
            background: isMe ? 'rgba(99,102,241,0.92)' : 'rgba(13,17,23,0.92)',
            border: `1px solid ${isMe ? 'rgba(165,180,252,0.6)' : 'rgba(255,255,255,0.12)'}`,
            color: 'white',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            pointerEvents: 'none',
            boxShadow: isMe ? '0 0 12px rgba(99,102,241,0.5)' : '0 2px 8px rgba(0,0,0,0.4)',
            whiteSpace: 'nowrap',
          }}>
            ⚡ {isMe ? 'YOU' : (member ? member.name.split(' ')[0] : bubble.memberId)} +{bubble.delta} XP
          </div>
        );
      })}

      {/* ─── Badge Earned Celebration Modal ────────────────────────────────── */}
      {badgeCelebration && (() => {
        const CONFETTI_COLORS = ['#ffd700','#ff6b6b','#4ecdc4','#45b7d1','#a8e063','#ff9ff3','#feca57','#6c5ce7','#fd79a8','#00b894'];
        const confettiPieces = Array.from({ length: 30 }).map((_, i) => ({
          left: `${(i / 30) * 100 + (i % 2 === 0 ? 1.5 : -1.5)}%`,
          size: 6 + (i % 5) * 2,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          duration: 1.8 + (i % 7) * 0.3,
          delay: (i % 8) * 0.08,
          isRound: i % 3 === 0,
        }));
        return (
          <div
            onClick={() => setBadgeCelebration(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9998,
              background: 'rgba(0,0,5,0.88)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              animation: 'badgeCelebFadeIn 0.3s ease',
            }}
          >
            {/* Confetti */}
            {confettiPieces.map((p, i) => (
              <div key={i} style={{
                position: 'absolute',
                width: `${p.size}px`,
                height: `${p.size}px`,
                background: p.color,
                left: p.left,
                top: '-12px',
                borderRadius: p.isRound ? '50%' : '2px',
                animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
                pointerEvents: 'none',
              }} />
            ))}

            {/* Badge Card */}
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: 'linear-gradient(145deg, rgba(15,8,50,0.99) 0%, rgba(35,18,90,0.99) 100%)',
                border: '2px solid rgba(255,215,0,0.55)',
                borderRadius: '24px',
                padding: '48px 52px',
                textAlign: 'center',
                maxWidth: '380px',
                width: '90%',
                boxShadow: '0 0 80px rgba(255,215,0,0.25), 0 24px 64px rgba(0,0,0,0.9)',
                animation: 'badgePop 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) both',
                position: 'relative',
              }}
            >
              <div style={{ fontSize: '80px', lineHeight: 1, marginBottom: '16px', filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.5))' }}>
                {badgeCelebration.emoji}
              </div>

              <div style={{ color: '#ffd700', fontSize: '11px', fontWeight: 800, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '10px', opacity: 0.9 }}>
                🏅 Badge Earned!
              </div>

              <div style={{ color: '#fff', fontSize: '26px', fontWeight: 800, marginBottom: '12px', lineHeight: 1.2 }}>
                {badgeCelebration.name}
              </div>

              <div style={{ color: 'rgba(200,190,255,0.8)', fontSize: '14px', lineHeight: 1.6, marginBottom: '10px' }}>
                {badgeCelebration.descriptor}
              </div>

              <div style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '28px',
                background: badgeCelebration.rarity === 'legendary' ? 'rgba(255,165,0,0.2)' : badgeCelebration.rarity === 'epic' ? 'rgba(147,51,234,0.25)' : badgeCelebration.rarity === 'rare' ? 'rgba(59,130,246,0.25)' : 'rgba(107,114,128,0.25)',
                color: badgeCelebration.rarity === 'legendary' ? '#fbbf24' : badgeCelebration.rarity === 'epic' ? '#c084fc' : badgeCelebration.rarity === 'rare' ? '#60a5fa' : '#9ca3af',
                border: `1px solid ${badgeCelebration.rarity === 'legendary' ? 'rgba(251,191,36,0.4)' : badgeCelebration.rarity === 'epic' ? 'rgba(192,132,252,0.4)' : badgeCelebration.rarity === 'rare' ? 'rgba(96,165,250,0.4)' : 'rgba(156,163,175,0.3)'}`,
              }}>
                {badgeCelebration.rarity}
              </div>

              <br />
              <button
                onClick={() => setBadgeCelebration(null)}
                style={{
                  background: 'linear-gradient(90deg, #ffd700 0%, #f59e0b 100%)',
                  color: '#0a0518',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '13px 36px',
                  fontSize: '15px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  letterSpacing: '0.5px',
                  boxShadow: '0 4px 20px rgba(255,215,0,0.4)',
                }}
              >
                Claim It! 🎉
              </button>
            </div>
          </div>
        );
      })()}

      {/* ─── XP Milestone Fireworks Toast ──────────────────────────────────── */}
      {xpFireworks && (() => {
        const FIREWORK_COLORS = ['#ffd700','#ff6b6b','#4ecdc4','#a8e063','#ff9ff3','#feca57','#6c5ce7','#00b894','#fd79a8','#74b9ff'];
        const particles = Array.from({ length: 40 }).map((_, i) => ({
          left: `${20 + Math.sin(i * 0.8) * 30 + (i % 4) * 10}%`,
          top: `${10 + (i % 6) * 12}%`,
          size: 5 + (i % 4) * 3,
          color: FIREWORK_COLORS[i % FIREWORK_COLORS.length],
          duration: 1.5 + (i % 6) * 0.25,
          delay: (i % 10) * 0.07,
        }));
        return (
          <div
            onClick={() => setXpFireworks(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9990,
              background: 'rgba(0,0,0,0.82)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(6px)',
              cursor: 'pointer',
            }}
          >
            {/* Firework particles */}
            {particles.map((p, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: p.left, top: p.top,
                width: `${p.size}px`, height: `${p.size}px`,
                background: p.color,
                borderRadius: i % 5 === 0 ? '2px' : '50%',
                animation: `badgeConfetti ${p.duration}s ease-out ${p.delay}s infinite`,
              }} />
            ))}

            {/* Central celebration card */}
            <div style={{
              position: 'relative',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
              padding: '40px 48px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, #0d1117 0%, #1a0a2e 100%)',
              border: '2px solid rgba(253,203,11,0.7)',
              boxShadow: '0 0 80px rgba(253,203,11,0.35), 0 0 160px rgba(253,203,11,0.1)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '52px', animation: 'badgeBounce 0.6s ease infinite alternate' }}>🎆</div>
              <div style={{ color: '#fde68a', fontWeight: 900, fontSize: '22px', letterSpacing: '0.5px' }}>
                MILESTONE REACHED!
              </div>
              <div style={{
                color: '#ffd700', fontWeight: 800, fontSize: '36px',
                textShadow: '0 0 24px rgba(255,215,0,0.6)',
              }}>
                {xpFireworks.milestone.toLocaleString()} XP
              </div>
              <div style={{ color: '#9ca3af', fontSize: '13px', maxWidth: '220px', lineHeight: 1.5 }}>
                You've crossed a legendary XP threshold. The DOME bows before you. 🏆
              </div>
              <button
                onClick={() => setXpFireworks(null)}
                style={{
                  marginTop: '8px',
                  background: 'linear-gradient(135deg, #ffd700 0%, #f59e0b 100%)',
                  color: '#0a0518', border: 'none', borderRadius: '12px',
                  padding: '12px 32px', fontSize: '14px', fontWeight: 800,
                  cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,215,0,0.4)',
                  letterSpacing: '0.5px',
                }}
              >
                Let's Go! 🔥
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
