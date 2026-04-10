import { useState } from 'react';

import { IDEAS, TEAM_MEMBERS } from '../data/gameData';
import { addXp } from '../lib/supabase';
import type { Idea } from '../types';

type SortMode = 'votes' | 'newest' | 'status';
type StatusFilter = 'all' | 'open' | 'in_progress' | 'completed';

const STATUS_CONFIG = {
  open: { label: 'Open', color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
  in_progress: { label: 'In Progress', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  completed: { label: 'Completed', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  declined: { label: 'Declined', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function IdeasBoard({ currentUserId }: { currentUserId: string }) {
  const [ideas, setIdeas] = useState<Idea[]>(IDEAS);
  const [sort, setSort] = useState<SortMode>('votes');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showNewIdea, setShowNewIdea] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTags, setNewTags] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = ideas.filter(i => statusFilter === 'all' || i.status === statusFilter);
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'votes') return b.upvotes.length - a.upvotes.length;
    if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sort === 'status') return a.status.localeCompare(b.status);
    return 0;
  });

  const handleVote = async (id: string) => {
    const idea = ideas.find(i => i.id === id);
    if (!idea) return;
    const hasVoted = idea.upvotes.includes(currentUserId);
    const newUpvotes = hasVoted
      ? idea.upvotes.filter(u => u !== currentUserId)
      : [...idea.upvotes, currentUserId];

    // Optimistic update
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, upvotes: newUpvotes } : i));

    if (!hasVoted) {
      // Award 5 XP to the voter
      addXp(currentUserId, 5, `Upvoted idea: "${idea.title}"`).catch(() => {});
      // Award 75 XP to the idea author when their idea hits 5 upvotes
      if (newUpvotes.length === 5 && idea.authorId !== currentUserId) {
        addXp(idea.authorId, 75, `Your idea "${idea.title}" reached 5 upvotes!`).catch(() => {});
      }
    }
  };

  const handleSubmit = () => {
    if (!newTitle.trim()) return;
    const newIdea: Idea = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      description: newDesc.trim(),
      authorId: currentUserId,
      upvotes: [currentUserId],
      createdAt: new Date().toISOString(),
      status: 'open',
      tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
    };
    setIdeas(prev => [newIdea, ...prev]);
    setNewTitle(''); setNewDesc(''); setNewTags('');
    setShowNewIdea(false);
  };

  const currentUser = TEAM_MEMBERS.find(m => m.id === currentUserId);

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white">💡 Ideas Board</h2>
          <p className="text-xs text-gray-400">Submit ideas, upvote what matters, ship what wins.</p>
          <p className="text-[10px] text-indigo-400 mt-0.5">⚡ +5 XP per upvote · +75 XP to authors whose idea hits 5 votes</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Status filter */}
          {(['all', 'open', 'in_progress', 'completed'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="text-xs px-3 py-1 rounded-lg font-medium transition-colors"
              style={statusFilter === s
                ? { background: 'rgba(99,102,241,0.4)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.6)' }
                : { background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}
            >{s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s}</button>
          ))}
          {/* Sort */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortMode)}
            className="text-xs px-2 py-1 rounded-lg bg-black/40 text-gray-300 border border-white/10 outline-none"
          >
            <option value="votes">Top Voted</option>
            <option value="newest">Newest</option>
            <option value="status">By Status</option>
          </select>
          <button
            onClick={() => setShowNewIdea(v => !v)}
            className="text-xs px-4 py-1.5 rounded-lg font-bold text-white transition-colors"
            style={{ background: currentUser?.avatarColor || '#6366f1', boxShadow: `0 0 12px ${currentUser?.avatarColor || '#6366f1'}55` }}
          >+ New Idea</button>
        </div>
      </div>

      {/* New idea form */}
      {showNewIdea && (
        <div
          className="rounded-xl p-4 flex flex-col gap-3"
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}
        >
          <div className="text-sm font-bold text-indigo-300">Submit a New Idea</div>
          <input
            className="w-full bg-black/40 rounded-lg px-3 py-2 text-sm text-white outline-none border border-white/10 focus:border-indigo-500"
            placeholder="Give your idea a punchy title..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
          />
          <textarea
            className="w-full bg-black/40 rounded-lg px-3 py-2 text-sm text-white outline-none border border-white/10 focus:border-indigo-500 resize-none"
            placeholder="What's the problem it solves? How does it work?"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            rows={3}
          />
          <input
            className="w-full bg-black/40 rounded-lg px-3 py-2 text-sm text-white outline-none border border-white/10 focus:border-indigo-500"
            placeholder="Tags (comma-separated): automation, slack, analytics..."
            value={newTags}
            onChange={e => setNewTags(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white"
              style={{ background: currentUser?.avatarColor || '#6366f1' }}
            >Submit Idea</button>
            <button
              onClick={() => setShowNewIdea(false)}
              className="px-4 py-2 rounded-lg text-sm text-gray-400 bg-white/5"
            >Cancel</button>
          </div>
        </div>
      )}

      {/* Ideas list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
        {sorted.map((idea, idx) => {
          const author = TEAM_MEMBERS.find(m => m.id === idea.authorId);
          const hasVoted = idea.upvotes.includes(currentUserId);
          const isExpanded = expandedId === idea.id;
          const statusCfg = STATUS_CONFIG[idea.status] || STATUS_CONFIG.open;
          const voteCount = idea.upvotes.length;
          const rank = idx + 1;

          return (
            <div
              key={idea.id}
              className="rounded-xl overflow-hidden transition-all cursor-pointer"
              style={{
                background: 'rgba(0,0,0,0.35)',
                border: hasVoted ? `1px solid ${currentUser?.avatarColor || '#6366f1'}55` : '1px solid rgba(255,255,255,0.07)',
              }}
              onClick={() => setExpandedId(isExpanded ? null : idea.id)}
            >
              <div className="flex items-start gap-3 p-3">
                {/* Rank + Vote */}
                <div className="flex flex-col items-center gap-1 shrink-0 w-12">
                  <div className="text-[11px] text-gray-600">#{rank}</div>
                  <button
                    onClick={e => { e.stopPropagation(); handleVote(idea.id); }}
                    className="flex flex-col items-center gap-0.5 w-full px-1 py-1.5 rounded-lg transition-all"
                    style={hasVoted
                      ? { background: `${currentUser?.avatarColor || '#6366f1'}33`, border: `1px solid ${currentUser?.avatarColor || '#6366f1'}66` }
                      : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <span className="text-sm">{hasVoted ? '▲' : '△'}</span>
                    <span className="text-sm font-bold" style={hasVoted ? { color: currentUser?.avatarColor || '#6366f1' } : { color: '#e2e8f0' }}>{voteCount}</span>
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-white text-sm leading-tight">{idea.title}</div>
                    <div
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
                      style={{ background: statusCfg.bg, color: statusCfg.color }}
                    >{statusCfg.label}</div>
                  </div>

                  {isExpanded && (
                    <p className="text-sm text-gray-300 mt-2 leading-relaxed">{idea.description}</p>
                  )}

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {/* Author */}
                    <div className="flex items-center gap-1">
                      <div
                        className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                        style={{ background: author?.avatarColor || '#666' }}
                      >{author?.name[0]}</div>
                      <span className="text-[11px] text-gray-500">{author?.name}</span>
                    </div>
                    <span className="text-[11px] text-gray-600">{timeAgo(idea.createdAt)}</span>
                    {idea.tags.map(t => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400">{t}</span>
                    ))}
                  </div>

                  {/* Voter avatars */}
                  {idea.upvotes.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <span className="text-[10px] text-gray-600">Voted by:</span>
                      <div className="flex -space-x-1">
                        {idea.upvotes.slice(0, 7).map(uid => {
                          const voter = TEAM_MEMBERS.find(m => m.id === uid);
                          return voter ? (
                            <div
                              key={uid}
                              title={voter.name}
                              className="w-4 h-4 rounded-full border border-black text-[8px] font-bold flex items-center justify-center text-white"
                              style={{ background: voter.avatarColor }}
                            >{voter.name[0]}</div>
                          ) : null;
                        })}
                        {idea.upvotes.length > 7 && (
                          <div className="w-4 h-4 rounded-full border border-black bg-gray-700 text-[8px] flex items-center justify-center text-gray-300">+{idea.upvotes.length - 7}</div>
                        )}
                      </div>
                    </div>
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
