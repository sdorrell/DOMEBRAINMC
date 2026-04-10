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

export interface DBXpEvent {
  id: string;
  member_id: string;
  xp_delta: number;
  reason: string;
  created_at: string;
}

export async function fetchXpEvents(memberId: string, limit = 50): Promise<DBXpEvent[]> {
  const { data, error } = await supabase
    .from('mc_xp_events')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('fetchXpEvents:', error); return []; }
  return data || [];
}

export async function logXpEvent(memberId: string, xpDelta: number, reason: string) {
  const { error } = await supabase
    .from('mc_xp_events')
    .insert({ member_id: memberId, xp_delta: xpDelta, reason });
  if (error) console.error('logXpEvent:', error);
}

// ─── XP helper — log event + increment player XP atomically ───────────────

export async function addXp(memberId: string, delta: number, reason: string): Promise<void> {
  await logXpEvent(memberId, delta, reason);
  const { data } = await supabase
    .from('mc_player_state')
    .select('xp')
    .eq('member_id', memberId)
    .maybeSingle();
  if (data) {
    await supabase
      .from('mc_player_state')
      .update({ xp: (data.xp || 0) + delta, updated_at: new Date().toISOString() })
      .eq('member_id', memberId);
  }
}

// ─── PIN auth ─────────────────────────────────────────────────────────────

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getStoredPinHash(memberId: string): Promise<string | null> {
  const { data } = await supabase
    .from('mc_player_state')
    .select('pin_hash')
    .eq('member_id', memberId)
    .single();
  return data?.pin_hash ?? null;
}

export async function setPinHash(memberId: string, pin: string): Promise<void> {
  const hash = await sha256hex(pin);
  await supabase
    .from('mc_player_state')
    .update({ pin_hash: hash })
    .eq('member_id', memberId);
}

export async function verifyPin(memberId: string, pin: string): Promise<boolean> {
  const stored = await getStoredPinHash(memberId);
  if (!stored) return false;
  const hash = await sha256hex(pin);
  return hash === stored;
}

// ─── DOME Brain live data ──────────────────────────────────────────────────

export interface DBWorkSummary {
  id: string;
  team_member: string;
  project_name: string;
  session_date: string;
  summary: string;
  key_decisions: string | null;
  next_steps: string | null;
  tags: string[];
  created_at: string;
}

export interface DBProjectContext {
  id: string;
  project_name: string;
  description: string | null;
  owner: string | null;
  collaborators: string | null;
  status: string;
  goals: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchWorkSummaries(limit = 30): Promise<DBWorkSummary[]> {
  const { data, error } = await supabase
    .from('dome_work_summaries')
    .select('id, team_member, project_name, session_date, summary, key_decisions, next_steps, tags, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('fetchWorkSummaries:', error); return []; }
  return data || [];
}

export async function fetchProjectContexts(): Promise<DBProjectContext[]> {
  const { data, error } = await supabase
    .from('dome_project_context')
    .select('id, project_name, description, owner, collaborators, status, goals, created_at, updated_at')
    .order('updated_at', { ascending: false });
  if (error) { console.error('fetchProjectContexts:', error); return []; }
  return data || [];
}

// ─── Update Requests ───────────────────────────────────────────────────────

export interface DBUpdateRequest {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  category: 'feature' | 'bug' | 'improvement' | 'other';
  status: 'open' | 'in_progress' | 'done' | 'declined';
  upvotes: string[];
  created_at: string;
}

export async function fetchUpdateRequests(): Promise<DBUpdateRequest[]> {
  const { data, error } = await supabase
    .from('mc_update_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchUpdateRequests:', error); return []; }
  return data || [];
}

export async function createUpdateRequest(req: Omit<DBUpdateRequest, 'id' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('mc_update_requests').insert(req);
  if (error) console.error('createUpdateRequest:', error);
}

export async function toggleRequestUpvote(reqId: string, memberId: string, current: string[]): Promise<string[]> {
  const next = current.includes(memberId)
    ? current.filter(id => id !== memberId)
    : [...current, memberId];
  await supabase.from('mc_update_requests').update({ upvotes: next }).eq('id', reqId);
  return next;
}

export function subscribeToUpdateRequests(callback: (req: DBUpdateRequest) => void) {
  return supabase
    .channel('mc_requests_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mc_update_requests' },
      payload => callback(payload.new as DBUpdateRequest))
    .subscribe();
}

// ─── Suggestions (AI-generated + admin approval) ──────────────────────────

export interface DBSuggestion {
  id: string;
  title: string;
  description: string | null;
  category: 'feature' | 'bug' | 'improvement' | 'performance' | 'ux';
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'in_progress' | 'implemented' | 'declined' | 'saved';
  source: 'ai' | 'feedback_derived';
  source_request_ids: string[];
  implementation_summary: string | null;
  created_at: string;
  approved_at: string | null;
  implemented_at: string | null;
}

export async function fetchSuggestions(): Promise<DBSuggestion[]> {
  const { data, error } = await supabase
    .from('mc_suggestions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchSuggestions:', error); return []; }
  return data || [];
}

export async function approveSuggestion(id: string): Promise<void> {
  const { error } = await supabase
    .from('mc_suggestions')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('approveSuggestion:', error);
}

export async function declineSuggestion(id: string): Promise<void> {
  const { error } = await supabase
    .from('mc_suggestions')
    .update({ status: 'declined' })
    .eq('id', id);
  if (error) console.error('declineSuggestion:', error);
}

export async function saveForLaterSuggestion(id: string): Promise<void> {
  const { error } = await supabase
    .from('mc_suggestions')
    .update({ status: 'saved' })
    .eq('id', id);
  if (error) console.error('saveForLaterSuggestion:', error);
}

export async function approveAllPendingSuggestions(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase
    .from('mc_suggestions')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .in('id', ids);
  if (error) console.error('approveAllPendingSuggestions:', error);
}

// ─── App Config (key-value store) ─────────────────────────────────────────

export async function getConfig(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('mc_config')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) { console.error('getConfig:', error); return null; }
  return data?.value ?? null;
}

export async function setConfig(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('mc_config')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) console.error('setConfig:', error);
}

export async function approveRequestForDev(reqId: string, notes?: string): Promise<void> {
  const { error } = await supabase
    .from('mc_update_requests')
    .update({ approved_for_dev: true, dev_notes: notes || null, status: 'in_progress' })
    .eq('id', reqId);
  if (error) console.error('approveRequestForDev:', error);
}

export async function unapproveRequest(reqId: string): Promise<void> {
  const { error } = await supabase
    .from('mc_update_requests')
    .update({ approved_for_dev: false, dev_notes: null, status: 'open' })
    .eq('id', reqId);
  if (error) console.error('unapproveRequest:', error);
}

export function subscribeToSuggestions(callback: (s: DBSuggestion) => void) {
  return supabase
    .channel('mc_suggestions_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mc_suggestions' },
      payload => callback(payload.new as DBSuggestion))
    .subscribe();
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
