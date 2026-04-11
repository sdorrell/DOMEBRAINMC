import { useState, useEffect } from 'react';
import { TEAM_MEMBERS } from '../data/gameData';
import { fetchWorkSummaries, type DBWorkSummary } from '../lib/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateKey(iso: string): string {
  return iso.slice(0, 10); // "YYYY-MM-DD"
}

function formatDay(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function resolveMember(teamMember: string) {
  const lower = teamMember.toLowerCase();
  return TEAM_MEMBERS.find(m => lower.includes(m.id) || lower.startsWith(m.name.toLowerCase()));
}

// ─── Calendar grid cell ───────────────────────────────────────────────────────

function CalCell({
  day, sessionCount, hasActivity, isToday, isSelected, onClick, memberColors,
}: {
  day: number;
  sessionCount: number;
  hasActivity: boolean;
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
  memberColors: string[];
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center justify-start rounded-lg transition-all cursor-pointer"
      style={{
        minHeight: 52,
        padding: '4px 2px',
        background: isSelected
          ? 'rgba(99,102,241,0.25)'
          : isToday
          ? 'rgba(99,102,241,0.1)'
          : hasActivity
          ? 'rgba(255,255,255,0.03)'
          : 'transparent',
        border: isSelected
          ? '1px solid rgba(99,102,241,0.6)'
          : isToday
          ? '1px solid rgba(99,102,241,0.3)'
          : '1px solid transparent',
      }}>
      <span
        className="text-xs font-bold leading-none mb-1"
        style={{ color: isToday ? '#a5b4fc' : isSelected ? '#e0e7ff' : '#6b7280' }}>
        {day}
      </span>

      {/* Activity dots — one per unique member who logged that day */}
      {hasActivity && (
        <div className="flex gap-0.5 flex-wrap justify-center">
          {memberColors.slice(0, 5).map((color, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full"
              style={{ background: color, boxShadow: `0 0 3px ${color}88` }} />
          ))}
          {sessionCount > 5 && (
            <div className="text-[8px] text-gray-500">+{sessionCount - 5}</div>
          )}
        </div>
      )}
    </button>
  );
}

// ─── Day detail panel ─────────────────────────────────────────────────────────

function DayDetail({ dateKey, logs }: { dateKey: string; logs: DBWorkSummary[] }) {
  if (logs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        No sessions logged on {formatDay(dateKey)}.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
        {formatDay(dateKey)} · {logs.length} session{logs.length !== 1 ? 's' : ''}
      </div>
      {logs.map(log => {
        const member = resolveMember(log.team_member);
        const color = member?.avatarColor || '#6b7280';
        const accent = member?.avatarAccent || '#9ca3af';
        return (
          <div key={log.id} className="rounded-xl p-3 flex gap-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}22` }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
              style={{ background: `radial-gradient(circle at 35% 35%, ${accent}, ${color})`, boxShadow: `0 0 8px ${color}55` }}>
              {member ? member.name[0] : log.team_member[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-white text-xs font-bold">{member?.name || log.team_member}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ background: `${color}20`, color, border: `1px solid ${color}33` }}>
                  {log.project_name}
                </span>
              </div>
              <p className="text-gray-300 text-[11px] leading-relaxed">{log.summary}</p>
              {log.next_steps && (
                <div className="mt-1.5 text-[10px] text-gray-500">
                  <span className="text-indigo-400 font-semibold">Next → </span>
                  {log.next_steps}
                </div>
              )}
              {log.tags && log.tags.length > 0 && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {log.tags.map(tag => (
                    <span key={tag} className="text-[9px] px-1 py-0.5 rounded"
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280' }}>
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
  );
}

// ─── Main CalendarView ────────────────────────────────────────────────────────

export default function CalendarView() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<string>(toDateKey(today.toISOString()));
  const [logs, setLogs] = useState<DBWorkSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkSummaries(200).then(data => {
      setLogs(data);
      setLoading(false);
    });
  }, []);

  // Group logs by date key
  const logsByDate: Record<string, DBWorkSummary[]> = {};
  for (const log of logs) {
    const dk = toDateKey(log.created_at);
    if (!logsByDate[dk]) logsByDate[dk] = [];
    logsByDate[dk].push(log);
  }

  // Build month grid
  const firstDow = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const totalDays = daysInMonth(viewYear, viewMonth);
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const todayKey = toDateKey(today.toISOString());
  const selectedLogs = logsByDate[selectedDay] || [];

  // Find the most active days for the mini stats bar
  const activityCounts = Object.entries(logsByDate)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3);

  return (
    <div className="h-full flex gap-4 overflow-hidden">

      {/* ── Left: Calendar + mini stats ── */}
      <div className="flex flex-col gap-3 shrink-0 w-72">

        {/* Month navigation */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors text-sm"
              style={{ background: 'rgba(255,255,255,0.06)' }}>‹</button>
            <div className="text-sm font-black text-white">{monthName}</div>
            <button onClick={nextMonth}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors text-sm"
              style={{ background: 'rgba(255,255,255,0.06)' }}>›</button>
          </div>

          {/* Day of week headers */}
          <div className="grid grid-cols-7 mb-1">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} className="text-[10px] text-center text-gray-600 font-bold">{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {/* Empty cells for first-day offset */}
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1;
              const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayLogs = logsByDate[dateKey] || [];
              const uniqueMembers = [...new Set(dayLogs.map(l => resolveMember(l.team_member)?.avatarColor || '#6b7280'))];

              return (
                <CalCell
                  key={day}
                  day={day}
                  sessionCount={dayLogs.length}
                  hasActivity={dayLogs.length > 0}
                  isToday={dateKey === todayKey}
                  isSelected={dateKey === selectedDay}
                  memberColors={uniqueMembers}
                  onClick={() => setSelectedDay(dateKey)}
                />
              );
            })}
          </div>
        </div>

        {/* Activity stats */}
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Most Active Days</div>
          {loading && <div className="text-gray-600 text-xs animate-pulse">Loading...</div>}
          {!loading && activityCounts.length === 0 && (
            <div className="text-gray-600 text-xs">No data yet.</div>
          )}
          {activityCounts.map(([dk, dayLogs]) => (
            <button key={dk}
              onClick={() => { setSelectedDay(dk); setViewYear(parseInt(dk.slice(0,4))); setViewMonth(parseInt(dk.slice(5,7))-1); }}
              className="w-full flex items-center justify-between mb-1.5 text-left hover:opacity-80 transition-opacity">
              <span className="text-xs text-gray-400">{formatDay(dk)}</span>
              <span className="text-xs font-bold text-indigo-400">{dayLogs.length} sessions</span>
            </button>
          ))}
        </div>

        {/* Team activity totals */}
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">DOME Brain Pushes</div>
          {TEAM_MEMBERS.map(m => {
            const count = logs.filter(l => resolveMember(l.team_member)?.id === m.id).length;
            const maxCount = Math.max(1, ...TEAM_MEMBERS.map(tm =>
              logs.filter(l => resolveMember(l.team_member)?.id === tm.id).length
            ));
            return (
              <div key={m.id} className="flex items-center gap-2 mb-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-black shrink-0"
                  style={{ background: m.avatarColor }}>{m.name[0]}</div>
                <div className="flex-1">
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${(count / maxCount) * 100}%`, background: m.avatarColor, boxShadow: `0 0 4px ${m.avatarColor}66` }} />
                  </div>
                </div>
                <span className="text-[10px] font-bold shrink-0" style={{ color: m.avatarColor, minWidth: 16 }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: Day detail ── */}
      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        <div className="flex items-center justify-between shrink-0">
          <div>
            <div className="text-lg font-black text-white">
              {formatDay(selectedDay)}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {loading ? 'Loading sessions...' : selectedLogs.length === 0 ? 'No sessions logged this day' : `${selectedLogs.length} session${selectedLogs.length !== 1 ? 's' : ''} logged`}
            </div>
          </div>
          {selectedDay === todayKey && (
            <div className="px-3 py-1 rounded-lg text-xs font-bold text-green-400"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
              Today
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-xl p-3 animate-pulse" style={{ background: 'rgba(255,255,255,0.03)', height: 80 }} />
            ))}
          </div>
        ) : (
          <DayDetail dateKey={selectedDay} logs={selectedLogs} />
        )}
      </div>
    </div>
  );
}
