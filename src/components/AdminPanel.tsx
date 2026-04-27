import { useEffect, useState } from 'react';
import {
  fetchSuggestions, approveSuggestion, declineSuggestion,
  saveForLaterSuggestion, approveAllPendingSuggestions,
  fetchUpdateRequests, approveRequestForDev, unapproveRequest, markRequestDone, toggleRequestUpvote,
  subscribeToSuggestions, subscribeToUpdateRequests,
  getConfig, setConfig,
  fetchWorkSummaries, getFlaggedSessions, flagSpamSession, unflagSpamSession,
  fetchWorldRequests, updateWorldRequestStatus,
  getHappyHour, startHappyHour, endHappyHour,
  sendChatMessage,
  type DBSuggestion, type DBUpdateRequest, type DBWorkSummary, type DBWorldRequest,
  type HappyHourState,
} from '../lib/supabase';
import { TEAM_MEMBERS } from '../data/gameData';

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

function resolveMemberId(teamMemberName: string): string | null {
  const lower = teamMemberName.toLowerCase().trim();
  const m = TEAM_MEMBERS.find(tm => lower.includes(tm.name.toLowerCase()));
  return m?.id ?? null;
}

export default function AdminPanel({ currentUserId }: { currentUserId: string }) {
  const [suggestions, setSuggestions] = useState<DBSuggestion[]>([]);
  const [requests, setRequests] = useState<DBUpdateRequest[]>([]);
  const [workSummaries, setWorkSummaries] = useState<DBWorkSummary[]>([]);
  const [flaggedIds, setFlaggedIds] = useState<string[]>([]);
  const [worldRequests, setWorldRequests] = useState<DBWorldRequest[]>([]);
  const [activeSection, setActiveSection] = useState<'requests' | 'ai' | 'implemented' | 'settings' | 'moderation' | 'world'>('ai');
  const [updatingWorld, setUpdatingWorld] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [savingForLater, setSavingForLater] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [flagging, setFlagging] = useState<string | null>(null);

  // Settings / prompt customization
  const [promptNotes, setPromptNotes] = useState('');
  const [savedPromptNotes, setSavedPromptNotes] = useState('');
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);

  // XP Happy Hour state
  const [happyHour, setHappyHour] = useState<HappyHourState | null>(null);
  const [hhNow, setHhNow] = useState<number>(Date.now());
  const [hhWorking, setHhWorking] = useState(false);
  const [hhDuration, setHhDuration] = useState(30);
  const [hhMultiplier, setHhMultiplier] = useState(2);

  useEffect(() => {
    Promise.all([
      fetchSuggestions(),
      fetchUpdateRequests(),
      getConfig('nightly_prompt_notes'),
      fetchWorkSummaries(40),
      getFlaggedSessions(),
      fetchWorldRequests(),
    ]).then(([s, r, cfg, ws, flags, wr]) => {
      setSuggestions(s);
      setRequests(r);
      setWorkSummaries(ws);
      setFlaggedIds(flags);
      setWorldRequests(wr);
      const notes = cfg || '';
      setPromptNotes(notes);
      setSavedPromptNotes(notes);
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

  // Load happy hour state on mount + refresh every 30s. Tick every 1s for countdown.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      getHappyHour().then(s => { if (!cancelled) setHappyHour(s); });
    };
    refresh();
    const refreshTimer = setInterval(refresh, 30_000);
    const tickTimer = setInterval(() => setHhNow(Date.now()), 1_000);
    return () => { cancelled = true; clearInterval(refreshTimer); clearInterval(tickTimer); };
  }, []);

  const hhActive = !!(happyHour?.endsAt && hhNow < happyHour.endsAt);

  const handleStartHappyHour = async () => {
    setHhWorking(true);
    const state = await startHappyHour(hhDuration, hhMultiplier);
    setHappyHour(state);
    // Announce in chat
    await sendChatMessage(
      'dome-mc',
      `🔥 XP HAPPY HOUR ACTIVATED! ${hhMultiplier}× XP on every gain for the next ${hhDuration} minutes — get grinding!`,
    );
    setHhWorking(false);
  };

  const handleEndHappyHour = async () => {
    setHhWorking(true);
    await endHappyHour();
    setHappyHour({ endsAt: null, multiplier: hhMultiplier });
    setHhWorking(false);
  };

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

  const handleSaveForLater = async (id: string) => {
    setSavingForLater(id);
    await saveForLaterSuggestion(id);
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'saved' } : s));
    setSavingForLater(null);
  };

  const handleApproveAll = async () => {
    const ids = pendingSuggestions.map(s => s.id);
    if (!ids.length) return;
    setApprovingAll(true);
    await approveAllPendingSuggestions(ids);
    const now = new Date().toISOString();
    setSuggestions(prev => prev.map(s =>
      ids.includes(s.id) ? { ...s, status: 'approved', approved_at: now } : s
    ));
    setApprovingAll(false);
  };

  const handleApproveRequest = async (reqId: string) => {
    setApproving(reqId);
    await approveRequestForDev(reqId);
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, approved_for_dev: true, status: 'in_progress' as const } : r));
    setApproving(null);
  };

  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    await setConfig('nightly_prompt_notes', promptNotes);
    setSavedPromptNotes(promptNotes);
    setSavingPrompt(false);
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2500);
  };

  const handleUnapproveRequest = async (reqId: string) => {
    setApproving(reqId);
    await unapproveRequest(reqId);
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, approved_for_dev: false, status: 'open' as const } : r));
    setApproving(null);
  };

  const handleMarkDone = async (reqId: string) => {
    setApproving(reqId);
    await markRequestDone(reqId);
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'done' as const } : r));
    setApproving(null);
  };

  const handleWorldStatus = async (id: string, status: DBWorldRequest['status']) => {
    setUpdatingWorld(id);
    await updateWorldRequestStatus(id, status);
    setWorldRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    setUpdatingWorld(null);
  };

  const handleFlagSession = async (session: DBWorkSummary) => {
    const memberId = resolveMemberId(session.team_member);
    if (!memberId) { alert(`Can't resolve member for "${session.team_member}"`); return; }
    setFlagging(session.id);
    await flagSpamSession(session.id, memberId);
    setFlaggedIds(prev => [...prev, session.id]);
    setFlagging(null);
  };

  const handleUnflagSession = async (session: DBWorkSummary) => {
    const memberId = resolveMemberId(session.team_member);
    if (!memberId) return;
    setFlagging(session.id);
    await unflagSpamSession(session.id, memberId);
    setFlaggedIds(prev => prev.filter(id => id !== session.id));
    setFlagging(null);
  };

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
  const savedSuggestions = suggestions.filter(s => s.status === 'saved');
  const approvedSuggestions = suggestions.filter(s => s.status === 'approved' || s.status === 'in_progress');
  const implementedSuggestions = suggestions.filter(s => s.status === 'implemented');
  const openRequests = requests.filter(r => r.status === 'open' || r.status === 'in_progress')
    .sort((a, b) => b.upvotes.length - a.upvotes.length);
  const doneRequests = requests.filter(r => r.status === 'done');
  const lastRun = suggestions.length > 0
    ? suggestions.reduce((latest, s) => s.created_at > latest ? s.created_at : latest, suggestions[0].created_at)
    : null;

  const promptHasChanges = promptNotes !== savedPromptNotes;

  const pendingWorldRequests = worldRequests.filter(r => r.status === 'open');

  const SECTIONS = [
    { id: 'ai' as const, label: '🤖 AI Suggestions', count: pendingSuggestions.length + approvedSuggestions.length },
    { id: 'requests' as const, label: '📬 Team Requests', count: openRequests.length },
    { id: 'world' as const, label: '🌍 World Lab', count: pendingWorldRequests.length },
    { id: 'implemented' as const, label: '✅ Implemented', count: implementedSuggestions.length },
    { id: 'moderation' as const, label: '🐀 Moderation', count: flaggedIds.length },
    { id: 'settings' as const, label: '⚙️ Settings', count: 0 },
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
            { label: 'Saved', val: savedSuggestions.length, color: '#fbbf24' },
            { label: 'Approved', val: approvedSuggestions.length, color: '#fb923c' },
            { label: 'Shipped', val: implementedSuggestions.length, color: '#4ade80' },
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
                        <SuggestionCard key={s.id} s={s} approving={approving} savingForLater={savingForLater}
                          onApprove={handleApproveSuggestion} onDecline={handleDeclineSuggestion}
                          onSaveForLater={handleSaveForLater} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending */}
                <div>
                  <div className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span>💡 Awaiting Your Review</span>
                    <div className="flex-1 h-px" style={{ background: 'rgba(167,139,250,0.2)' }} />
                    {/* Approve All button */}
                    {pendingSuggestions.length > 1 && (
                      <button
                        onClick={handleApproveAll}
                        disabled={approvingAll}
                        className="px-3 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 shrink-0"
                        style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80' }}>
                        {approvingAll ? '⏳ Approving...' : `✅ Approve All (${pendingSuggestions.length})`}
                      </button>
                    )}
                  </div>
                  {pendingSuggestions.length === 0 ? (
                    <div className="text-center py-10 text-gray-600 text-sm">
                      No pending suggestions — new ones arrive nightly at 2am
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {pendingSuggestions.map(s => (
                        <SuggestionCard key={s.id} s={s} approving={approving} savingForLater={savingForLater}
                          onApprove={handleApproveSuggestion} onDecline={handleDeclineSuggestion}
                          onSaveForLater={handleSaveForLater} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Saved for Later */}
                {savedSuggestions.length > 0 && (
                  <div className="mt-1">
                    <div className="text-xs font-bold text-yellow-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <span>🔖 Saved for Later</span>
                      <div className="flex-1 h-px" style={{ background: 'rgba(234,179,8,0.15)' }} />
                    </div>
                    <div className="flex flex-col gap-2">
                      {savedSuggestions.map(s => (
                        <SavedCard key={s.id} s={s} approving={approving}
                          onApprove={handleApproveSuggestion} onDecline={handleDeclineSuggestion} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Team Requests ── */}
            {activeSection === 'requests' && (
              <div className="flex flex-col gap-3">
                {/* Open / in-progress */}
                {openRequests.length === 0 ? (
                  <div className="text-center py-10 text-gray-600 text-sm">No open requests — all caught up ✅</div>
                ) : openRequests.map(r => (
                  <RequestCard key={r.id} r={r} approving={approving}
                    onApprove={handleApproveRequest}
                    onUnapprove={handleUnapproveRequest}
                    onMarkDone={handleMarkDone}
                    currentUserId={currentUserId} />
                ))}

                {/* Done requests */}
                {doneRequests.length > 0 && (
                  <>
                    <div className="text-[10px] font-bold text-green-400/60 uppercase tracking-widest mt-2 flex items-center gap-2">
                      <span>✅ Implemented ({doneRequests.length})</span>
                      <div className="flex-1 h-px" style={{ background: 'rgba(74,222,128,0.15)' }} />
                    </div>
                    {doneRequests.map(r => (
                      <div key={r.id} className="p-3 rounded-xl flex items-start gap-3"
                        style={{ background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.2)', opacity: 0.7 }}>
                        <div className="text-xl shrink-0">{CATEGORY_EMOJI[r.category] || '💬'}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white text-sm line-through opacity-60">{r.title}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full text-green-400"
                              style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)' }}>
                              ✅ Done
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-600 mt-0.5">{r.author_id} · {new Date(r.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
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

            {/* ── World Lab ── */}
            {activeSection === 'world' && (
              <div className="flex flex-col gap-3">
                <div className="rounded-xl p-4 flex items-start gap-3"
                  style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.25)' }}>
                  <div className="text-2xl">🌍</div>
                  <div>
                    <div className="text-white font-bold text-sm mb-1">World Lab Requests</div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Team members submit world change requests from the World Lab panel. Approve to queue for implementation, or decline to bury them.
                    </p>
                  </div>
                </div>

                {worldRequests.length === 0 ? (
                  <div className="text-center py-10 text-gray-600 text-sm">No world requests yet — the team hasn't been bold enough</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {worldRequests.map(req => {
                      const isUpdating = updatingWorld === req.id;
                      const member = TEAM_MEMBERS.find(m => m.id === req.author_id);
                      const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
                        open: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
                        approved: { color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
                        implemented: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
                        declined: { color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
                      };
                      const sc = STATUS_COLOR[req.status] || STATUS_COLOR.open;
                      const CATEGORY_LABELS: Record<string, string> = {
                        new_zone: '🏗️ New Zone', decoration: '🎨 Decoration', event: '🎉 Event', rule_change: '📋 Rule Change', other: '💬 Other',
                      };

                      return (
                        <div key={req.id} className="p-4 rounded-xl transition-all"
                          style={{ background: req.status === 'approved' ? 'rgba(74,222,128,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${req.status === 'approved' ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.08)'}` }}>
                          <div className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                              style={{ background: member?.avatarColor || '#555' }}>{(member?.name || req.author_id)[0]}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-bold text-white text-sm">{req.title}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ color: sc.color, background: sc.bg }}>● {req.status}</span>
                                <span className="text-[10px] text-gray-500">{CATEGORY_LABELS[req.category] || req.category}</span>
                                {req.upvotes.length > 0 && <span className="text-[10px] text-indigo-300">👍 {req.upvotes.length}</span>}
                              </div>
                              {req.description && <p className="text-xs text-gray-400 mb-2">{req.description}</p>}
                              <div className="text-[10px] text-gray-600">{member?.name || req.author_id} · {new Date(req.created_at).toLocaleDateString()}</div>
                              {req.status === 'open' && (
                                <div className="flex gap-2 mt-2">
                                  <button onClick={() => handleWorldStatus(req.id, 'approved')} disabled={isUpdating}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                    style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80' }}>
                                    {isUpdating ? '...' : '✅ Approve'}
                                  </button>
                                  <button onClick={() => handleWorldStatus(req.id, 'implemented')} disabled={isUpdating}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                    style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.4)', color: '#a78bfa' }}>
                                    {isUpdating ? '...' : '⚡ Mark Built'}
                                  </button>
                                  <button onClick={() => handleWorldStatus(req.id, 'declined')} disabled={isUpdating}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280' }}>
                                    {isUpdating ? '...' : '✗ Decline'}
                                  </button>
                                </div>
                              )}
                              {req.status === 'approved' && (
                                <div className="flex gap-2 mt-2">
                                  <button onClick={() => handleWorldStatus(req.id, 'implemented')} disabled={isUpdating}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                    style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.4)', color: '#a78bfa' }}>
                                    {isUpdating ? '...' : '⚡ Mark Built'}
                                  </button>
                                  <button onClick={() => handleWorldStatus(req.id, 'open')} disabled={isUpdating}
                                    className="px-3 py-1.5 rounded-lg text-xs transition-all"
                                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
                                    {isUpdating ? '...' : '↩ Undo'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Moderation ── */}
            {activeSection === 'moderation' && (
              <div className="flex flex-col gap-3">
                <div className="rounded-xl p-4 flex items-start gap-3"
                  style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div className="text-2xl">🐀</div>
                  <div>
                    <div className="text-white font-bold text-sm mb-1">DOME Brain Spam Enforcement</div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Flag any session that's clearly garbage uploaded just to farm XP.
                      Flagging hits the offender with <span className="text-red-400 font-bold">–250 XP</span> and the permanent <span className="text-red-400 font-bold">🐀 Coin Rat</span> badge.
                      Everyone on the Leaderboard can see it.
                    </p>
                  </div>
                </div>

                {workSummaries.length === 0 ? (
                  <div className="text-center py-10 text-gray-600 text-sm">No sessions logged yet</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {workSummaries.map(ws => {
                      const isFlagged = flaggedIds.includes(ws.id);
                      const isLoading = flagging === ws.id;
                      const memberId = resolveMemberId(ws.team_member);
                      const member = TEAM_MEMBERS.find(m => m.id === memberId);

                      return (
                        <div
                          key={ws.id}
                          className="p-4 rounded-xl transition-all"
                          style={{
                            background: isFlagged ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isFlagged ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.08)'}`,
                          }}
                        >
                          <div className="flex items-start gap-3">
                            {/* Avatar */}
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5"
                              style={{ background: member?.avatarColor || '#555' }}
                            >
                              {ws.team_member[0]}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-bold text-white text-sm">{ws.team_member}</span>
                                <span className="text-xs text-gray-500">·</span>
                                <span className="text-xs text-indigo-300">{ws.project_name}</span>
                                <span className="text-xs text-gray-500">·</span>
                                <span className="text-[11px] text-gray-600">{ws.session_date}</span>
                                {isFlagged && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                                    style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
                                    🐀 Flagged — –250 XP applied
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
                                {ws.summary}
                              </p>
                              {ws.tags && ws.tags.length > 0 && (
                                <div className="flex gap-1 flex-wrap mt-1.5">
                                  {ws.tags.slice(0, 5).map(t => (
                                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">{t}</span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Action */}
                            <div className="shrink-0 ml-2">
                              {!isFlagged ? (
                                <button
                                  onClick={() => handleFlagSession(ws)}
                                  disabled={isLoading || !memberId}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}
                                  title={!memberId ? `Can't match "${ws.team_member}" to a team member` : ''}
                                >
                                  {isLoading ? '...' : '🚩 Flag as Spam'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUnflagSession(ws)}
                                  disabled={isLoading}
                                  className="px-3 py-1.5 rounded-lg text-xs transition-all disabled:opacity-40"
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280' }}
                                >
                                  {isLoading ? '...' : '↩ Undo'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Settings ── */}
            {activeSection === 'settings' && (
              <div className="flex flex-col gap-5">
                {/* XP Happy Hour control */}
                <div className="rounded-2xl p-5 flex flex-col gap-4"
                  style={{
                    background: hhActive
                      ? 'linear-gradient(135deg, rgba(255,140,0,0.12), rgba(255,214,0,0.08))'
                      : 'rgba(255,165,0,0.05)',
                    border: `1px solid ${hhActive ? 'rgba(255,214,0,0.5)' : 'rgba(255,165,0,0.2)'}`,
                    boxShadow: hhActive ? '0 0 24px rgba(255,165,0,0.2)' : 'none',
                  }}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🔥</span>
                      <h3 className="text-white font-bold text-sm">XP Happy Hour</h3>
                      {hhActive && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse"
                          style={{ background: 'rgba(255,214,0,0.25)', color: '#fde047', border: '1px solid rgba(255,214,0,0.5)' }}>
                          ● ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Trigger a temporary XP multiplier across the whole team. Announced in World chat and shown as a glowing banner on the Leaderboard. Penalties (negative XP) are never multiplied.
                    </p>
                  </div>

                  {hhActive && happyHour?.endsAt && (() => {
                    const remainingMs = happyHour.endsAt - hhNow;
                    const mins = Math.floor(remainingMs / 60_000);
                    const secs = Math.floor((remainingMs % 60_000) / 1_000);
                    return (
                      <div className="flex items-center justify-between rounded-xl px-4 py-3"
                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,214,0,0.3)' }}>
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-yellow-500/80 font-bold">Time Remaining</div>
                          <div className="text-2xl font-black mt-0.5" style={{ color: '#fde047', fontVariantNumeric: 'tabular-nums' }}>
                            {mins}:{secs.toString().padStart(2, '0')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-widest text-yellow-500/80 font-bold">Multiplier</div>
                          <div className="text-2xl font-black mt-0.5 text-yellow-300">{happyHour.multiplier}×</div>
                        </div>
                      </div>
                    );
                  })()}

                  {!hhActive && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-yellow-500/80 font-bold block mb-1">Duration</label>
                        <select
                          value={hhDuration}
                          onChange={e => setHhDuration(Number(e.target.value))}
                          className="w-full rounded-xl px-3 py-2 text-sm text-white outline-none"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <option value={15}>15 minutes</option>
                          <option value={30}>30 minutes</option>
                          <option value={45}>45 minutes</option>
                          <option value={60}>60 minutes</option>
                          <option value={120}>2 hours</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-yellow-500/80 font-bold block mb-1">Multiplier</label>
                        <select
                          value={hhMultiplier}
                          onChange={e => setHhMultiplier(Number(e.target.value))}
                          className="w-full rounded-xl px-3 py-2 text-sm text-white outline-none"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <option value={2}>2× (Standard)</option>
                          <option value={3}>3× (Spicy)</option>
                          <option value={5}>5× (Insane)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    {hhActive ? (
                      <button
                        onClick={handleEndHappyHour}
                        disabled={hhWorking}
                        className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#9ca3af' }}>
                        {hhWorking ? '...' : 'End Happy Hour'}
                      </button>
                    ) : (
                      <button
                        onClick={handleStartHappyHour}
                        disabled={hhWorking}
                        className="px-5 py-2 rounded-xl text-sm font-black text-white transition-all hover:scale-105 disabled:opacity-40"
                        style={{
                          background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                          boxShadow: '0 0 18px rgba(245,158,11,0.4)',
                        }}>
                        {hhWorking ? 'Starting...' : `🔥 Start ${hhDuration}-min ${hhMultiplier}× XP`}
                      </button>
                    )}
                  </div>
                </div>

                {/* Prompt customization */}
                <div className="rounded-2xl p-5 flex flex-col gap-4"
                  style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🤖</span>
                      <h3 className="text-white font-bold text-sm">Nightly AI Prompt Notes</h3>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Add custom instructions for the nightly AI agent. These are injected into Step 3 when it generates new suggestions.
                      Use this to steer ideas toward specific priorities, themes, or constraints.
                    </p>
                  </div>

                  <div className="relative">
                    <textarea
                      className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none resize-none leading-relaxed"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: `1px solid ${promptHasChanges ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`,
                        minHeight: '160px',
                        fontFamily: 'inherit',
                      }}
                      placeholder={`Examples:\n• Focus on improving the Leaderboard tab this week\n• We're onboarding 3 new agents soon — prioritize first-time experience ideas\n• Avoid anything that requires a DB migration\n• The team is burned out on battles, skip battle-related suggestions for now`}
                      value={promptNotes}
                      onChange={e => setPromptNotes(e.target.value)}
                    />
                    {promptHasChanges && (
                      <div className="absolute top-2 right-2 text-[10px] text-indigo-400 font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(99,102,241,0.2)' }}>
                        unsaved
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-gray-600">
                      Takes effect at the next 2am run · {promptNotes.length} chars
                    </p>
                    <button
                      onClick={handleSavePrompt}
                      disabled={savingPrompt || !promptHasChanges}
                      className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
                      style={{
                        background: promptSaved
                          ? 'linear-gradient(135deg, #4ade80, #22c55e)'
                          : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        boxShadow: promptSaved ? '0 0 15px rgba(74,222,128,0.3)' : '0 0 15px rgba(99,102,241,0.3)',
                      }}>
                      {savingPrompt ? 'Saving...' : promptSaved ? '✓ Saved!' : 'Save Instructions'}
                    </button>
                  </div>

                  {savedPromptNotes && !promptHasChanges && (
                    <div className="rounded-xl p-3 text-xs text-gray-400"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span className="text-gray-600 font-semibold mr-1">Active:</span>
                      {savedPromptNotes}
                    </div>
                  )}
                </div>

                {/* Info cards */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: '🕐', title: 'Schedule', body: 'Runs every night at 2:00 AM automatically.' },
                    { icon: '🔖', title: 'Save for Later', body: 'Saved suggestions are skipped by the AI — they\'re yours to approve whenever.' },
                    { icon: '✅', title: 'Approve All', body: 'One click to queue every pending suggestion for tonight\'s implementation run.' },
                    { icon: '💡', title: 'Generating Ideas', body: 'AI reads team feedback + your prompt notes, then creates 5 fresh suggestions nightly.' },
                  ].map(c => (
                    <div key={c.title} className="p-4 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="text-xl mb-2">{c.icon}</div>
                      <div className="text-white text-xs font-bold mb-1">{c.title}</div>
                      <div className="text-gray-500 text-[11px] leading-relaxed">{c.body}</div>
                    </div>
                  ))}
                </div>
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

function SuggestionCard({ s, approving, savingForLater, onApprove, onDecline, onSaveForLater }: {
  s: DBSuggestion;
  approving: string | null;
  savingForLater: string | null;
  onApprove: (id: string) => void;
  onDecline: (id: string) => void;
  onSaveForLater: (id: string) => void;
}) {
  const pri = PRIORITY_STYLE[s.priority] || PRIORITY_STYLE.medium;
  const isApproved = s.status === 'approved' || s.status === 'in_progress';
  const isLoading = approving === s.id || savingForLater === s.id;

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
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => onApprove(s.id)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80' }}>
                {approving === s.id ? '...' : '✅ Approve'}
              </button>
              <button
                onClick={() => onSaveForLater(s.id)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}>
                {savingForLater === s.id ? '...' : '🔖 Save for Later'}
              </button>
              <button
                onClick={() => onDecline(s.id)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280' }}>
                {approving === s.id ? '...' : '✗ Skip'}
              </button>
            </div>
          )}
          {isApproved && (
            <button
              onClick={() => onDecline(s.id)}
              disabled={isLoading}
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

function SavedCard({ s, approving, onApprove, onDecline }: {
  s: DBSuggestion;
  approving: string | null;
  onApprove: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const pri = PRIORITY_STYLE[s.priority] || PRIORITY_STYLE.medium;
  const isLoading = approving === s.id;

  return (
    <div className="p-4 rounded-xl transition-all"
      style={{ background: 'rgba(234,179,8,0.04)', border: '1px solid rgba(234,179,8,0.15)' }}>
      <div className="flex items-start gap-3">
        <div className="text-2xl mt-0.5 shrink-0">{CATEGORY_EMOJI[s.category] || '💬'}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-white text-sm">{s.title}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ color: pri.color, background: pri.bg }}>
              {pri.label}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full text-yellow-600"
              style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)' }}>
              🔖 Saved
            </span>
          </div>
          {s.description && (
            <p className="text-xs text-gray-400 leading-relaxed mb-3">{s.description}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => onApprove(s.id)}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80' }}>
              {isLoading ? '...' : '✅ Approve Now'}
            </button>
            <button
              onClick={() => onDecline(s.id)}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280' }}>
              {isLoading ? '...' : '✗ Remove'}
            </button>
          </div>
        </div>
        <div className="text-[10px] text-gray-600 shrink-0 mt-1">
          {new Date(s.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

function RequestCard({ r, approving, onApprove, onUnapprove, onMarkDone, currentUserId }: {
  r: DBUpdateRequest & { approved_for_dev?: boolean };
  approving: string | null;
  onApprove: (id: string) => void;
  onUnapprove: (id: string) => void;
  onMarkDone: (id: string) => void;
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
          <div className="flex items-center gap-2 flex-wrap">
            {!isApproved && (
              <button
                onClick={() => onApprove(r.id)}
                disabled={!!isLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24' }}>
                {isLoading ? '...' : '⚡ Send to Dev'}
              </button>
            )}
            {isApproved && (
              <>
                <button
                  onClick={() => onMarkDone(r.id)}
                  disabled={!!isLoading}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80' }}>
                  {isLoading ? '...' : '✅ Mark as Done'}
                </button>
                <button
                  onClick={() => onUnapprove(r.id)}
                  disabled={!!isLoading}
                  className="px-2.5 py-1 rounded-lg text-[11px] transition-all"
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280' }}>
                  {isLoading ? '...' : '↩ Undo'}
                </button>
              </>
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
