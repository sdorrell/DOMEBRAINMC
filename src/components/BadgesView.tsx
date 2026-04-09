import { useState } from 'react';

import { BADGES, TEAM_MEMBERS, getLevelTier, getXpForLevel } from '../data/gameData';
import type { Badge, TeamMember } from '../types';

const RARITY_CONFIG = {
  common: { label: 'Common', color: '#9ca3af', glow: 'rgba(156,163,175,0.3)' },
  rare: { label: 'Rare', color: '#3b82f6', glow: 'rgba(59,130,246,0.4)' },
  epic: { label: 'Epic', color: '#8b5cf6', glow: 'rgba(139,92,246,0.45)' },
  legendary: { label: 'Legendary', color: '#f59e0b', glow: 'rgba(245,158,11,0.5)' },
};

const CATEGORY_LABELS: Record<string, string> = {
  brain: '🧠 Brain',
  social: '🤝 Social',
  grind: '⚡ Grind',
  legend: '🌟 Legend',
  negative: '💀 The Shame Shelf',
};

function BadgeCard({ badge, holders, negative }: { badge: Badge; holders: TeamMember[]; negative?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const rarity = RARITY_CONFIG[badge.rarity];

  return (
    <div
      className="relative rounded-xl p-3 transition-all cursor-default flex flex-col gap-2"
      style={{
        background: negative ? 'rgba(239,68,68,0.08)' : 'rgba(0,0,0,0.4)',
        border: hovered
          ? `1px solid ${negative ? '#ef4444' : rarity.color}88`
          : `1px solid ${negative ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: hovered ? `0 0 16px ${negative ? 'rgba(239,68,68,0.25)' : rarity.glow}` : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Rarity indicator */}
      <div
        className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full font-bold"
        style={{ background: `${negative ? '#ef4444' : rarity.color}22`, color: negative ? '#ef4444' : rarity.color }}
      >
        {negative ? '⏳ Temp' : rarity.label}
      </div>

      {/* Badge emoji */}
      <div
        className="text-3xl text-center py-1"
        style={{ filter: `drop-shadow(0 0 6px ${negative ? '#ef444488' : rarity.glow})` }}
      >
        {badge.emoji}
      </div>

      {/* Badge name */}
      <div
        className="text-sm font-bold text-center leading-tight"
        style={{ color: negative ? '#fca5a5' : rarity.color }}
      >
        {badge.name}
      </div>

      {/* Descriptor */}
      <div className="text-[11px] text-gray-400 text-center leading-relaxed">
        {badge.descriptor}
      </div>

      {/* Requirement */}
      <div
        className="text-[10px] text-center px-2 py-1 rounded-lg"
        style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280' }}
      >
        {badge.requirement}
      </div>

      {/* Holders */}
      {holders.length > 0 && (
        <div className="flex flex-col gap-1 mt-1 pt-2 border-t border-white/5">
          <div className="text-[10px] text-gray-600">Holders ({holders.length})</div>
          <div className="flex flex-wrap gap-1">
            {holders.map(h => (
              <div
                key={h.id}
                title={h.name}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ background: h.avatarColor }}
              >
                {h.name[0]}
              </div>
            ))}
          </div>
        </div>
      )}
      {holders.length === 0 && (
        <div className="text-[10px] text-gray-700 text-center italic">No holders yet</div>
      )}
    </div>
  );
}

export default function BadgesView() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', 'brain', 'social', 'grind', 'legend', 'negative'];

  const filtered = selectedCategory === 'all'
    ? BADGES
    : BADGES.filter(b => b.category === selectedCategory);

  // Count holder stats
  const badgeStats = BADGES.map(badge => {
    const holders = TEAM_MEMBERS.filter(m =>
      [...m.badges, ...m.activeBadges].includes(badge.id)
    );
    return { badge, holders };
  });

  const totalBadgesEarned = TEAM_MEMBERS.reduce((sum, m) => sum + m.badges.length + m.activeBadges.length, 0);
  const rarest = [...badgeStats].filter(s => s.holders.length > 0).sort((a, b) => a.holders.length - b.holders.length)[0];

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-2xl">🎖️</div>
          <div className="text-xl font-bold text-white mt-1">{BADGES.length}</div>
          <div className="text-xs text-gray-400">Total Badges</div>
          <div className="text-[11px] text-gray-600">20 permanent · 5 temporary</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-2xl">✨</div>
          <div className="text-xl font-bold text-yellow-400 mt-1">{totalBadgesEarned}</div>
          <div className="text-xs text-gray-400">Badges Earned</div>
          <div className="text-[11px] text-gray-600">Across the whole team</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-2xl">{rarest?.badge.emoji || '🔒'}</div>
          <div className="text-sm font-bold text-purple-400 mt-1">{rarest?.badge.name || 'None yet'}</div>
          <div className="text-xs text-gray-400">Rarest Badge</div>
          <div className="text-[11px] text-gray-600">{rarest?.holders.length || 0} holder{rarest?.holders.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
            style={selectedCategory === cat
              ? { background: 'rgba(99,102,241,0.35)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.5)' }
              : { background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {cat === 'all' ? '🎖️ All Badges' : CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {/* Badge grid */}
      <div className="flex-1 overflow-y-auto">
        {selectedCategory === 'all' ? (
          // Grouped by category
          Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
            const catBadges = BADGES.filter(b => b.category === cat);
            return (
              <div key={cat} className="mb-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <span>{label}</span>
                  {cat === 'negative' && <span className="text-[10px] text-red-400 normal-case font-normal">(temporary — clears automatically)</span>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {catBadges.map(badge => {
                    const holders = TEAM_MEMBERS.filter(m => [...m.badges, ...m.activeBadges].includes(badge.id));
                    return <BadgeCard key={badge.id} badge={badge} holders={holders} negative={cat === 'negative'} />;
                  })}
                </div>
              </div>
            );
          })
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {filtered.map(badge => {
              const holders = TEAM_MEMBERS.filter(m => [...m.badges, ...m.activeBadges].includes(badge.id));
              return <BadgeCard key={badge.id} badge={badge} holders={holders} negative={badge.category === 'negative'} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
