import { useState, useEffect } from 'react';
import { TEAM_MEMBERS, BADGES, getLevelTier, WORK_LOGS, IDEAS } from '../data/gameData';
import { fetchXpEvents } from '../lib/supabase';
import type { DBXpEvent } from '../lib/supabase';
import type { TeamMember } from '../types';

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`, boxShadow: `0 0 6px ${color}88` }}
      />
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function XpEventsModal({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const [events, setEvents] = useState<DBXpEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchXpEvents(member.id, 50).then(data => {
      setEvents(data);
      setLoading(false);
    });
  }, [member.id]);

  const totalXp = events.reduce((sum, e) => sum + e.xp_delta, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col overflow-hidden"
        style={{ background: '#0f1117', border: `1px solid ${member.avatarColor}44`, boxShadow: `0 0 40px ${member.avatarColor}22`, maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: member.avatarColor, boxShadow: `0 0 12px ${member.avatarColor}66` }}
          >
            {member.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white">{member.name}</div>
            <div className="text-xs text-gray-500">{member.role}</div>
          </div>
          <div className="text-right">
            <div className="text-yellow-400 font-bold text-sm">{member.xp.toLocaleString()} XP</div>
            <div className="text-[10px] text-gray-500">Lv{member.level}</div>
          </div>
          <button
            onClick={onClose}
            className="ml-2 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-400 text-sm shrink-0 transition-colors"
          >✕</button>
        </div>

        {/* Subheader */}
        <div className="px-5 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-xs text-gray-500">⚡ XP Event History</div>
          {!loading && events.length > 0 && (
            <div className="text-xs text-gray-500">{events.length} events · <span className="text-yellow-400 font-medium">+{totalXp.toLocaleString()} XP total</span></div>
          )}
        </div>

        {/* Events list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-1.5">
          {loading && (
            <div className="text-center text-gray-500 text-sm py-8">Loading events...</div>
          )}
          {!loading && events.length === 0 && (
            <div className="text-center text-gray-600 text-sm py-8">No XP events yet.</div>
          )}
          {events.map(event => (
            <div
              key={event.id}
              className="flex items-center gap-3 py-2 px-3 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div
                className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full"
                style={event.xp_delta >= 0
                  ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80' }
                  : { background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
              >
                {event.xp_delta >= 0 ? '+' : ''}{event.xp_delta} XP
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200 truncate">{event.reason}</div>
              </div>
              <div className="shrink-0 text-[10px] text-gray-600">{timeAgo(event.created_at)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Leaderboard({ liveMembers }: { liveMembers?: TeamMember[] }) {
  const members = liveMembers && liveMembers.length > 0 ? liveMembers : TEAM_MEMBERS;
  const sorted = [...members].sort((a, b) => b.xp - a.xp);
  const topXP = sorted[0]?.xp || 1;

  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const logsByMember = Object.fromEntries(
    members.map(m => [m.id, WORK_LOGS.filter(l => l.authorId === m.id).length])
  );
  const ideasByMember = Object.fromEntries(
    members.map(m => [m.id, IDEAS.filter(i => i.authorId === m.id).length])
  );
  const votesByMember = Object.fromEntries(
    members.map(m => [m.id, IDEAS.reduce((sum, i) => sum + (i.upvotes.includes(m.id) ? 1 : 0), 0)])
  );

  const MEDAL = ['🥇', '🥈', '🥉'];

  return (
    <>
      <div className="flex flex-col gap-4 h-full overflow-hidden">
        <div>
          <h2 className="text-lg font-bold text-white">🏆 Leaderboard</h2>
          <p className="text-xs text-gray-400">XP rankings, badge counts, contribution stats. <span className="text-indigo-400">Click any row to see XP breakdown.</span></p>
        </div>

        {/* Top 3 podium */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 0, 2].map((rankIdx, col) => {
            const m = sorted[rankIdx];
            if (!m) return <div key={col} />;
            const tier = getLevelTier(m.level);
            const heights = ['h-24', 'h-28', 'h-20'];
            const podiumColors = ['rgba(192,192,192,0.15)', 'rgba(255,215,0,0.15)', 'rgba(205,127,50,0.15)'];
            const borderColors = ['rgba(192,192,192,0.4)', 'rgba(255,215,0,0.4)', 'rgba(205,127,50,0.4)'];

            return (
              <div
                key={col}
                className={`rounded-xl p-3 flex flex-col items-center gap-2 ${heights[col]} justify-end cursor-pointer transition-opacity hover:opacity-80`}
                style={{
                  background: col === 1 ? 'rgba(255,215,0,0.12)' : podiumColors[col],
                  border: `1px solid ${col === 1 ? borderColors[1] : borderColors[col]}`,
                  boxShadow: col === 1 ? '0 0 20px rgba(255,215,0,0.15)' : 'none',
                }}
                onClick={() => setSelectedMember(m)}
              >
                <div className="text-2xl">{MEDAL[rankIdx]}</div>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: m.avatarColor, boxShadow: `0 0 10px ${m.avatarColor}66` }}
                >
                  {m.name[0]}
                </div>
                <div className="text-sm font-bold text-white text-center">{m.name}</div>
                <div className="text-xs font-bold" style={{ color: tier.color }}>
                  Lv{m.level} {tier.title}
                </div>
                <div className="text-lg font-bold text-yellow-400">{m.xp.toLocaleString()} XP</div>
                <div className="flex gap-0.5">
                  {m.badges.slice(0, 4).map(bid => {
                    const b = BADGES.find(x => x.id === bid);
                    return b ? <span key={bid} className="text-sm" title={b.name}>{b.emoji}</span> : null;
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Full table */}
        <div className="flex-1 overflow-y-auto">
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.5)' }}>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">Rank</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">Member</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">Level</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium min-w-32">XP Progress</th>
                  <th className="px-4 py-2 text-center text-xs text-gray-500 font-medium">Logs</th>
                  <th className="px-4 py-2 text-center text-xs text-gray-500 font-medium">Ideas</th>
                  <th className="px-4 py-2 text-center text-xs text-gray-500 font-medium">Votes</th>
                  <th className="px-4 py-2 text-center text-xs text-gray-500 font-medium">Badges</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((m, idx) => {
                  const tier = getLevelTier(m.level);
                  const allBadges = [...m.badges, ...m.activeBadges];

                  return (
                    <tr
                      key={m.id}
                      className="transition-colors hover:bg-white/5 cursor-pointer"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                      onClick={() => setSelectedMember(m)}
                    >
                      <td className="px-4 py-3 text-gray-400">
                        {idx < 3 ? MEDAL[idx] : <span className="text-gray-600">#{idx + 1}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ background: m.avatarColor }}
                          >{m.name[0]}</div>
                          <div>
                            <div className="font-medium text-white text-sm">{m.name}</div>
                            <div className="text-[10px] text-gray-500">{m.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-sm" style={{ color: tier.color }}>Lv{m.level}</div>
                        <div className="text-[10px] text-gray-500">{tier.title}</div>
                      </td>
                      <td className="px-4 py-3 min-w-36">
                        <ProgressBar value={m.xp} max={topXP} color={m.avatarColor} />
                        <div className="text-[10px] text-gray-500 mt-0.5">{m.xp.toLocaleString()} / {m.xpToNext.toLocaleString()}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-white font-medium">{logsByMember[m.id] || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-white font-medium">{ideasByMember[m.id] || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-white font-medium">{votesByMember[m.id] || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-wrap gap-0.5 justify-center max-w-20">
                          {allBadges.slice(0, 5).map(bid => {
                            const b = BADGES.find(x => x.id === bid);
                            const isNeg = m.activeBadges.includes(bid);
                            return b ? (
                              <span key={bid} title={b.name} className="text-sm" style={isNeg ? { filter: 'opacity(0.6)' } : {}}>{b.emoji}</span>
                            ) : null;
                          })}
                          {allBadges.length > 5 && <span className="text-[10px] text-gray-500">+{allBadges.length - 5}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            m.status === 'online' ? 'text-green-400' : m.status === 'away' ? 'text-yellow-400' : 'text-gray-500'
                          }`}
                          style={{ background: 'rgba(255,255,255,0.05)' }}
                        >
                          ● {m.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedMember && (
        <XpEventsModal member={selectedMember} onClose={() => setSelectedMember(null)} />
      )}
    </>
  );
}
