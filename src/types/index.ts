export type BadgeCategory = 'brain' | 'social' | 'grind' | 'legend' | 'negative';

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  descriptor: string;
  category: BadgeCategory;
  isTemporary: boolean;
  requirement: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  avatarAccent: string;
  level: number;
  xp: number;
  xpToNext: number;
  coins: number;
  battleWins: number;
  battleLosses: number;
  badges: string[];
  activeBadges: string[];
  worldX: number;
  worldY: number;
  status: 'online' | 'away' | 'offline';
  lastActive: string;
  joinedDate: string;
}

export interface BattleAction {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  damageMin: number;
  damageMax: number;
  healAmount?: number;
  shieldTurns?: number;
  stealCoins?: number;
  description: string;
  isUltimate?: boolean;
  critChance?: number;
}

export interface FloatingText {
  id: number;
  text: string;
  color: string;
  side: 'left' | 'right';
}

export type BattlePhase = 'challenge' | 'player_turn' | 'ai_turn' | 'animating' | 'victory' | 'defeat';

export interface BattleState {
  phase: BattlePhase;
  playerHP: number;
  enemyHP: number;
  playerMaxHP: number;
  enemyMaxHP: number;
  playerCoins: number;
  enemyCoins: number;
  playerShieldTurns: number;
  enemyShieldTurns: number;
  turn: number;
  log: string[];
  floatingTexts: FloatingText[];
  playerLastAction?: string;
  enemyLastAction?: string;
  playerAttacking: boolean;
  enemyAttacking: boolean;
  playerHurt: boolean;
  enemyHurt: boolean;
}

export interface Idea {
  id: string;
  title: string;
  description: string;
  authorId: string;
  upvotes: string[]; // array of member IDs who upvoted
  createdAt: string;
  status: 'open' | 'in_progress' | 'completed' | 'declined';
  tags: string[];
}

export interface WorkLog {
  id: string;
  authorId: string;
  summary: string;
  project: string;
  createdAt: string;
  xpAwarded: number;
}

export interface Zone {
  id: string;
  name: string;
  emoji: string;
  color: string;
  tiles: { x: number; y: number }[];
  description: string;
  action?: string;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Emote {
  emoji: string;
  label: string;
}

export interface ChatMessage {
  id: string;
  authorId: string;
  text: string;
  createdAt: number;
}
