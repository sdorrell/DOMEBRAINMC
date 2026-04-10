import { useState, useEffect } from 'react';
import { TEAM_MEMBERS } from '../data/gameData';
import {
  fetchUpdateRequests, createUpdateRequest, toggleRequestUpvote,
  subscribeToUpdateRequests, type DBUpdateRequest,
} from '../lib/supabase';

const CATEGORY_CONFIG = {
  feature: { label: 'Feature', emoji: '✨', color: '#6366f1' },
  bug: { label: 'Bug', emoji: '🐛', color: '#ef4444' },
  improvement: { label: 'Improvement', emoji: '⚡', color: '#f59e0b' },
  other: { label: 'Other', emoji: '💬', color: '#6b7280' },
};

const STATUS_CONFIG = {
  open: { label: 'Open', color: '#22c55e' },
  in_progress: { label: 'In Progress', color: '#f59e0b' },
  done: { label: 'Done', color: '#6366f1' },
  declined: { label: 'Declined', color: '#6b7280' },
};

interface Props {
  currentUserId: string;
}

export default function UpdateRequests({ currentUserId }: Props) {
  const [requests, setRequests] = useState<DBUpdateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DBUpdateRequest['category']>('feature');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUpdateRequests().then(data => { setRequests(data); setLoading(false); });

    const sub = subscribeToUpdateRequests(updated => {
      setRequests(prev => {
        const idx = prev.findIndex(r => r.id === updated.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [updated, ...prev];
      });
    });
    return () => { sub.unsubscribe(); };
  }, []);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    await createUpdateRequest({
      author_id: currentUserId,
      title: title.trim(),
      description: description.trim() || null,
      category,
      status: 'open',
      upvotes: [],
    });
    setTitle('');
    setDescription('');
    setCategory('feature');
    setShowForm(false);
    setSubmitting(false);
    const fresh = await fetchUpdateRequests();
    setRequests(fresh);
  };

  const handleUpvote = async (req: DBUpdateRequest) => {
    const next = await toggleRequestUpvote(req.id, currentUserId, req.upvotes);
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, upvotes: next } : r));
  };

  const filtered = requests.filter(r => {
    if (filter === 'open') return r.status === 'open' || r.status === 'in_progress';
    if (filter === 'done') return r.status === 'done' || r.status === 'declined';
    return true;
  });

  const me = TEAM_MEMBERS.find(m => m.id === currentUserId);

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-black text-white">Mission Control Requests</h2>
          <p className="text-gray-500 text-sm mt-0.5">Submit feedback, bugs, and feature ideas for DOMEBRAINMC</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
          style={{ background: showForm ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: showForm ? 'none' : '0 0 20px rgba(99,102,241,0.4)' }}>
          {showForm ? 'Cancel' : '+ Submit Request'}
        </button>
      </div>

      {/* Submit form */}
      {showForm && (
        <div className="shrink-0 rounded-2xl p-5 flex flex-col gap-4"
          style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-black shrink-0"
              style={{ background: me?.avatarColor, boxShadow: `0 0 10px ${me?.avatarColor}66` }}>
              {me?.name[0]}
            </div>
            <div className="text-sm text-gray-400">Submitting as <span className="text-white font-semibold">{me?.name}</span></div>
          </div>

          <input
            className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
            placeholder="What do you want? (required)"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />

          <textarea
            className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none resize-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
            placeholder="More details... (optional)"
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />

          {/* Category row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs text-gray-500 font-medium shrink-0">Category:</div>
            {(Object.keys(CATEGORY_CONFIG) as DBUpdateRequest['category'][]).map(cat => {
              const cfg = CATEGORY_CONFIG[cat];
              const active = category === cat;
              return (
                <button key={cat} onClick={() => setCategory(cat)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: active ? `${cfg.color}22` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${active ? cfg.color + '66' : 'rgba(255,255,255,0.08)'}`,
                    color: active ? cfg.color : '#6b7280',
                  }}>
                  {cfg.emoji} {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Submit button — own row so it's always reachable on mobile */}
          <button onClick={handleSubmit} disabled={!title.trim() || submitting}
            className="w-full px-5 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 20px rgba(99,102,241,0.35)' }}>
            {submitting ? 'Submitting...' : '✓ Submit Request'}
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 shrink-0">
        {(['all', 'open', 'done'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
            style={filter === f
              ? { background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.4)', color: '#e0e7ff' }
              : { background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
            {f} {f === 'all' ? `(${requests.length})` : f === 'open' ? `(${requests.filter(r => r.status === 'open' || r.status === 'in_progress').length})` : `(${requests.filter(r => r.status === 'done' || r.status === 'declined').length})`}
          </button>
        ))}
      </div>

      {/* Request list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
        {loading && (
          <div className="text-center text-gray-500 py-12 text-sm animate-pulse">Loading requests...</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📬</div>
            <div className="text-gray-500 text-sm">No requests yet. Be the first to submit one!</div>
          </div>
        )}

        {filtered.map(req => {
          const author = TEAM_MEMBERS.find(m => m.id === req.author_id);
          const catCfg = CATEGORY_CONFIG[req.category];
          const statusCfg = STATUS_CONFIG[req.status];
          const hasUpvoted = req.upvotes.includes(currentUserId);
          const isOwn = req.author_id === currentUserId;

          return (
            <div key={req.id} className="rounded-2xl p-4 flex gap-4 transition-all"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>

              {/* Upvote */}
              <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                <button onClick={() => !isOwn && handleUpvote(req)}
                  disabled={isOwn}
                  className="w-9 h-9 rounded-xl flex flex-col items-center justify-center transition-all text-xs font-black"
                  style={{
                    background: hasUpvoted ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${hasUpvoted ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    color: hasUpvoted ? '#a5b4fc' : '#6b7280',
                    cursor: isOwn ? 'default' : 'pointer',
                  }}>
                  ▲
                </button>
                <span className="text-xs font-bold text-gray-400">{req.upvotes.length}</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap mb-1">
                  <span className="text-white font-semibold text-sm">{req.title}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: `${catCfg.color}22`, color: catCfg.color, border: `1px solid ${catCfg.color}44` }}>
                    {catCfg.emoji} {catCfg.label}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: `${statusCfg.color}22`, color: statusCfg.color, border: `1px solid ${statusCfg.color}44` }}>
                    {statusCfg.label}
                  </span>
                </div>

                {req.description && (
                  <p className="text-gray-400 text-xs leading-relaxed mb-2">{req.description}</p>
                )}

                <div className="flex items-center gap-2 text-[10px] text-gray-600">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-black"
                    style={{ background: author?.avatarColor || '#555' }}>{author?.name[0] || '?'}</div>
                  <span>{author?.name || req.author_id}</span>
                  <span>·</span>
                  <span>{new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  {req.upvotes.length > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-indigo-400">{req.upvotes.length} upvote{req.upvotes.length !== 1 ? 's' : ''}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
