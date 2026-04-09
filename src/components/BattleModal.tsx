import { useState, useEffect, useRef, useCallback } from 'react';
import { getBattleActions, getBattleMaxHP, ULTIMATES } from '../data/gameData';
import { getLevelTier } from '../data/gameData';
import type { TeamMember, BattleAction, BattleState, FloatingText } from '../types';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function roll(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isCrit(chance = 0.12) {
  return Math.random() < chance;
}

// Snarky battle log lines
const HIT_LINES: Record<string, string[]> = {
  strike: [
    '{a} slaps {d} with a spreadsheet. {dmg} damage.',
    '{a} lands a clean hit on {d}. {dmg} damage.',
    '{a} clocks {d} right in the inbox. {dmg} damage.',
  ],
  power: [
    '{a} DESTROYS {d}\'s inbox. {dmg} damage!',
    '{a} sends a 47-slide deck at {d}. {dmg} damage!',
    '{a} calls a surprise all-hands on {d}. {dmg} damage!',
  ],
  shield: [
    '{a} puts up a roadblock. Bracing for impact.',
    '{a} schedules a "blocker" meeting with reality.',
    '{a} hides behind their OKRs. Shielded.',
  ],
  potion: [
    '{a} chugs an energy drink. {heal} HP restored.',
    '{a} finds a budget line item for HP. {heal} restored.',
    '{a} submits a wellness expense. {heal} HP back.',
  ],
  ult: [
    '🌟 {a} unleashes their ULTIMATE! {dmg} damage!!',
    '💥 {a} goes full send! {dmg} MASSIVE damage!!',
    '⚡ {a}\'s ultimate hits DIFFERENT. {dmg} damage!!!',
  ],
  crit: [
    '💫 CRITICAL HIT! {a} activates big brain mode. {dmg} damage!!',
    '🎯 CRITICAL! {a} found the glitch. {dmg} damage!!',
    '🔥 CRITICAL STRIKE! Somewhere, a PM cried. {dmg} damage!!',
  ],
  shield_block: [
    '{d}\'s shield absorbs most of it! Only {dmg} gets through.',
    '{d} had a process for this. Blocked to {dmg}.',
  ],
  steal: [
    '{a} steals {coins} coins from {d}! Crime.',
    '{a} invoices {d} for emotional damages. {coins} coins.',
  ],
  heal_dmg: [
    '{a} multitasks: heals {heal} HP AND hits {d} for {dmg}!',
  ],
};

function getLine(key: string, vars: Record<string, string | number>): string {
  const lines = HIT_LINES[key] || ['{a} does something. {dmg} damage.'];
  let line = lines[Math.floor(Math.random() * lines.length)];
  for (const [k, v] of Object.entries(vars)) {
    line = line.replaceAll(`{${k}}`, String(v));
  }
  return line;
}

// ─── AI LOGIC ─────────────────────────────────────────────────────────────────

function aiChooseAction(state: BattleState, enemy: TeamMember): BattleAction {
  const actions = getBattleActions(enemy.role);
  const { enemyHP, enemyMaxHP, enemyCoins, playerLastAction, enemyShieldTurns } = state;
  const hpPct = enemyHP / enemyMaxHP;

  // Heal if low HP and can afford
  if (hpPct < 0.35 && enemyCoins >= 30) {
    const potion = actions.find(a => a.id === 'potion');
    if (potion) return potion;
  }

  // Shield if player used power attack last turn and not already shielded
  if (playerLastAction === 'power' && enemyShieldTurns === 0 && Math.random() > 0.3) {
    const shield = actions.find(a => a.id === 'shield');
    if (shield) return shield;
  }

  // Use ultimate if we can afford and player is vulnerable
  const ult = actions.find(a => a.id === 'ult');
  if (ult && enemyCoins >= ult.cost && hpPct > 0.5 && Math.random() > 0.55) {
    return ult;
  }

  // Power attack sometimes
  const power = actions.find(a => a.id === 'power');
  if (power && enemyCoins >= power.cost && Math.random() > 0.45) {
    return power;
  }

  // Default: basic strike
  return actions.find(a => a.id === 'strike')!;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

interface Props {
  player: TeamMember;
  enemy: TeamMember;
  onComplete: (won: boolean, coinsWon: number) => void;
  onClose: () => void;
}

let floatId = 0;

export default function BattleModal({ player, enemy, onComplete, onClose }: Props) {
  const playerMaxHP = getBattleMaxHP(player.level);
  const enemyMaxHP = getBattleMaxHP(enemy.level);

  const [state, setState] = useState<BattleState>({
    phase: 'challenge',
    playerHP: playerMaxHP,
    enemyHP: enemyMaxHP,
    playerMaxHP,
    enemyMaxHP,
    playerCoins: player.coins,
    enemyCoins: enemy.coins,
    playerShieldTurns: 0,
    enemyShieldTurns: 0,
    turn: 1,
    log: [`⚔️ ${player.name} challenged ${enemy.name} to battle! Prepare yourself.`],
    floatingTexts: [],
    playerAttacking: false,
    enemyAttacking: false,
    playerHurt: false,
    enemyHurt: false,
  });

  const actions = getBattleActions(player.role);
  const playerTier = getLevelTier(player.level);
  const enemyTier = getLevelTier(enemy.level);

  // Add a floating text
  const addFloat = useCallback((text: string, color: string, side: 'left' | 'right') => {
    const ft: FloatingText = { id: ++floatId, text, color, side };
    setState(s => ({ ...s, floatingTexts: [...s.floatingTexts, ft] }));
    setTimeout(() => setState(s => ({ ...s, floatingTexts: s.floatingTexts.filter(f => f.id !== ft.id) })), 1600);
  }, []);

  // Execute a battle action
  const executeAction = useCallback(async (action: BattleAction, isPlayer: boolean) => {
    setState(s => ({
      ...s,
      phase: 'animating',
      playerAttacking: isPlayer,
      enemyAttacking: !isPlayer,
    }));

    await new Promise(r => setTimeout(r, 280));

    setState(prevS => {
      let s = { ...prevS };
      const attName = isPlayer ? player.name : enemy.name;
      const defName = isPlayer ? enemy.name : player.name;
      let logLine = '';

      // Resolve damage
      let rawDmg = action.damageMin > 0 ? roll(action.damageMin, action.damageMax) : 0;
      const wasCrit = action.critChance ? isCrit(action.critChance) : isCrit(0.10);

      if (wasCrit && rawDmg > 0) {
        rawDmg = Math.round(rawDmg * 1.7);
        addFloat(`CRIT! −${rawDmg}`, '#ffd600', isPlayer ? 'right' : 'left');
        logLine = getLine('crit', { a: attName, d: defName, dmg: rawDmg });
      }

      // Shield reduction
      const defShield = isPlayer ? s.enemyShieldTurns : s.playerShieldTurns;
      let finalDmg = rawDmg;
      if (defShield > 0 && rawDmg > 0) {
        finalDmg = Math.round(rawDmg * 0.35);
        if (!wasCrit) logLine = getLine('shield_block', { a: attName, d: defName, dmg: finalDmg });
      } else if (rawDmg > 0 && !wasCrit) {
        logLine = getLine(action.id === 'ult' ? 'ult' : action.id, { a: attName, d: defName, dmg: finalDmg });
      }

      // Apply damage
      if (finalDmg > 0) {
        if (isPlayer) {
          s.enemyHP = Math.max(0, s.enemyHP - finalDmg);
          if (!wasCrit) addFloat(`−${finalDmg}`, '#ff5252', 'right');
          s.enemyHurt = true;
        } else {
          s.playerHP = Math.max(0, s.playerHP - finalDmg);
          if (!wasCrit) addFloat(`−${finalDmg}`, '#ff5252', 'left');
          s.playerHurt = true;
        }
      }

      // Shield
      if (action.shieldTurns) {
        if (isPlayer) s.playerShieldTurns = action.shieldTurns + 1;
        else s.enemyShieldTurns = action.shieldTurns + 1;
        logLine = getLine('shield', { a: attName });
      }

      // Heal
      if (action.healAmount && action.healAmount > 0) {
        const heal = action.healAmount;
        if (isPlayer) {
          s.playerHP = Math.min(s.playerMaxHP, s.playerHP + heal);
          addFloat(`+${heal} HP`, '#69f0ae', 'left');
        } else {
          s.enemyHP = Math.min(s.enemyMaxHP, s.enemyHP + heal);
          addFloat(`+${heal} HP`, '#69f0ae', 'right');
        }
        if (finalDmg > 0) {
          logLine = getLine('heal_dmg', { a: attName, d: defName, heal, dmg: finalDmg });
        } else {
          logLine = getLine('potion', { a: attName, heal });
        }
      }

      // Steal coins
      if (action.stealCoins && action.stealCoins > 0) {
        const stolen = Math.min(action.stealCoins, isPlayer ? s.enemyCoins : s.playerCoins);
        if (isPlayer) { s.playerCoins += stolen; s.enemyCoins -= stolen; }
        else { s.enemyCoins += stolen; s.playerCoins -= stolen; }
        addFloat(`+${stolen}💰`, '#ffd600', isPlayer ? 'left' : 'right');
        logLine = getLine('steal', { a: attName, d: defName, coins: stolen });
      }

      // Deduct action cost
      if (isPlayer) {
        s.playerCoins = Math.max(0, s.playerCoins - action.cost);
        s.playerLastAction = action.id;
      } else {
        s.enemyCoins = Math.max(0, s.enemyCoins - action.cost);
        s.enemyLastAction = action.id;
      }

      // Tick shields
      if (isPlayer) {
        if (s.enemyShieldTurns > 0) s.enemyShieldTurns--;
      } else {
        if (s.playerShieldTurns > 0) s.playerShieldTurns--;
      }

      s.log = [...s.log, logLine].slice(-20);
      s.playerAttacking = false;
      s.enemyAttacking = false;

      // Check win conditions
      if (s.playerHP <= 0) {
        s.phase = 'defeat';
        return s;
      }
      if (s.enemyHP <= 0) {
        s.phase = 'victory';
        return s;
      }

      // Next phase
      s.phase = isPlayer ? 'ai_turn' : 'player_turn';
      s.turn = isPlayer ? s.turn : s.turn + 1;
      return s;
    });

    // Clear hurt after animation
    setTimeout(() => setState(s => ({ ...s, playerHurt: false, enemyHurt: false })), 350);
  }, [player, enemy, addFloat]);

  // AI turn
  useEffect(() => {
    if (state.phase !== 'ai_turn') return;
    const timer = setTimeout(async () => {
      const action = aiChooseAction(state, enemy);
      await executeAction(action, false);
    }, 900);
    return () => clearTimeout(timer);
  }, [state.phase]); // eslint-disable-line

  // When victory/defeat triggers, call onComplete
  useEffect(() => {
    if (state.phase === 'victory') {
      const coinsWon = Math.floor(state.enemyCoins * 0.2);
      setTimeout(() => onComplete(true, coinsWon), 2200);
    }
    if (state.phase === 'defeat') {
      setTimeout(() => onComplete(false, 0), 2200);
    }
  }, [state.phase]); // eslint-disable-line

  const handlePlayerAction = (action: BattleAction) => {
    if (state.phase !== 'player_turn') return;
    if (state.playerCoins < action.cost) return;
    executeAction(action, true);
  };

  const hpPct = (hp: number, max: number) => Math.max(0, (hp / max) * 100);
  const hpColor = (pct: number) => pct > 55 ? '#69f0ae' : pct > 25 ? '#ffcc02' : '#ff5252';

  // ── CHALLENGE SCREEN ──────────────────────────────────────────────────────
  if (state.phase === 'challenge') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}>
        <div className="flex flex-col items-center gap-8 text-center px-8">
          {/* VS */}
          <div className="text-6xl font-black tracking-tight" style={{ textShadow: '0 0 40px rgba(255,80,80,0.8)', color: '#fff', fontFamily: 'monospace' }}>
            ⚔️ BATTLE ⚔️
          </div>
          <div className="flex items-center gap-12">
            {/* Player card */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-black text-white" style={{ background: `linear-gradient(135deg, ${player.avatarColor}, ${player.avatarAccent})`, boxShadow: `0 0 30px ${player.avatarColor}88` }}>
                {player.name[0]}
              </div>
              <div className="font-black text-white text-xl">{player.name}</div>
              <div className="text-sm" style={{ color: playerTier.color }}>{player.role}</div>
              <div className="text-sm text-gray-400">Lv{player.level} · {player.coins}💰</div>
              <div className="text-xs px-3 py-1 rounded-full" style={{ background: `${player.avatarColor}22`, color: player.avatarAccent }}>
                {player.battleWins}W / {player.battleLosses}L
              </div>
            </div>

            <div className="text-5xl font-black text-red-500" style={{ textShadow: '0 0 20px #ff5252' }}>VS</div>

            {/* Enemy card */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-black text-white" style={{ background: `linear-gradient(135deg, ${enemy.avatarColor}, ${enemy.avatarAccent})`, boxShadow: `0 0 30px ${enemy.avatarColor}88` }}>
                {enemy.name[0]}
              </div>
              <div className="font-black text-white text-xl">{enemy.name}</div>
              <div className="text-sm" style={{ color: enemyTier.color }}>{enemy.role}</div>
              <div className="text-sm text-gray-400">Lv{enemy.level} · {enemy.coins}💰</div>
              <div className="text-xs px-3 py-1 rounded-full" style={{ background: `${enemy.avatarColor}22`, color: enemy.avatarAccent }}>
                {enemy.battleWins}W / {enemy.battleLosses}L
              </div>
            </div>
          </div>

          {/* HP preview */}
          <div className="text-sm text-gray-400">
            Your HP: <span className="text-green-400 font-bold">{playerMaxHP}</span> &nbsp;·&nbsp;
            Their HP: <span className="font-bold" style={{ color: enemy.level > player.level ? '#ff5252' : '#69f0ae' }}>{enemyMaxHP}</span>
            {enemy.level > player.level && <span className="text-yellow-400 ml-2">⚠️ Higher level opponent</span>}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setState(s => ({ ...s, phase: 'player_turn' }))}
              className="px-8 py-3 rounded-xl font-black text-white text-lg transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #ff1744, #d50000)', boxShadow: '0 0 20px rgba(255,23,68,0.5)' }}
            >
              ⚔️ FIGHT!
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl font-medium text-gray-400 text-sm bg-white/5 hover:bg-white/10 transition-colors"
            >
              Back down
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── VICTORY / DEFEAT ──────────────────────────────────────────────────────
  if (state.phase === 'victory' || state.phase === 'defeat') {
    const won = state.phase === 'victory';
    const coinsWon = won ? Math.floor(state.enemyCoins * 0.2) : 0;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: won ? 'rgba(0,20,0,0.93)' : 'rgba(20,0,0,0.93)', backdropFilter: 'blur(8px)' }}>
        <div className="flex flex-col items-center gap-6 text-center px-8">
          <div className="text-7xl">{won ? '🏆' : '💀'}</div>
          <div className="text-5xl font-black" style={{ color: won ? '#69f0ae' : '#ff5252', textShadow: `0 0 30px ${won ? '#69f0ae' : '#ff5252'}88`, fontFamily: 'monospace' }}>
            {won ? 'VICTORY!' : 'DEFEATED'}
          </div>
          <div className="text-lg text-gray-300">
            {won
              ? `You crushed ${enemy.name} and stole ${coinsWon} coins.`
              : `${enemy.name} sent you to the shadow realm. ${Math.floor(state.playerCoins * 0.2)} coins lost.`}
          </div>
          <div className="flex gap-6 text-sm text-gray-400">
            <div>Turns: <span className="text-white font-bold">{state.turn}</span></div>
            <div>Remaining HP: <span className="text-white font-bold">{won ? state.playerHP : state.enemyHP}</span></div>
            {won && <div>Coins stolen: <span className="text-yellow-400 font-bold">+{coinsWon}💰</span></div>}
          </div>
          <div className="text-sm text-gray-500 animate-pulse">Closing in a moment...</div>
        </div>
      </div>
    );
  }

  // ── BATTLE SCREEN ─────────────────────────────────────────────────────────
  const isPlayerTurn = state.phase === 'player_turn';
  const isAnimating = state.phase === 'animating' || state.phase === 'ai_turn';
  const playerHPPct = hpPct(state.playerHP, state.playerMaxHP);
  const enemyHPPct = hpPct(state.enemyHP, state.enemyMaxHP);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,5,15,0.95)', backdropFilter: 'blur(10px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
        <div className="font-black text-white tracking-wider" style={{ fontFamily: 'monospace' }}>⚔️ BATTLE — Turn {state.turn}</div>
        <div className="text-sm font-medium px-3 py-1 rounded-full" style={{ background: isPlayerTurn ? 'rgba(105,240,174,0.2)' : 'rgba(255,82,82,0.2)', color: isPlayerTurn ? '#69f0ae' : '#ff8a80' }}>
          {isPlayerTurn ? '🟢 YOUR TURN' : isAnimating ? '⚡ Resolving...' : '🔴 Enemy thinking...'}
        </div>
      </div>

      {/* Arena */}
      <div className="flex-1 flex items-center justify-center px-6 relative overflow-hidden">
        {/* Battle background gradient */}
        <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(ellipse at center, #1a237e 0%, transparent 70%)' }} />

        {/* Floating damage texts */}
        {state.floatingTexts.map(ft => (
          <div
            key={ft.id}
            className="absolute text-xl font-black pointer-events-none z-20"
            style={{
              color: ft.color,
              left: ft.side === 'left' ? '25%' : '65%',
              top: '30%',
              textShadow: `0 0 10px ${ft.color}`,
              animation: 'floatUp 1.6s ease-out forwards',
            }}
          >
            {ft.text}
          </div>
        ))}

        <div className="w-full max-w-4xl flex items-center gap-6 z-10">
          {/* Player side */}
          <div className={`flex-1 flex flex-col items-center gap-4 transition-transform duration-200 ${state.playerAttacking ? 'translate-x-8' : ''} ${state.playerHurt ? 'animate-shake' : ''}`}>
            {/* Shield indicator */}
            {state.playerShieldTurns > 0 && (
              <div className="text-2xl animate-pulse">🛡️</div>
            )}
            {/* Avatar */}
            <div
              className="w-28 h-28 rounded-3xl flex items-center justify-center text-5xl font-black text-white relative"
              style={{
                background: `linear-gradient(135deg, ${player.avatarColor}, ${player.avatarAccent})`,
                boxShadow: `0 0 ${state.playerHurt ? '20px #ff5252' : `20px ${player.avatarColor}66`}`,
                transition: 'box-shadow 0.2s',
              }}
            >
              {player.name[0]}
              {state.playerHurt && <div className="absolute inset-0 rounded-3xl bg-red-500/40 animate-pulse" />}
            </div>
            <div className="font-bold text-white text-lg">{player.name}</div>
            <div className="text-xs" style={{ color: playerTier.color }}>Lv{player.level} · {playerTier.title}</div>
            {/* HP bar */}
            <div className="w-full max-w-48">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">HP</span>
                <span className="font-bold" style={{ color: hpColor(playerHPPct) }}>{state.playerHP}/{state.playerMaxHP}</span>
              </div>
              <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${playerHPPct}%`, background: `linear-gradient(90deg, ${hpColor(playerHPPct)}, ${hpColor(playerHPPct)}aa)`, boxShadow: `0 0 8px ${hpColor(playerHPPct)}88` }}
                />
              </div>
            </div>
            {/* Coins */}
            <div className="text-sm font-bold text-yellow-400">💰 {state.playerCoins} coins</div>
          </div>

          {/* VS divider */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="text-2xl font-black text-red-500/60">VS</div>
            <div className="w-px h-32 bg-white/10" />
            <div className="text-xl">⚔️</div>
          </div>

          {/* Enemy side */}
          <div className={`flex-1 flex flex-col items-center gap-4 transition-transform duration-200 ${state.enemyAttacking ? '-translate-x-8' : ''} ${state.enemyHurt ? 'animate-shake' : ''}`}>
            {state.enemyShieldTurns > 0 && <div className="text-2xl animate-pulse">🛡️</div>}
            <div
              className="w-28 h-28 rounded-3xl flex items-center justify-center text-5xl font-black text-white relative"
              style={{
                background: `linear-gradient(135deg, ${enemy.avatarColor}, ${enemy.avatarAccent})`,
                boxShadow: `0 0 ${state.enemyHurt ? '20px #ff5252' : `20px ${enemy.avatarColor}66`}`,
                transition: 'box-shadow 0.2s',
              }}
            >
              {enemy.name[0]}
              {state.enemyHurt && <div className="absolute inset-0 rounded-3xl bg-red-500/40 animate-pulse" />}
            </div>
            <div className="font-bold text-white text-lg">{enemy.name}</div>
            <div className="text-xs" style={{ color: enemyTier.color }}>Lv{enemy.level} · {enemyTier.title}</div>
            <div className="w-full max-w-48">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">HP</span>
                <span className="font-bold" style={{ color: hpColor(enemyHPPct) }}>{state.enemyHP}/{state.enemyMaxHP}</span>
              </div>
              <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${enemyHPPct}%`, background: `linear-gradient(90deg, ${hpColor(enemyHPPct)}, ${hpColor(enemyHPPct)}aa)`, boxShadow: `0 0 8px ${hpColor(enemyHPPct)}88` }}
                />
              </div>
            </div>
            <div className="text-sm font-bold text-yellow-400">💰 {state.enemyCoins} coins</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 pb-4">
        <div className="grid grid-cols-5 gap-2 mb-3">
          {actions.map(action => {
            const canAfford = state.playerCoins >= action.cost;
            const isUlt = action.isUltimate;
            return (
              <button
                key={action.id}
                onClick={() => handlePlayerAction(action)}
                disabled={!isPlayerTurn || !canAfford || isAnimating}
                title={`${action.description}${action.cost > 0 ? ` (${action.cost} coins)` : ''}`}
                className="flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all text-center group relative"
                style={{
                  background: isUlt
                    ? (canAfford && isPlayerTurn ? `linear-gradient(135deg, ${player.avatarColor}44, ${player.avatarAccent}22)` : 'rgba(255,255,255,0.03)')
                    : (canAfford && isPlayerTurn ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'),
                  border: isUlt
                    ? `1px solid ${canAfford && isPlayerTurn ? player.avatarColor + '88' : 'rgba(255,255,255,0.06)'}`
                    : `1px solid ${canAfford && isPlayerTurn ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'}`,
                  opacity: canAfford && (isPlayerTurn || !isAnimating) ? 1 : 0.4,
                  transform: canAfford && isPlayerTurn ? 'scale(1)' : 'scale(0.97)',
                  boxShadow: isUlt && canAfford && isPlayerTurn ? `0 0 12px ${player.avatarColor}44` : 'none',
                }}
              >
                <span className="text-2xl">{action.emoji}</span>
                <span className="text-[10px] font-bold text-white leading-tight">{action.name}</span>
                <span className="text-[10px]" style={{ color: action.cost === 0 ? '#69f0ae' : '#ffd600' }}>
                  {action.cost === 0 ? 'FREE' : `${action.cost}💰`}
                </span>
                {isUlt && <span className="absolute -top-1 -right-1 text-[9px] px-1 rounded-full bg-yellow-400 text-black font-black">ULT</span>}
              </button>
            );
          })}
        </div>

        {/* Battle log */}
        <div className="rounded-xl p-2 flex flex-col gap-0.5 overflow-y-auto" style={{ maxHeight: 72, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {state.log.slice().reverse().map((line, i) => (
            <div key={i} className="text-xs text-gray-300 leading-relaxed" style={{ opacity: 1 - i * 0.06 }}>{line}</div>
          ))}
        </div>
      </div>

      {/* Float animation keyframes */}
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1);   opacity: 1; }
          70%  { transform: translateY(-50px) scale(1.15); opacity: 1; }
          100% { transform: translateY(-80px) scale(0.9); opacity: 0; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-6px); }
          40%       { transform: translateX(6px); }
          60%       { transform: translateX(-4px); }
          80%       { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.35s ease-in-out; }
      `}</style>
    </div>
  );
}
