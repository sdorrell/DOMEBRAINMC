import { useState } from 'react';

import { TEAM_MEMBERS, WORK_LOGS, BADGES, getLevelTier, getXpForLevel } from '../data/gameData';

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
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}88` }}
      />
    </div>
  );
}

export default function Dashboard() {
  const [filter, setFilter] = useState<string>('all');

  const sortedLogs = [...WORK_LOGS].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const filteredLogs = filter === 'all' ? sortedLogs : sortedLogs.filter(l => l.authorId === filter);

  // Stats
  const totalLogs = WORK_LOGS.length;
  const totalXP = WORK_LOGS.reduce((sum, l) => sum + l.xpAwarded, 0);
  const activeMembers = TEAM_MEMBERS.filter(m => m.status !== 'offline').length;
  const projects = [...new Set(WORK_LOGS.map(l => l.project))];

  return (
    <div className="flex gap-4 h-full">
      {/* Main feed */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Active Today', value: activeMembers, sub: 'of 7 team members', color: '#22c55e', emoji: '🟢' },
            { label: 'Work Logs', value: totalLogs, sub: 'total logged this week', color: '#6366f1', emoji: '📋' },
            { label: 'XP Earned', value: totalXP.toLocaleString(), sub: 'across all members', color: '#f59e0b', emoji: '⚡' },
            { label: 'Active Projects', value: projects.length, sub: 'currently tracked', color: '#10b981', emoji: '🚀' },
          ].map(stat => (
            <div
              key={stat.label}
              className="rounded-xl p-3"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="text-xl">{stat.emoji}</div>
              <div className="text-2xl font-bold mt-1" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-xs font-medium text-white mt-0.5">{stat.label}</div>
              <div className="text-[11px] text-gray-500">{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex gap-2 items-center">
          <span className="text-xs text-gray-500 font-medium">Filter:</span>
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-3 py-1 rounded-lg transition-colors font-medium ${filter === 'all' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            style={filter === 'all' ? { background: 'rgba(99,102,241,0.4)', border: '1px solid rgba(99,102,241,0.6)' } : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >All</button>
          {TEAM_MEMBERS.map(m => (
            <button
              key={m.id}
              onClick={() => setFilter(m.id)}
              className="text-xs px-3 py-1 rounded-lg transition-colors font-medium"
              style={filter === m.id
                ? { background: m.avatarColor + '55', border: `1px solid ${m.avatarColor}`, color: m.avatarAccent }
                : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}
            >{m.name}</button>
          ))}
        </div>

        {/* Activity feed */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
          {filteredLogs.map(log => {
            const member = TEAM_MEMBERS.find(m => m.id === log.authorId);
            if (!member) return null;
            const tier = getLevelTier(member.level);
            return (
              <div
                key={log.id}
                className="rounded-xl p-3 flex gap-3"
                style={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${member.avatarColor}22` }}
              >
                {/* Avatar */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: member.avatarColor, boxShadow: `0 0 8px ${member.avatarColor}55` }}
                  >
                    {member.name[0]}
                  </div>
                  <div className="text-[10px]" style={{ color: tier.color }}>Lv{member.level}</div>
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-bold" style={{ color: member.avatarColor }}>{member.name}</span>
                    <span className="text-xs text-gray-500">{member.role}</span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: `${member.avatarColor}22`, color: member.avatarAccent }}
                    >
                      {log.project}
                    </span>
                    <span className="text-xs text-gray-600 ml-auto">{timeAgo(log.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-300 mt-1 leading-relaxed">{log.summary}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>+{log.xpAwarded} XP</span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full ${member.status === 'online' ? 'text-green-400' : member.status === 'away' ? 'text-yellow-400' : 'text-gray-500'}`}
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    >
                      ● {member.lastActive}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right sidebar — team roster */}
      <div className="w-52 flex flex-col gap-3 overflow-y-auto">
        <div
          className="rounded-xl p-3"
          style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Team Roster</div>
          <div className="flex flex-col gap-3">
            {[...TEAM_MEMBERS].sort((a, b) => b.xp - a.xp).map((m, i) => {
              const tier = getLevelTier(m.level);
              const pct = Math.min(100, (m.xp / m.xpToNext) * 100);
              return (
                <div key={m.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-600 w-4 shrink-0">#{i + 1}</span>
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ background: m.avatarColor }}
                    >{m.name[0]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white flex items-center gap-1">
                        {m.name}
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${m.status === 'online' ? 'bg-green-400' : m.status === 'away' ? 'bg-yellow-400' : 'bg-gray-600'}`}
                        />
                      </div>
                      <div className="text-[10px]" style={{ color: tier.color }}>{tier.title} · Lv{m.level}</div>
                    </div>
                  </div>
                  <XPBar current={m.xp} next={m.xpToNext} color={m.avatarColor} />
                  <div className="flex justify-between text-[10px] text-gray-600">
                    <span>{m.xp.toLocaleString()} XP</span>
                    <span>{m.xpToNext.toLocaleString()}</span>
                  </div>
                  {/* Badges preview */}
                  {m.badges.length > 0 && (
                    <div className="flex gap-0.5 flex-wrap mt-0.5">
                      {m.badges.slice(0, 5).map(bid => {
                        const badge = BADGES.find(b => b.id === bid);
                        return badge ? (
                          <span key={bid} title={badge.name} className="text-sm">{badge.emoji}</span>
                        ) : null;
                      })}
                      {m.badges.length > 5 && <span className="text-[10px] text-gray-500">+{m.badges.length - 5}</span>}
                    </div>
                  )}
                  {m.activeBadges.length > 0 && (
                    <div className="flex gap-0.5 flex-wrap">
                      {m.activeBadges.map(bid => {
                        const badge = BADGES.find(b => b.id === bid);
                        return badge ? (
                          <span key={bid} title={badge.name} className="text-sm opacity-70">{badge.emoji}</span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
