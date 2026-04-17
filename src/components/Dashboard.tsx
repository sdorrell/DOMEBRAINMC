import { useState, useEffect } from 'react';
import { TEAM_MEMBERS, BADGES, getLevelTier } from '../data/gameData';
import { fetchWorkSummaries, fetchWeeklyXpGains, type DBWorkSummary } from '../lib/supabase';
import type { TeamMember } from '../types';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function XPBar({ current, next, color }: { current: number; next: number; color: string }) {
  const pct = Math.min(100, (current / next) * 100);
  return (
    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}88` }} />
    </div>
  );
}

// Map dome_work_summaries team_member (text) → TEAM_MEMBERS id
function resolveMember(teamMember: string): TeamMember | undefined {
  const lower = teamMember.toLowerCase();
  return TEAM_MEMBERS.find(m =>
    lower.includes(m.id) || lower.startsWith(m.name.toLowerCase())
  );
}

// ─── Weekly Wins Recap Banner ────────────────────────────────────────────────
// Auto-implements the approved "Weekly Wins Recap Banner" suggestion — a
// dismissible Monday summary of last week's top XP earner, new work summaries,
// and total XP gained across the team. Shown only on Mondays, dismissible
// per-week via localStorage.

function useWeeklyRecap(members: TeamMember[], workLogs: DBWorkSummary[]) {
  const [topEarner, setTopEarner] = useState<{ member: TeamMember; gain: number } | null>(null);
  const [totalXp, setTotalXp] = useState(0);

  useEffect(() => {
    fetchWeeklyXpGains().then(gains => {
      if (!gains.length) return;
      const sumXp = gains.reduce((s, g) => s + g.gain, 0);
      setTotalXp(sumXp);
      const best = gains[0];
      const m = members.find(mm => mm.id === best.memberId);
      if (m && best.gain > 0) setTopEarner({ member: m, gain: best.gain });
    });
  }, [members]);

  const weekStart = (() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  })();

  const summariesThisWeek = workLogs.filter(l =>
    new Date(l.created_at).getTime() >= weekStart.getTime()
  ).length;

  return { topEarner, totalXp, summariesThisWeek, weekStart };
}

function WeeklyWinsBanner({ members, workLogs }: { members: TeamMember[]; workLogs: DBWorkSummary[] }) {
  const { topEarner, totalXp, summariesThisWeek, weekStart } = useWeeklyRecap(members, workLogs);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      const weekKey = weekStart.toISOString().slice(0, 10);
      return localStorage.getItem('dome_weekly_recap_dismissed') === weekKey;
    } catch { return false; }
  });

  // Only show on Mondays (day === 1)
  const isMonday = new Date().getDay() === 1;
  if (!isMonday || dismissed) return null;
  if (!topEarner && summariesThisWeek === 0 && totalXp === 0) return null;

  const handleDismiss = () => {
    try {
      const weekKey = weekStart.toISOString().slice(0, 10);
      localStorage.setItem('dome_weekly_recap_dismissed', weekKey);
    } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-4 shrink-0"
      style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
        border: '1px solid rgba(139,92,246,0.35)',
        boxShadow: '0 0 24px rgba(99,102,241,0.12)',
      }}
    >
      <div className="text-3xl shrink-0">🎉</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-300/80">
          Monday Recap — Last Week at DOME
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {topEarner && (
            <span className="flex items-center gap-1.5">
              <span className="text-yellow-400">👑</span>
              <span className="text-white font-bold">{topEarner.member.name}</span>
              <span className="text-gray-400">led with</span>
              <span className="text-yellow-400 font-black">+{topEarner.gain.toLocaleString()} XP</span>
            </span>
          )}
          {summariesThisWeek > 0 && (
            <span className="flex items-center gap-1.5">
              <span>🧠</span>
              <span className="text-white font-bold">{summariesThisWeek}</span>
              <span className="text-gray-400">work summaries</span>
            </span>
          )}
          {totalXp > 0 && (
            <span className="flex items-center gap-1.5">
              <span>⚡</span>
              <span className="text-white font-bold">{totalXp.toLocaleString()}</span>
              <span className="text-gray-400">team XP earned</span>
            </span>
          )}
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        title="Dismiss until next Monday"
      >✕</button>
    </div>
  );
}

export default function Dashboard({ liveMembers }: { liveMembers?: TeamMember[] }) {
  const members = liveMembers && liveMembers.length > 0 ? liveMembers : TEAM_MEMBERS;
  const [filter, setFilter] = useState<string>('all');
  const [workLogs, setWorkLogs] = useState<DBWorkSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkSummaries(40).then(data => {
      setWorkLogs(data);
      setLoading(false);
    });
  }, []);

  const filtered = workLogs.filter(log => {
    if (filter === 'all') return true;
    const m = resolveMember(log.team_member);
    return m?.id === filter;
  });

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">
      <WeeklyWinsBanner members={members} workLogs={workLogs} />
      <div className="flex-1 flex gap-4 overflow-hidden">
      {/* Left: team cards */}
      <div className="w-56 flex flex-col gap-3 shrink-0 overflow-y-auto pr-1">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Team</div>
        {members.map(m => {
          const tier = getLevelTier(m.level);
          const earnedBadges = BADGES.filter(b => m.badges.includes(b.id));
          const brainPushes = workLogs.filter(l => resolveMember(l.team_member)?.id === m.id).length;
          return (
            <button key={m.id} onClick={() => setFilter(filter === m.id ? 'all' : m.id)}
              className="rounded-2xl p-3 text-left transition-all"
              style={{
                background: filter === m.id ? `${m.avatarColor}18` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${filter === m.id ? m.avatarColor + '44' : 'rgba(255,255,255,0.07)'}`,
                boxShadow: filter === m.id ? `0 0 16px ${m.avatarColor}22` : 'none',
              }}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black shrink-0"
                  style={{ background: `radial-gradient(circle at 35% 35%, ${m.avatarAccent}, ${m.avatarColor})`, boxShadow: `0 0 10px ${m.avatarColor}66` }}>
                  {m.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-bold truncate">{m.name}</div>
                  <div className="text-[9px] truncate" style={{ color: tier.color }}>Lv{m.level}</div>
                </div>
                <div className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: m.status === 'online' ? '#22c55e' : '#6b7280', boxShadow: m.status === 'online' ? '0 0 6px #22c55e' : 'none' }} />
              </div>
              <XPBar current={m.xp} next={m.xpToNext} color={m.avatarColor} />
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex gap-1 flex-wrap">
                  {earnedBadges.slice(0, 3).map(b => (
                    <span key={b.id} title={b.name} className="text-xs">{b.emoji}</span>
                  ))}
                </div>
                {!loading && (
                  <div className="text-[9px] font-bold shrink-0 flex items-center gap-0.5"
                    style={{ color: brainPushes > 0 ? m.avatarColor : '#374151' }}>
                    🧠 {brainPushes}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Right: live work logs from DOME Brain */}
      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        <div className="flex items-center justify-between shrink-0">
          <div>
            <div className="text-lg font-black text-white">Activity Feed</div>
            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" style={{ boxShadow: '0 0 4px #22c55e' }} />
              Live from DOME Brain
              {loading && <span className="animate-pulse">· Loading...</span>}
              {!loading && <span>· {workLogs.length} sessions logged</span>}
            </div>
          </div>
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')}
              className="text-xs px-3 py-1.5 rounded-lg text-gray-400 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              Clear filter ✕
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
          {loading && (
            <div className="flex flex-col gap-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="rounded-2xl p-4 animate-pulse" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', height: 100 }} />
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 text-gray-500 text-sm">
              No activity yet{filter !== 'all' ? ' for this person' : ''}.
            </div>
          )}

          {filtered.map(log => {
            const member = resolveMember(log.team_member);
            const color = member?.avatarColor || '#6b7280';
            const accent = member?.avatarAccent || '#9ca3af';

            return (
              <div key={log.id} className="rounded-2xl p-4 flex gap-4 transition-all hover:border-white/10"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>

                {/* Avatar */}
                <div className="shrink-0 flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-black"
                    style={{ background: `radial-gradient(circle at 35% 35%, ${accent}, ${color})`, boxShadow: `0 0 12px ${color}66` }}>
                    {member ? member.name[0] : log.team_member[0]?.toUpperCase()}
                  </div>
                  <div className="w-0.5 flex-1 rounded-full" style={{ background: `${color}22`, minHeight: 20 }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-sm text-white">{member?.name || log.team_member}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: `${color}18`, color, border: `1px solid ${color}33` }}>
                      {log.project_name}
                    </span>
                    <span className="text-[10px] text-gray-600 ml-auto">{timeAgo(log.created_at)}</span>
                  </div>

                  <p className="text-gray-300 text-xs leading-relaxed line-clamp-3">{log.summary}</p>

                  {log.next_steps && (
                    <div className="mt-2 text-[10px] text-gray-500">
                      <span className="text-indigo-400 font-semibold">Next → </span>
                      <span className="line-clamp-1">{log.next_steps}</span>
                    </div>
                  )}

                  {log.tags && log.tags.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {log.tags.map(tag => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-md"
                          style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.08)' }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}
