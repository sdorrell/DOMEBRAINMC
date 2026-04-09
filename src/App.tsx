import { useState } from 'react';

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

// ─── AppShell ─────────────────────────────────────────────────────────────────

function AppShell({ controlledMemberId, onLogout }: { controlledMemberId: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('world');
  const [activeZone, setActiveZone] = useState<Zone | null>(null);
  const [toast, setToast] = useState<{ text: string; emoji: string; color?: string } | null>(null);
  const [pulseTab, setPulseTab] = useState<Tab | null>(null);
  const [battleTargetId, setBattleTargetId] = useState<string | null>(null);

  // Live Supabase sync
  const { liveMembers, chatMessages, ready, sendChat, syncCoins } = useSupabaseSync(controlledMemberId);

  const me = liveMembers.find(m => m.id === controlledMemberId)
    || TEAM_MEMBERS.find(m => m.id === controlledMemberId)
    || TEAM_MEMBERS[0];
  const myTier = getLevelTier(me.level);

  // Local coin state (optimistic, synced to DB after battle)
  const [playerCoins, setPlayerCoins] = useState<number>(me.coins);

  const showToast = (text: string, emoji: string, color?: string) => {
    setToast({ text, emoji, color });
    setTimeout(() => setToast(null), 3500);
  };

  const handleZoneEnter = (zone: Zone) => setActiveZone(zone);

  const handleSendChat = async (text: string) => {
    await sendChat(text);
    // pulse world tab if not on it
    if (tab !== 'world') {
      setPulseTab('world');
      setTimeout(() => setPulseTab(null), 2500);
    }
  };

  const handleChallenge = (targetId: string) => setBattleTargetId(targetId);

  const handleBattleComplete = async (won: boolean, coinsWon: number) => {
    setBattleTargetId(null);
    const enemy = liveMembers.find(m => m.id === battleTargetId);

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

      {/* Battle modal */}
      {battleEnemy && (
        <BattleModal
          player={{ ...me, coins: playerCoins }}
          enemy={battleEnemy}
          onComplete={handleBattleComplete}
          onClose={() => setBattleTargetId(null)}
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
