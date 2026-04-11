import { useState, useEffect, useRef, useCallback } from 'react';

import WorldMap from './components/WorldMap';
import Dashboard from './components/Dashboard';
import IdeasBoard from './components/IdeasBoard';
import BadgesView from './components/BadgesView';
import Leaderboard from './components/Leaderboard';
import BattleModal from './components/BattleModal';
import ProjectsView from './components/ProjectsView';
import UpdateRequests from './components/UpdateRequests';
import AdminPanel from './components/AdminPanel';
import LoginScreen from './components/LoginScreen';
import { useSupabaseSync } from './hooks/useSupabaseSync';
import { TEAM_MEMBERS, getLevelTier } from './data/gameData';
import {
  sendBattleChallenge,
  fetchPendingChallenges,
  subscribeToBattleChallenges,
  respondToChallenge,
  completeBattleChallenge,
  type DBBattleChallenge,
} from './lib/supabase';
import type { Zone } from './types';
import './index.css';

type Tab = 'world' | 'dashboard' | 'projects' | 'ideas' | 'badges' | 'leaderboard' | 'requests' | 'admin';

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
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(challenge.expires_at).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('EXPIRED'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [challenge.expires_at]);

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
        <div className="absolute inset-0 rounded-2xl animate-ping"
          style={{ border: '2px solid rgba(239,68,68,0.3)', animationDuration: '1.5s' }} />

        <div className="text-5xl animate-bounce">⚔️</div>
        <div className="text-center">
          <div className="text-white font-black text-xl mb-1">YOU'VE BEEN CHALLENGED</div>
          <div className="text-red-400 font-bold text-lg">{challengerName} wants to fight!</div>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <span className="text-red-400 text-sm">⏱</span>
          <span className="text-red-300 font-mono font-bold text-sm">
            {timeLeft === 'EXPIRED' ? '⚠️ EXPIRED' : `Expires in ${timeLeft}`}
          </span>
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
        <div className="text-gray-400 text-xs">{targetName} has 24 hours to accept.</div>
      </div>
      <button onClick={onDismiss} className="ml-2 text-gray-500 hover:text-gray-300 text-lg leading-none">×</button>
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

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const showToast = useCallback((text: string, emoji: string, color?: string) => {
    setToast({ text, emoji, color });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleZoneEnter = (zone: Zone) => setActiveZone(zone);

  const handleSendChat = async (text: string) => {
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
      await sendChat(`challenged ${target?.name || targetId} to battle ⚔️ — they have 24 hours to accept!`);
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
    { id: 'projects', label: 'Projects', emoji: '🏗️' },
    { id: 'ideas', label: 'Ideas', emoji: '💡' },
    { id: 'badges', label: 'Badges', emoji: '🎖️' },
    { id: 'leaderboard', label: 'Leaderboard', emoji: '🏆' },
    { id: 'requests', label: 'Requests', emoji: '📬' },
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
            onChallenge={handleChallenge}
            chatMessages={chatMessages}
            onSendChat={handleSendChat}
            playerCoins={playerCoins}
            liveMembers={liveMembers}
          />
        )}
        {tab === 'dashboard' && <Dashboard liveMembers={liveMembers} />}
        {tab === 'projects' && <ProjectsView />}
        {tab === 'ideas' && <IdeasBoard currentUserId={controlledMemberId} />}
        {tab === 'badges' && <BadgesView />}
        {tab === 'leaderboard' && <Leaderboard liveMembers={liveMembers} />}
        {tab === 'requests' && <UpdateRequests currentUserId={controlledMemberId} />}
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl text-sm font-medium text-white flex items-center gap-2 z-50"
          style={{ background: 'rgba(0,0,0,0.9)', border: `1px solid ${toast.color || 'rgba(99,102,241,0.5)'}`, boxShadow: `0 0 20px ${toast.color || 'rgba(99,102,241,0.3)'}` }}>
          <span className="text-lg">{toast.emoji}</span>
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
