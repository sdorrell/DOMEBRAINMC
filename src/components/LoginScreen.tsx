import { useState } from 'react';
import { TEAM_MEMBERS, getLevelTier } from '../data/gameData';
import type { TeamMember } from '../types';

interface LoginScreenProps {
  onLogin: (memberId: string) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (member: TeamMember) => {
    setSelectedId(member.id);
    // brief delay for animation
    setTimeout(() => onLogin(member.id), 500);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #080814 0%, #0d1117 50%, #080814 100%)',
        color: '#e2e8f0',
      }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-3xl mb-4"
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            boxShadow: '0 0 40px rgba(99,102,241,0.5)',
          }}
        >
          D
        </div>
        <div className="text-3xl font-black tracking-tight text-white">DOME</div>
        <div className="text-sm text-indigo-400 tracking-widest uppercase font-medium mt-1">Mission Control</div>
        <div className="text-gray-500 text-sm mt-3">Who are you today?</div>
      </div>

      {/* Team grid */}
      <div className="grid grid-cols-3 gap-4 max-w-xl w-full px-6 sm:grid-cols-4">
        {TEAM_MEMBERS.map(member => {
          const tier = getLevelTier(member.level);
          const isHovered = hoverId === member.id;
          const isSelected = selectedId === member.id;

          return (
            <button
              key={member.id}
              onClick={() => handleSelect(member)}
              onMouseEnter={() => setHoverId(member.id)}
              onMouseLeave={() => setHoverId(null)}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-200"
              style={{
                background: isSelected
                  ? 'rgba(99,102,241,0.3)'
                  : isHovered
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(255,255,255,0.03)',
                border: isSelected
                  ? '2px solid rgba(99,102,241,0.8)'
                  : isHovered
                    ? `2px solid ${member.avatarColor}66`
                    : '2px solid rgba(255,255,255,0.06)',
                transform: isSelected ? 'scale(1.06)' : isHovered ? 'scale(1.03)' : 'scale(1)',
                boxShadow: isSelected
                  ? `0 0 24px ${member.avatarColor}55`
                  : isHovered
                    ? `0 0 16px ${member.avatarColor}33`
                    : 'none',
              }}
            >
              {/* Avatar circle */}
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-black relative"
                style={{
                  background: `radial-gradient(circle at 35% 35%, ${member.avatarAccent}, ${member.avatarColor})`,
                  boxShadow: `0 0 18px ${member.avatarColor}88`,
                }}
              >
                {member.name[0]}
                {/* Level badge */}
                <div
                  className="absolute -bottom-1 -right-1 text-[10px] font-black px-1.5 py-0.5 rounded-full"
                  style={{
                    background: tier.color,
                    color: '#000',
                    boxShadow: `0 0 8px ${tier.color}88`,
                  }}
                >
                  {member.level}
                </div>
              </div>

              <div className="text-center">
                <div className="font-bold text-sm text-white">{member.name}</div>
                <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{member.role}</div>
              </div>

              {/* XP bar */}
              <div className="w-full h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.round((member.xp / member.xpToNext) * 100)}%`,
                    background: `linear-gradient(90deg, ${member.avatarColor}, ${member.avatarAccent})`,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Hint */}
      <div className="mt-8 text-gray-600 text-xs">
        Click your avatar to enter
      </div>
    </div>
  );
}
