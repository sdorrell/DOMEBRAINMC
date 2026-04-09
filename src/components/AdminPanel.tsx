import { useEffect, useState } from 'react';
import {
  fetchSuggestions, approveSuggestion, declineSuggestion,
  fetchUpdateRequests, approveRequestForDev, toggleRequestUpvote,
  subscribeToSuggestions, subscribeToUpdateRequests,
  type DBSuggestion, type DBUpdateRequest,
} from '../lib/supabase';

const PRIORITY_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  high:   { color: '#ff6b6b', bg: 'rgba(255,107,107,0.12)', label: '🔴 High' },
  medium: { color: '#ffd166', bg: 'rgba(255,209,102,0.12)', label: '🟡 Med' },
  low:    { color: '#6bcb77', bg: 'rgba(107,203,119,0.12)', label: '🟢 Low' },
};

const CATEGORY_EMOJI: Record<string, string> = {
  feature: '✨', bug: '🐛', improvement: '⚡', performance: '🚀', ux: '🎨', other: '💬',
};

const STATUS_STYLE: Record<string, { color: string; label: string }> = {
  open:        { color: '#60a5fa', label: '🔵 Open' },
  in_progress: { color: '#fbbf24', label: '🟡 In Dev' },
  done:        { color: '#4ade80', label: '✅ Done' },
  declined:    { color: '#6b7280', label: '⛔ Declined' },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return 'just now';
}

export default function AdminPanel({ currentUserId }: { currentUserId: string }) {
  const [suggestions, setSuggestions] = useState<DBSuggestion[]>([]);
  const [requests, setRequests] = useState<DBUpdateRequest[]>([]);
  const [activeSection, setActiveSection] = useState<'requests' | 'ai' | 'implemented'>('ai');
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchSuggestions(), fetchUpdateRequests()]).then(([s, r]) => {
      setSuggestions(s);
      setRequests(r);
      setLoading(false);
    });

    const subS = subscribeToSuggestions(incoming => {
      setSuggestions(prev => {
        const idx = prev.findIndex(s => s.id === incoming.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = incoming; return next; }
        return [incoming, ...prev];
      });
    });

    const subR = subscribeToUpdateRequests(incoming => {
      setRequests(prev => {
        const idx = prev.findIndex(r => r.id === incoming.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = incoming; return next; }
        return [incoming, ...prev];
      });
    });

    return () => { supabaseSub(subS); supabaseSub(subR); };
  }, []);

  function supabaseSub(sub: any) { try { sub.unsubscribe(); } catch { /* ignore */ } }

  const handleApproveSuggestion = async (id: string) => {
    setApproving(id);
    await approveSuggestion(id);
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'approved', approved_at: new Date().toISOString() } : s));
    setApproving(null);
  };

  const handleDeclineSuggestion = async (id: string) => {
    setApproving(id);
    await declineSuggestion(id);
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'declined' } : s));
    setApproving(null);
  };

  const handleApproveRequest = async (reqId: string) => {
    setApproving(reqId);
    await approveRequestForDev(reqId);
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, approved_for_dev: true, status: 'in_progress' as const } : r));
    setApproving(null);
  };

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
  const approvedSuggestions = suggestions.filter(s => s.status === 'approved' || s.status === 'in_progress');
  const implementedSuggestions = suggestions.filter(s => s.status === 'implemented');
  const openRequests = requests.filter(r => r.status === 'open' || r.status === 'in_progress')
    .sort((a, b) => b.upvotes.length - a.upvotes.length);
  const lastRun = suggestions.length > 0
    ? suggestions.reduce((latest, s) => s.created_at > latest ? s.created_at : latest, suggestions[0].created_at)
    : null;

  const SECTIONS = [
    { id: 'ai' as const, label: '🤖 AI Suggestions', count: pendingSuggestions.length + approvedSuggestions.length },
    { id: 'requests' as const, label: '📬 Team Requests', count: openRequests.length },
    { id: 'implemented' as const, label: '✅ Implemented', count: implementedSuggestions.length },
  ];

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', boxShadow: '0 0 20px rgba(245,158,11,0.4)' }}>
              ⚡
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">Upgrade Control Center</h1>
              <p className="text-xs" style={{ color: '#6b7280' }}>
                Scott-only · AI runs nightly at 2am
                {lastRun && <span className="ml-2 text-yellow-500">Last batch: {timeAgo(lastRun)}</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex gap-3">
          {[
            { label: 'Pending', val: pendingSuggestions.length, color: '#a78bfa' },
            { label: 'Approved', val: approvedSuggestions.length, color: '#fbbf24' },
            { label: 'Implemented', val: implementedSuggestions.length, color: '#4ade80' },
            { label: 'Team Requests', val: openRequests.length, color: '#60a5fa' },
          ].map(s => (
            <div key={s.label} className="px-3 py-2 rounded-xl text-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-xl font-black" style={{ color: s.color }}>{s.val}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 shrink-0">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
            style={activeSection === s.id
              ? { background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.5)', color: '#e0e7ff' }
              : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
            {s.label}
            {s.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black"
                style={{ background: activeSection === s.id ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)', color: activeSection === s.id ? '#e0e7ff' : '#9ca3af' }}>
                {s.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="text-gray-500 text-sm animate-pulse">Loading upgrade data...</div>
          </div>
        ) : (
          <>
            {/* ── AI Suggestions ── */}
            {activeSection === 'ai' && (
              <div className="flex flex-col gap-3">
                {/* Approved queue */}
                {approvedSuggestions.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs font-bold text-yellow-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <span>🔄 Approved — Implementing Tonight</span>
                      <div className="flex-1 h-px" style={{ background: 'rgba(251,191,36,0.2)' }} />
                    </div>
                    <div className="flex flex-col gap-2">
                      {approvedSuggestions.map(s => (
                        <SuggestionCard key={s.id} s={s} approving={approving}
                          onApprove={handleApproveSuggestion} onDecline={handleDeclineSuggestion} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending */}
                <div>
                  <div className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span>💡 Awaiting Your Review</span>
                    <div className="flex-1 h-px" style={{ background: 'rgba(167,139,250,0.2)' }} />
                  </div>
                  {pendingSuggestions.length === 0 ? (
                    <div className="text-center py-10 text-gray-600 text-sm">
                      No pending suggestions — new ones arrive nightly at 2am
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {pendingSuggestions.map(s => (
                        <SuggestionCard key={s.id} s={s} approving={approving}
                          onApprove={handleApproveSuggestion} onDecline={handleDeclineSuggestion} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Team Requests ── */}
            {activeSection === 'requests' && (
              <div className="flex flex-col gap-2">
                {openRequests.length === 0 ? (
                  <div className="text-center py-10 text-gray-600 text-sm">No open requests from the team yet</div>
                ) : openRequests.map(r => (
                  <RequestCard key={r.id} r={r} approving={approving} onApprove={handleApproveRequest} currentUserId={currentUserId} />
                ))}
              </div>
            )}

            {/* ── Implemented ── */}
            {activeSection === 'implemented' && (
              <div className="flex flex-col gap-2">
                {implementedSuggestions.length === 0 ? (
                  <div className="text-center py-10 text-gray-600 text-sm">Nothing implemented yet — approve suggestions above!</div>
                ) : implementedSuggestions.map(s => (
                  <div key={s.id} className="p-4 rounded-xl"
                    style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.2)' }}>
                    <div className="flex items-start gap-3">
                      <div className="text-xl mt-0.5">{CATEGORY_EMOJI[s.category] || '💬'}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white text-sm">{s.title}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full text-green-400"
                            style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)' }}>
                            ✅ Implemented
                          </span>
                        </div>
                        {s.implementation_summary && (
                          <p className="text-xs text-gray-400">{s.implementation_summary}</p>
                        )}
                        {s.implemented_at && (
                          <p className="text-[10px] text-gray-600 mt-1">Deployed {timeAgo(s.implemented_at)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer info */}
      <div className="shrink-0 px-4 py-2.5 rounded-xl flex items-center gap-3"
        style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs"
          style={{ background: 'rgba(99,102,241,0.2)' }}>🤖</div>
        <div className="text-xs text-gray-500 flex-1">
          Every night at <span className="text-indigo-400 font-semibold">2:00 AM</span>, the AI reviews team feedback,
          generates fresh suggestions, and automatically implements anything you've approved.
        </div>
        <div className="text-xs text-gray-600">Next run in ~{getHoursUntil2am()}h</div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function SuggestionCard({ s, approving, onApprove, onDecline }: {
  s: DBSuggestion;
  approving: string | null;
  onApprove: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const pri = PRIORITY_STYLE[s.priority] || PRIORITY_STYLE.medium;
  const isApproved = s.status === 'approved' || s.status === 'in_progress';
  const isLoading = approving === s.id;

  return (
    <div className="p-4 rounded-xl transition-all"
      style={{
        background: isApproved ? 'rgba(251,191,36,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isApproved ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.08)'}`,
      }}>
      <div className="flex items-start gap-3">
        <div className="text-2xl mt-0.5 shrink-0">{CATEGORY_EMOJI[s.category] || '💬'}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-white text-sm">{s.title}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ color: pri.color, background: pri.bg }}>
              {pri.label}
            </span>
            {isApproved && (
              <span className="text-[10px] px-2 py-0.5 rounded-full text-yellow-400"
                style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)' }}>
                🔄 Approved — queued for tonight
              </span>
            )}
          </div>
          {s.description && (
            <p className="text-xs text-gray-400 leading-relaxed mb-3">{s.description}</p>
          )}
          {!isApproved && (
            <div className="flex gap-2">
              <button
                onClick={() => onApprove(s.id)}
                disabled={!!isLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80' }}>
                {isLoading ? '...' : '✅ Approve'}
              </button>
              <button
                onClick={() => onDecline(s.id)}
                disabled={!!isLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280' }}>
                {isLoading ? '...' : '✗ Skip'}
              </button>
            </div>
          )}
          {isApproved && (
            <button
              onClick={() => onDecline(s.id)}
              disabled={!!isLoading}
              className="px-2.5 py-1 rounded-lg text-[11px] transition-all"
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
              Undo approval
            </button>
          )}
        </div>
        <div className="text-[10px] text-gray-600 shrink-0 mt-1">
          {new Date(s.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

function RequestCard({ r, approving, onApprove, currentUserId }: {
  r: DBUpdateRequest & { approved_for_dev?: boolean };
  approving: string | null;
  onApprove: (id: string) => void;
  currentUserId: string;
}) {
  const st = STATUS_STYLE[r.status] || STATUS_STYLE.open;
  const isLoading = approving === r.id;
  const isApproved = (r as any).approved_for_dev === true || r.status === 'in_progress';

  return (
    <div className="p-4 rounded-xl transition-all"
      style={{
        background: isApproved ? 'rgba(251,191,36,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isApproved ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.08)'}`,
      }}>
      <div className="flex items-start gap-3">
        <div className="text-2xl shrink-0 mt-0.5">{CATEGORY_EMOJI[r.category] || '💬'}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-white text-sm">{r.title}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: st.color, background: `${st.color}22` }}>
              {st.label}
            </span>
            {r.upvotes.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full text-purple-300"
                style={{ background: 'rgba(167,139,250,0.15)' }}>
                👍 {r.upvotes.length} vote{r.upvotes.length !== 1 ? 's' : ''}
              </span>
            )}
            {isApproved && (
              <span className="text-[10px] px-2 py-0.5 rounded-full text-yellow-400"
                style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)' }}>
                🔄 Sent to dev
              </span>
            )}
          </div>
          {r.description && (
            <p className="text-xs text-gray-400 leading-relaxed mb-2">{r.description}</p>
          )}
          <div className="flex items-center gap-2">
            {!isApproved && (
              <button
                onClick={() => onApprove(r.id)}
                disabled={!!isLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24' }}>
                {isLoading ? '...' : '⚡ Send to Dev'}
              </button>
            )}
            <span className="text-[10px] text-gray-600">{r.author_id} · {new Date(r.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getHoursUntil2am() {
  const now = new Date();
  const next2am = new Date();
  next2am.setHours(2, 0, 0, 0);
  if (next2am <= now) next2am.setDate(next2am.getDate() + 1);
  return Math.ceil((next2am.getTime() - now.getTime()) / 3600000);
}
