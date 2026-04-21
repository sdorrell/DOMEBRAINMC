import { useState } from 'react';

// ─── Agent Onboarding Welcome Tour ────────────────────────────────────────────
// A dismissible, one-time guided tour that walks new team members through the
// main tabs of DOME Mission Control. Runs once per user (localStorage flag) and
// can be manually re-triggered later from the user menu if needed.
//
// Inspired by the high-upvote community idea for an "agent concierge" that
// greets new agents and shows them around.

const TOUR_STORAGE_KEY = 'dome_welcome_tour_seen_v1';

export interface TourStep {
  emoji: string;
  title: string;
  body: string;
  tabHint: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    emoji: '🗺️',
    title: 'The World Map',
    body:
      "This is your home base — an isometric map of the DOME universe. Move your avatar around with WASD or arrow keys. " +
      "Walk into zones like the Grind Zone, Idea Lab, or Green Couch to unlock actions and earn XP.",
    tabHint: 'World',
  },
  {
    emoji: '🏆',
    title: 'The Leaderboard',
    body:
      "See where you stack up. The Leaderboard tracks XP, levels, and badges across the whole team. " +
      "Click any row to view that teammate's full XP event history — every action they've taken to climb.",
    tabHint: 'Leaderboard',
  },
  {
    emoji: '⚔️',
    title: 'Battles',
    body:
      "Challenge a teammate to a head-to-head trivia duel. Winner steals coins from the loser. " +
      "Keep an eye on your Battles tab for incoming challenges — if you see one, don't be a coward 🐔.",
    tabHint: 'Battles',
  },
  {
    emoji: '💡',
    title: 'The Ideas Board',
    body:
      "Got a thought for improving DOME? Drop it here. Upvote the ideas you love. " +
      "The most-upvoted ideas get pulled into the nightly improvement cycle and shipped automatically. " +
      "You're part of how this app evolves.",
    tabHint: 'Ideas',
  },
];

export function shouldShowWelcomeTour(): boolean {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) !== '1';
  } catch {
    return false;
  }
}

export function markWelcomeTourSeen(): void {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function resetWelcomeTour(): void {
  try {
    localStorage.removeItem(TOUR_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

interface WelcomeTourProps {
  memberName: string;
  onDismiss: () => void;
}

export default function WelcomeTour({ memberName, onDismiss }: WelcomeTourProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const step = TOUR_STEPS[stepIdx];
  const isLast = stepIdx === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      markWelcomeTourSeen();
      onDismiss();
    } else {
      setStepIdx(i => i + 1);
    }
  };

  const handleSkip = () => {
    markWelcomeTourSeen();
    onDismiss();
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)' }}
      onClick={e => {
        if (e.target === e.currentTarget) handleSkip();
      }}
    >
      <div
        className="relative flex flex-col gap-5 p-7 rounded-2xl max-w-md w-full"
        style={{
          background: 'linear-gradient(135deg, #0d1117 0%, #1a0a2e 100%)',
          border: '2px solid rgba(99,102,241,0.55)',
          boxShadow:
            '0 0 60px rgba(99,102,241,0.35), 0 0 120px rgba(139,92,246,0.12), inset 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-400/80">
            Welcome to DOME, {memberName}
          </div>
          <button
            onClick={handleSkip}
            className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            Skip tour
          </button>
        </div>

        {/* Step emoji + title */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="text-6xl" style={{ filter: 'drop-shadow(0 0 16px rgba(139,92,246,0.45))' }}>
            {step.emoji}
          </div>
          <div className="text-white font-black text-2xl leading-tight">{step.title}</div>
          <div className="text-gray-400 text-sm leading-relaxed">{step.body}</div>
        </div>

        {/* Tab hint */}
        <div
          className="self-center flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{
            background: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.35)',
          }}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
            Tab
          </span>
          <span className="text-xs font-bold text-white">{step.tabHint}</span>
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className="transition-all rounded-full"
              style={{
                width: i === stepIdx ? '20px' : '6px',
                height: '6px',
                background:
                  i === stepIdx
                    ? 'linear-gradient(90deg, #6366f1, #8b5cf6)'
                    : i < stepIdx
                    ? 'rgba(99,102,241,0.5)'
                    : 'rgba(255,255,255,0.12)',
              }}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          {stepIdx > 0 && (
            <button
              onClick={() => setStepIdx(i => Math.max(0, i - 1))}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#9ca3af',
              }}
            >
              ← Back
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              boxShadow: '0 0 20px rgba(99,102,241,0.5)',
              color: 'white',
              border: 'none',
            }}
          >
            {isLast ? "Let's Go! 🚀" : `Next (${stepIdx + 1}/${TOUR_STEPS.length}) →`}
          </button>
        </div>
      </div>
    </div>
  );
}
