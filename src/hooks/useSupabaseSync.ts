import { useState, useEffect, useRef } from 'react';
import {
  fetchPlayerStates, upsertPlayerState, updatePlayerState,
  fetchRecentChat, sendChatMessage, subscribeToChat, subscribeToPlayerStates,
  type DBPlayerState, type DBChatMessage,
} from '../lib/supabase';
import { TEAM_MEMBERS } from '../data/gameData';
import type { TeamMember } from '../types';

export interface LiveChatMessage {
  id: string;
  authorId: string;
  text: string;
  createdAt: number;
}

// Merge static team data with live DB state
function mergeMember(base: TeamMember, live: DBPlayerState | undefined): TeamMember {
  if (!live) return base;
  return {
    ...base,
    level: live.level,
    xp: live.xp,
    coins: live.coins,
    battleWins: live.battle_wins,
    battleLosses: live.battle_losses,
    worldX: live.world_x,
    worldY: live.world_y,
    status: live.status,
    lastActive: live.last_active ? relativeTime(live.last_active) : base.lastActive,
    mood: live.mood ?? null,
    loginStreak: live.login_streak ?? 0,
  };
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} mins ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
  return `${Math.floor(diff / 86400000)} days ago`;
}

export function useSupabaseSync(controlledMemberId: string) {
  const [liveMembers, setLiveMembers] = useState<TeamMember[]>(TEAM_MEMBERS);
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>([]);
  const [ready, setReady] = useState(false);
  const liveMembersRef = useRef<TeamMember[]>(TEAM_MEMBERS);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [playerStates, chatHistory] = await Promise.all([
        fetchPlayerStates(),
        fetchRecentChat(50),
      ]);

      if (cancelled) return;

      // Merge player states into team members
      const stateMap = Object.fromEntries(playerStates.map(s => [s.member_id, s]));
      const merged = TEAM_MEMBERS.map(m => mergeMember(m, stateMap[m.id]));
      setLiveMembers(merged);
      liveMembersRef.current = merged;

      // Convert chat history
      setChatMessages(chatHistory.map(c => ({
        id: c.id,
        authorId: c.author_id,
        text: c.text,
        createdAt: new Date(c.created_at).getTime(),
      })));

      setReady(true);

      // Mark self as online
      await upsertPlayerState({
        member_id: controlledMemberId,
        status: 'online',
        last_active: new Date().toISOString(),
      });
    }

    load();
    return () => { cancelled = true; };
  }, [controlledMemberId]);

  // Realtime: chat
  useEffect(() => {
    const sub = subscribeToChat((msg: DBChatMessage) => {
      setChatMessages(prev => {
        // Avoid exact-id duplicates
        if (prev.some(m => m.id === msg.id)) return prev;
        const realMsg = {
          id: msg.id,
          authorId: msg.author_id,
          text: msg.text,
          createdAt: new Date(msg.created_at).getTime(),
        };
        // Replace any matching optimistic temp message (same author + text)
        const tempIdx = prev.findIndex(
          m => m.id.startsWith('temp_') && m.authorId === msg.author_id && m.text === msg.text
        );
        if (tempIdx !== -1) {
          const next = [...prev];
          next[tempIdx] = realMsg;
          return next;
        }
        return [...prev, realMsg];
      });
    });
    return () => { sub.unsubscribe(); };
  }, []);

  // Realtime: player states
  useEffect(() => {
    const sub = subscribeToPlayerStates((state: DBPlayerState) => {
      setLiveMembers(prev => {
        const next = prev.map(m =>
          m.id === state.member_id ? mergeMember(m, state) : m
        );
        liveMembersRef.current = next;
        return next;
      });
    });
    return () => { sub.unsubscribe(); };
  }, []);

  // Heartbeat: keep self marked online every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      updatePlayerState(controlledMemberId, {
        status: 'online',
        last_active: new Date().toISOString(),
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [controlledMemberId]);

  // Actions
  const sendChat = async (text: string) => {
    // Optimistic
    const tempId = `temp_${Date.now()}`;
    setChatMessages(prev => [...prev, {
      id: tempId,
      authorId: controlledMemberId,
      text,
      createdAt: Date.now(),
    }]);
    await sendChatMessage(controlledMemberId, text);
  };

  const syncCoins = async (newCoins: number, battleWins?: number, battleLosses?: number) => {
    const me = liveMembersRef.current.find(m => m.id === controlledMemberId);
    if (!me) return;
    const patch: Partial<DBPlayerState> = { coins: newCoins };
    if (battleWins !== undefined) patch.battle_wins = battleWins;
    if (battleLosses !== undefined) patch.battle_losses = battleLosses;
    await updatePlayerState(controlledMemberId, patch);
    setLiveMembers(prev => prev.map(m =>
      m.id === controlledMemberId
        ? { ...m, coins: newCoins,
            battleWins: battleWins ?? m.battleWins,
            battleLosses: battleLosses ?? m.battleLosses }
        : m
    ));
  };

  const syncPosition = async (x: number, y: number) => {
    await updatePlayerState(controlledMemberId, { world_x: x, world_y: y });
  };

  return {
    liveMembers,
    chatMessages,
    ready,
    sendChat,
    syncCoins,
    syncPosition,
  };
}
