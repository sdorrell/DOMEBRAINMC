import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://skjyihneziqbnkyblipx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNranlpaG5lemlxYm5reWJsaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjI5NDEsImV4cCI6MjA5MTIzODk0MX0.quvarkT1C-qVAGfuXzlEYWueHBybuhTa7DNqiF-e3OE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Types matching DB tables ──────────────────────────────────────────────

export interface DBPlayerState {
  id: string;
  member_id: string;
  xp: number;
  level: number;
  coins: number;
  battle_wins: number;
  battle_losses: number;
  world_x: number;
  world_y: number;
  status: 'online' | 'away' | 'offline';
  last_active: string;
}

export interface DBIdea {
  id: string;
  title: string;
  description: string | null;
  author_id: string;
  status: 'open' | 'in_progress' | 'done' | 'rejected';
  tags: string[];
  upvotes: string[];
  created_at: string;
  updated_at: string;
}

export interface DBChatMessage {
  id: string;
  author_id: string;
  text: string;
  created_at: string;
}

export interface DBBadge {
  id: string;
  member_id: string;
  badge_id: string;
  is_active: boolean;
  earned_at: string;
}

// ─── Player state ──────────────────────────────────────────────────────────

export async function fetchPlayerStates(): Promise<DBPlayerState[]> {
  const { data, error } = await supabase
    .from('mc_player_state')
    .select('*');
  if (error) { console.error('fetchPlayerStates:', error); return []; }
  return data || [];
}

export async function updatePlayerState(memberId: string, patch: Partial<DBPlayerState>) {
  const { error } = await supabase
    .from('mc_player_state')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('member_id', memberId);
  if (error) console.error('updatePlayerState:', error);
}

export async function upsertPlayerState(state: Partial<DBPlayerState> & { member_id: string }) {
  const { error } = await supabase
    .from('mc_player_state')
    .upsert({ ...state, updated_at: new Date().toISOString() }, { onConflict: 'member_id' });
  if (error) console.error('upsertPlayerState:', error);
}

// ─── Ideas ─────────────────────────────────────────────────────────────────

export async function fetchIdeas(): Promise<DBIdea[]> {
  const { data, error } = await supabase
    .from('mc_ideas')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchIdeas:', error); return []; }
  return data || [];
}

export async function createIdea(idea: Omit<DBIdea, 'id' | 'created_at' | 'updated_at'>): Promise<DBIdea | null> {
  const { data, error } = await supabase
    .from('mc_ideas')
    .insert(idea)
    .select()
    .single();
  if (error) { console.error('createIdea:', error); return null; }
  return data;
}

export async function toggleUpvote(ideaId: string, memberId: string, currentUpvotes: string[]): Promise<string[]> {
  const hasUpvoted = currentUpvotes.includes(memberId);
  const newUpvotes = hasUpvoted
    ? currentUpvotes.filter(id => id !== memberId)
    : [...currentUpvotes, memberId];

  const { error } = await supabase
    .from('mc_ideas')
    .update({ upvotes: newUpvotes, updated_at: new Date().toISOString() })
    .eq('id', ideaId);
  if (error) { console.error('toggleUpvote:', error); return currentUpvotes; }
  return newUpvotes;
}

// ─── Chat ──────────────────────────────────────────────────────────────────

export async function fetchRecentChat(limit = 50): Promise<DBChatMessage[]> {
  const { data, error } = await supabase
    .from('mc_chat')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('fetchRecentChat:', error); return []; }
  return (data || []).reverse();
}

export async function sendChatMessage(authorId: string, text: string) {
  const { error } = await supabase
    .from('mc_chat')
    .insert({ author_id: authorId, text });
  if (error) console.error('sendChatMessage:', error);
}

// ─── Badges ────────────────────────────────────────────────────────────────

export async function fetchBadges(): Promise<DBBadge[]> {
  const { data, error } = await supabase
    .from('mc_badges')
    .select('*');
  if (error) { console.error('fetchBadges:', error); return []; }
  return data || [];
}

export async function awardBadge(memberId: string, badgeId: string) {
  const { error } = await supabase
    .from('mc_badges')
    .upsert({ member_id: memberId, badge_id: badgeId, is_active: true }, { onConflict: 'member_id,badge_id' });
  if (error) console.error('awardBadge:', error);
}

// ─── XP events ────────────────────────────────────────────────────────────

export async function logXpEvent(memberId: string, xpDelta: number, reason: string) {
  const { error } = await supabase
    .from('mc_xp_events')
    .insert({ member_id: memberId, xp_delta: xpDelta, reason });
  if (error) console.error('logXpEvent:', error);
}

// ─── Realtime subscriptions ───────────────────────────────────────────────

export function subscribeToChat(callback: (msg: DBChatMessage) => void) {
  return supabase
    .channel('mc_chat_realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'mc_chat',
    }, payload => {
      callback(payload.new as DBChatMessage);
    })
    .subscribe();
}

export function subscribeToPlayerStates(callback: (state: DBPlayerState) => void) {
  return supabase
    .channel('mc_players_realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'mc_player_state',
    }, payload => {
      callback(payload.new as DBPlayerState);
    })
    .subscribe();
}

export function subscribeToIdeas(callback: (idea: DBIdea) => void) {
  return supabase
    .channel('mc_ideas_realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'mc_ideas',
    }, payload => {
      callback(payload.new as DBIdea);
    })
    .subscribe();
}
