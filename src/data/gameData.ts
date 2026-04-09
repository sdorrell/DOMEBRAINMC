import type { Badge, TeamMember, Idea, WorkLog, Zone, Emote } from '../types';

// ─── 25 DOME BADGES ───────────────────────────────────────────────────────────

export const BADGES: Badge[] = [
  // 20 Positive Permanent
  {
    id: 'brain_dump',
    name: 'Brain Dump Champion',
    emoji: '🧠',
    descriptor: 'Logged 10+ work summaries into DOME Brain. Your thoughts are now company property.',
    category: 'brain',
    isTemporary: false,
    requirement: '10+ work summaries',
    rarity: 'common',
  },
  {
    id: 'oracle',
    name: 'The Oracle',
    emoji: '🔮',
    descriptor: 'First person to add a glossary term. You define reality around here.',
    category: 'brain',
    isTemporary: false,
    requirement: 'First glossary term ever',
    rarity: 'legendary',
  },
  {
    id: 'librarian',
    name: 'The Librarian',
    emoji: '📚',
    descriptor: 'Added 25+ glossary terms. DOME dictionary is basically yours at this point.',
    category: 'brain',
    isTemporary: false,
    requirement: '25+ glossary terms',
    rarity: 'rare',
  },
  {
    id: 'project_whisperer',
    name: 'Project Whisperer',
    emoji: '🏗️',
    descriptor: 'Updated a project 10+ times. Projects respect you. Also fear you.',
    category: 'grind',
    isTemporary: false,
    requirement: '10+ project updates',
    rarity: 'common',
  },
  {
    id: 'dawn_patrol',
    name: 'Dawn Patrol',
    emoji: '🌅',
    descriptor: 'Logged work before 7am. Admirable. Also concerning. Are you okay?',
    category: 'grind',
    isTemporary: false,
    requirement: 'Log work before 7am',
    rarity: 'rare',
  },
  {
    id: 'night_owl',
    name: 'Night Owl Protocol',
    emoji: '🦉',
    descriptor: 'Logged work after midnight. Your circadian rhythm has filed a complaint.',
    category: 'grind',
    isTemporary: false,
    requirement: 'Log work after midnight',
    rarity: 'rare',
  },
  {
    id: 'idea_volcano',
    name: 'Idea Volcano',
    emoji: '💡',
    descriptor: 'Submitted 10+ ideas. You are a geologic hazard of creativity.',
    category: 'social',
    isTemporary: false,
    requirement: '10+ ideas submitted',
    rarity: 'common',
  },
  {
    id: 'peoples_champion',
    name: "The People's Champion",
    emoji: '👑',
    descriptor: 'An idea of yours got 4+ upvotes. Democracy chose you.',
    category: 'social',
    isTemporary: false,
    requirement: '4+ upvotes on one idea',
    rarity: 'epic',
  },
  {
    id: 'democracy_enjoyer',
    name: 'Democracy Enjoyer',
    emoji: '🗳️',
    descriptor: 'Upvoted 15+ ideas from teammates. You believe in the process. Deeply.',
    category: 'social',
    isTemporary: false,
    requirement: '15+ upvotes cast',
    rarity: 'common',
  },
  {
    id: 'hyperdrive',
    name: 'Hyperdrive',
    emoji: '⚡',
    descriptor: 'Completed 5 tasks in a single day. You might actually be a robot.',
    category: 'grind',
    isTemporary: false,
    requirement: '5 tasks in one day',
    rarity: 'rare',
  },
  {
    id: 'hot_streak',
    name: 'Hot Streak',
    emoji: '🔥',
    descriptor: '7 consecutive days of logging. Suspiciously, dangerously consistent.',
    category: 'grind',
    isTemporary: false,
    requirement: '7-day logging streak',
    rarity: 'rare',
  },
  {
    id: 'dome_fossil',
    name: 'DOME Fossil',
    emoji: '💎',
    descriptor: 'On the team for 1+ year. You were here before we had furniture.',
    category: 'legend',
    isTemporary: false,
    requirement: '1+ year on the team',
    rarity: 'epic',
  },
  {
    id: 'galaxy_brained',
    name: 'Galaxy-Brained',
    emoji: '🌌',
    descriptor: 'An idea got upvoted by every single teammate. Unanimous. Undeniable. Unhinged in the best way.',
    category: 'legend',
    isTemporary: false,
    requirement: 'Upvoted by all 6 other teammates',
    rarity: 'legendary',
  },
  {
    id: 'og',
    name: 'The OG',
    emoji: '🎯',
    descriptor: 'Submitted the very first work log ever. You started all of this. Good job. Sorry.',
    category: 'legend',
    isTemporary: false,
    requirement: 'First ever work log',
    rarity: 'legendary',
  },
  {
    id: 'data_archaeologist',
    name: 'Data Archaeologist',
    emoji: '🔬',
    descriptor: 'Ran 50+ database queries. You know where the data bodies are buried.',
    category: 'brain',
    isTemporary: false,
    requirement: '50+ database queries',
    rarity: 'rare',
  },
  {
    id: 'overachiever',
    name: 'Overachiever',
    emoji: '🏆',
    descriptor: 'Hold 3+ badges simultaneously. We see you. Everybody sees you.',
    category: 'legend',
    isTemporary: false,
    requirement: '3+ badges at once',
    rarity: 'epic',
  },
  {
    id: 'dome_legend',
    name: 'DOME Legend',
    emoji: '🌟',
    descriptor: 'Reached Level 25. You are basically a deity of operational excellence.',
    category: 'legend',
    isTemporary: false,
    requirement: 'Reach Level 25',
    rarity: 'legendary',
  },
  {
    id: 'team_player',
    name: 'Team Player',
    emoji: '🤝',
    descriptor: 'Contributed to 3+ active projects in a single week. You contain multitudes.',
    category: 'social',
    isTemporary: false,
    requirement: '3+ projects in one week',
    rarity: 'common',
  },
  {
    id: 'deep_space',
    name: 'Deep Space',
    emoji: '🚀',
    descriptor: 'Reached Level 50. We are legally required to have a conversation about equity.',
    category: 'legend',
    isTemporary: false,
    requirement: 'Reach Level 50',
    rarity: 'legendary',
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    emoji: '🏎️',
    descriptor: 'Logged work in under 60 seconds flat. Caffeine levels: critical.',
    category: 'grind',
    isTemporary: false,
    requirement: 'Log work in under 60 seconds',
    rarity: 'rare',
  },

  // 5 Negative Temporary
  {
    id: 'ghost_protocol',
    name: 'Ghost Protocol',
    emoji: '👻',
    descriptor: 'No activity in 7+ days. Are you... okay? We checked your desk. You were not there.',
    category: 'negative',
    isTemporary: true,
    requirement: 'Inactive for 7+ days',
    rarity: 'common',
  },
  {
    id: 'tumbleweed',
    name: 'Tumbleweed',
    emoji: '🌵',
    descriptor: 'No activity in 14+ days. We have started your memorial garden. It is thriving.',
    category: 'negative',
    isTemporary: true,
    requirement: 'Inactive for 14+ days',
    rarity: 'common',
  },
  {
    id: 'touch_grass',
    name: 'Touch Grass',
    emoji: '☕',
    descriptor: '12+ hours of system activity logged. Step away from the screen. We beg you.',
    category: 'negative',
    isTemporary: true,
    requirement: '12+ hours of activity in one session',
    rarity: 'rare',
  },
  {
    id: 'chronically_maybe',
    name: 'Chronically Maybe',
    emoji: '🐌',
    descriptor: '3+ tasks in-progress for over a week. Almost done, they said. Any day now.',
    category: 'negative',
    isTemporary: true,
    requirement: '3+ stale in-progress tasks',
    rarity: 'common',
  },
  {
    id: 'copy_pasta',
    name: 'Copy Pasta',
    emoji: '🔄',
    descriptor: 'Submitted a near-duplicate idea. Accidentally psychic, or suspiciously lurking.',
    category: 'negative',
    isTemporary: true,
    requirement: 'Duplicate idea within 48h',
    rarity: 'common',
  },
];

export const BADGE_MAP = Object.fromEntries(BADGES.map(b => [b.id, b]));

// ─── TEAM DATA ────────────────────────────────────────────────────────────────

export const TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'rudy',
    name: 'Rudy',
    role: 'CEO',
    avatarColor: '#f59e0b',
    avatarAccent: '#fcd34d',
    level: 15,
    xp: 3200,
    xpToNext: 4000,
    coins: 400,
    battleWins: 5,
    battleLosses: 1,
    badges: ['og', 'dome_fossil', 'idea_volcano', 'overachiever', 'peoples_champion'],
    activeBadges: [],
    worldX: 8,
    worldY: 6,
    status: 'online',
    lastActive: 'Just now',
    joinedDate: '2023-01-01',
  },
  {
    id: 'scott',
    name: 'Scott',
    role: 'Technology Lead',
    avatarColor: '#6366f1',
    avatarAccent: '#a5b4fc',
    level: 14,
    xp: 2900,
    xpToNext: 3500,
    coins: 362,
    battleWins: 4,
    battleLosses: 2,
    badges: ['dome_fossil', 'brain_dump', 'data_archaeologist', 'overachiever', 'night_owl'],
    activeBadges: [],
    worldX: 22,
    worldY: 8,
    status: 'online',
    lastActive: '2 mins ago',
    joinedDate: '2023-01-01',
  },
  {
    id: 'shayne',
    name: 'Shayne',
    role: 'Super Admin & HR',
    avatarColor: '#10b981',
    avatarAccent: '#6ee7b7',
    level: 12,
    xp: 2400,
    xpToNext: 3000,
    coins: 300,
    battleWins: 3,
    battleLosses: 2,
    badges: ['dome_fossil', 'team_player', 'project_whisperer', 'democracy_enjoyer'],
    activeBadges: [],
    worldX: 14,
    worldY: 15,
    status: 'online',
    lastActive: '10 mins ago',
    joinedDate: '2023-01-01',
  },
  {
    id: 'steve',
    name: 'Steve',
    role: 'COO & Marketing',
    avatarColor: '#ec4899',
    avatarAccent: '#f9a8d4',
    level: 11,
    xp: 2100,
    xpToNext: 2600,
    coins: 262,
    battleWins: 3,
    battleLosses: 2,
    badges: ['hot_streak', 'idea_volcano', 'brain_dump', 'team_player'],
    activeBadges: [],
    worldX: 6,
    worldY: 18,
    status: 'online',
    lastActive: '20 mins ago',
    joinedDate: '2023-06-01',
  },
  {
    id: 'micah',
    name: 'Micah',
    role: 'Programmer & Analyst',
    avatarColor: '#8b5cf6',
    avatarAccent: '#c4b5fd',
    level: 10,
    xp: 1850,
    xpToNext: 2200,
    coins: 231,
    battleWins: 2,
    battleLosses: 2,
    badges: ['data_archaeologist', 'brain_dump', 'hyperdrive'],
    activeBadges: [],
    worldX: 30,
    worldY: 12,
    status: 'online',
    lastActive: '5 mins ago',
    joinedDate: '2023-09-01',
  },
  {
    id: 'alan',
    name: 'Alan',
    role: 'CFO',
    avatarColor: '#06b6d4',
    avatarAccent: '#67e8f9',
    level: 9,
    xp: 1500,
    xpToNext: 2000,
    coins: 187,
    battleWins: 2,
    battleLosses: 1,
    badges: ['brain_dump', 'data_archaeologist', 'dawn_patrol'],
    activeBadges: [],
    worldX: 26,
    worldY: 19,
    status: 'online',
    lastActive: '1 hour ago',
    joinedDate: '2023-09-01',
  },
  {
    id: 'furman',
    name: 'Furman',
    role: 'Compliance & Licensing',
    avatarColor: '#ef4444',
    avatarAccent: '#fca5a5',
    level: 7,
    xp: 1050,
    xpToNext: 1500,
    coins: 131,
    battleWins: 1,
    battleLosses: 1,
    badges: ['idea_volcano', 'hot_streak'],
    activeBadges: [],
    worldX: 18,
    worldY: 4,
    status: 'online',
    lastActive: '45 mins ago',
    joinedDate: '2024-01-01',
  },
];

// ─── IDEAS BOARD ──────────────────────────────────────────────────────────────

export const IDEAS: Idea[] = [
  {
    id: '1',
    title: 'Auto-generate weekly DOME Brain digest emails',
    description: 'Every Monday morning, send a team-wide email summarizing what was added to DOME Brain last week — top work logs, new glossary terms, project updates.',
    authorId: 'scott',
    upvotes: ['shayne', 'micah', 'rudy', 'alan', 'furman'],
    createdAt: '2026-04-07T09:00:00Z',
    status: 'open',
    tags: ['automation', 'communication'],
  },
  {
    id: '2',
    title: 'DOME Brain Slack bot for quick logging',
    description: 'A Slack slash command like /log "what I did today" that writes directly to DOME Brain work summaries without opening Claude.',
    authorId: 'shayne',
    upvotes: ['scott', 'micah', 'rudy', 'alan'],
    createdAt: '2026-04-06T14:00:00Z',
    status: 'in_progress',
    tags: ['integration', 'slack', 'automation'],
  },
  {
    id: '3',
    title: 'Quote velocity dashboard for planbuilder',
    description: 'Visual chart showing quotes sent per day/week/month with trend lines, so we can see if we are accelerating or slowing down.',
    authorId: 'furman',
    upvotes: ['scott', 'shayne', 'micah'],
    createdAt: '2026-04-08T10:00:00Z',
    status: 'open',
    tags: ['analytics', 'sales'],
  },
  {
    id: '4',
    title: 'Agent concierge for new agents onboarding',
    description: 'When a new agent joins, an AI agent walks them through the platform in real time — no more long PDF onboarding docs.',
    authorId: 'rudy',
    upvotes: ['scott', 'micah', 'alan', 'furman', 'shayne', 'steve'],
    createdAt: '2026-04-05T16:00:00Z',
    status: 'open',
    tags: ['ai', 'onboarding', 'agents'],
  },
  {
    id: '5',
    title: 'Commission transparency portal for agents',
    description: 'Let agents log in and see their own commission history, pending payments, and projected earnings without calling us.',
    authorId: 'micah',
    upvotes: ['scott', 'alan', 'furman'],
    createdAt: '2026-04-04T11:00:00Z',
    status: 'open',
    tags: ['portal', 'agents', 'transparency'],
  },
  {
    id: '6',
    title: 'Daily standup bot that posts in Slack automatically',
    description: 'Pulls yesterdays work logs from DOME Brain for each person and posts a standup summary every morning at 9am.',
    authorId: 'alan',
    upvotes: ['scott', 'micah', 'rudy'],
    createdAt: '2026-04-08T08:00:00Z',
    status: 'open',
    tags: ['automation', 'slack', 'standup'],
  },
  {
    id: '7',
    title: 'Badge ceremony — post in Slack when someone earns a badge',
    description: 'Every time a team member earns a new DOME badge, post an announcement in #general with confetti and a description of what they did.',
    authorId: 'rudy',
    upvotes: ['scott', 'micah', 'alan', 'shayne', 'furman', 'steve'],
    createdAt: '2026-04-07T13:00:00Z',
    status: 'open',
    tags: ['gamification', 'slack', 'fun'],
  },
];

// ─── WORK LOGS ────────────────────────────────────────────────────────────────

export const WORK_LOGS: WorkLog[] = [
  {
    id: '1', authorId: 'scott', summary: 'Deployed DOME Brain MCP server to Railway with all database connections. Fixed DNS rebinding protection and lifespan propagation.', project: 'DOME Brain', createdAt: '2026-04-09T08:30:00Z', xpAwarded: 150,
  },
  {
    id: '2', authorId: 'shayne', summary: 'Fixed commission calculation bug in Millennium. Members with multiple plans were getting doubled charges. Tested with 50+ edge cases.', project: 'Millennium', createdAt: '2026-04-09T09:15:00Z', xpAwarded: 120,
  },
  {
    id: '3', authorId: 'alan', summary: 'Onboarded 3 new agents this morning. Updated the onboarding checklist in DOME Brain. All 3 submitted their first quotes by EOD.', project: 'Agent Onboarding', createdAt: '2026-04-09T11:00:00Z', xpAwarded: 80,
  },
  {
    id: '4', authorId: 'rudy', summary: 'Launched April email campaign to 2,400 leads. Open rate so far: 34%. Above our 28% benchmark. Added campaign notes to DOME Brain.', project: 'Marketing', createdAt: '2026-04-08T16:00:00Z', xpAwarded: 100,
  },
  {
    id: '5', authorId: 'micah', summary: 'Reconciled March commission reports. Found $2,400 in missed payments — flagged for Steve to review. Updated accounting tracker.', project: 'Commission Tracker', createdAt: '2026-04-08T14:00:00Z', xpAwarded: 90,
  },
  {
    id: '6', authorId: 'furman', summary: 'Ran outreach to 45 cold leads from last months buy list. 8 callbacks booked. Updated Sales Board with all contact attempts.', project: 'Sales Board', createdAt: '2026-04-08T17:00:00Z', xpAwarded: 70,
  },
  {
    id: '7', authorId: 'shayne', summary: 'Migrated plan builder to new API version. Quote generation speed improved by 40%. All existing plans still loading correctly.', project: 'Plan Builder', createdAt: '2026-04-07T15:00:00Z', xpAwarded: 130,
  },
  {
    id: '8', authorId: 'scott', summary: 'Team meeting: reviewed Q1 metrics, set Q2 targets. Key takeaway: need to double agent recruitment efforts. Notes in DOME Brain.', project: 'Strategy', createdAt: '2026-04-07T10:00:00Z', xpAwarded: 60,
  },
  {
    id: '9', authorId: 'steve', summary: 'Closed out Q1 books. Margin better than projected at 34%. Prepped Q2 budget breakdown for Scott to review. Filed everything in DOME Brain.', project: 'Finance', createdAt: '2026-04-08T13:00:00Z', xpAwarded: 95,
  },
];

// ─── WORLD ZONES ──────────────────────────────────────────────────────────────

export const ZONES: Zone[] = [
  {
    id: 'grind_zone',
    name: 'The Grind Zone',
    emoji: '💻',
    color: '#1e3a5f',
    tiles: [
      {x:2,y:2},{x:3,y:2},{x:4,y:2},{x:5,y:2},{x:6,y:2},{x:7,y:2},{x:8,y:2},
      {x:2,y:3},{x:3,y:3},{x:4,y:3},{x:5,y:3},{x:6,y:3},{x:7,y:3},{x:8,y:3},
      {x:2,y:4},{x:3,y:4},{x:4,y:4},{x:5,y:4},{x:6,y:4},{x:7,y:4},{x:8,y:4},
      {x:2,y:5},{x:3,y:5},{x:4,y:5},{x:5,y:5},{x:6,y:5},{x:7,y:5},{x:8,y:5},
      {x:2,y:6},{x:3,y:6},{x:4,y:6},{x:5,y:6},{x:6,y:6},{x:7,y:6},{x:8,y:6},
      {x:2,y:7},{x:3,y:7},{x:4,y:7},{x:5,y:7},{x:6,y:7},{x:7,y:7},{x:8,y:7},
    ],
    description: 'Heads down, work mode. Log your session here.',
    action: 'Log Work',
  },
  {
    id: 'idea_lab',
    name: 'Idea Lab',
    emoji: '💡',
    color: '#1a3a2a',
    tiles: [
      {x:14,y:2},{x:15,y:2},{x:16,y:2},{x:17,y:2},{x:18,y:2},{x:19,y:2},
      {x:14,y:3},{x:15,y:3},{x:16,y:3},{x:17,y:3},{x:18,y:3},{x:19,y:3},
      {x:14,y:4},{x:15,y:4},{x:16,y:4},{x:17,y:4},{x:18,y:4},{x:19,y:4},
      {x:14,y:5},{x:15,y:5},{x:16,y:5},{x:17,y:5},{x:18,y:5},{x:19,y:5},
      {x:14,y:6},{x:15,y:6},{x:16,y:6},{x:17,y:6},{x:18,y:6},{x:19,y:6},
    ],
    description: 'Where ideas become reality. Submit your next big thing.',
    action: 'Submit Idea',
  },
  {
    id: 'war_room',
    name: 'The War Room',
    emoji: '🗺️',
    color: '#3a1a1a',
    tiles: [
      {x:24,y:2},{x:25,y:2},{x:26,y:2},{x:27,y:2},{x:28,y:2},{x:29,y:2},{x:30,y:2},
      {x:24,y:3},{x:25,y:3},{x:26,y:3},{x:27,y:3},{x:28,y:3},{x:29,y:3},{x:30,y:3},
      {x:24,y:4},{x:25,y:4},{x:26,y:4},{x:27,y:4},{x:28,y:4},{x:29,y:4},{x:30,y:4},
      {x:24,y:5},{x:25,y:5},{x:26,y:5},{x:27,y:5},{x:28,y:5},{x:29,y:5},{x:30,y:5},
      {x:24,y:6},{x:25,y:6},{x:26,y:6},{x:27,y:6},{x:28,y:6},{x:29,y:6},{x:30,y:6},
      {x:24,y:7},{x:25,y:7},{x:26,y:7},{x:27,y:7},{x:28,y:7},{x:29,y:7},{x:30,y:7},
    ],
    description: 'Strategy, decisions, and uncomfortable conversations.',
    action: 'Start Meeting',
  },
  {
    id: 'coffee_corner',
    name: 'Coffee Corner',
    emoji: '☕',
    color: '#3a2a0a',
    tiles: [
      {x:2,y:12},{x:3,y:12},{x:4,y:12},{x:5,y:12},
      {x:2,y:13},{x:3,y:13},{x:4,y:13},{x:5,y:13},
      {x:2,y:14},{x:3,y:14},{x:4,y:14},{x:5,y:14},
      {x:2,y:15},{x:3,y:15},{x:4,y:15},{x:5,y:15},
    ],
    description: 'Decompress. Chat. Pretend to work.',
    action: '+ 5 XP Vibe Check',
  },
  {
    id: 'watercooler',
    name: 'Watercooler',
    emoji: '💧',
    color: '#0a1f3a',
    tiles: [
      {x:28,y:12},{x:29,y:12},{x:30,y:12},{x:31,y:12},{x:32,y:12},
      {x:28,y:13},{x:29,y:13},{x:30,y:13},{x:31,y:13},{x:32,y:13},
      {x:28,y:14},{x:29,y:14},{x:30,y:14},{x:31,y:14},{x:32,y:14},
      {x:28,y:15},{x:29,y:15},{x:30,y:15},{x:31,y:15},{x:32,y:15},
    ],
    description: 'Wild rumors and questionable opinions live here.',
    action: 'Drop a Hot Take',
  },
  {
    id: 'trophy_wall',
    name: 'Trophy Wall',
    emoji: '🏆',
    color: '#2a1a3a',
    tiles: [
      {x:2,y:19},{x:3,y:19},{x:4,y:19},{x:5,y:19},{x:6,y:19},{x:7,y:19},
      {x:2,y:20},{x:3,y:20},{x:4,y:20},{x:5,y:20},{x:6,y:20},{x:7,y:20},
      {x:2,y:21},{x:3,y:21},{x:4,y:21},{x:5,y:21},{x:6,y:21},{x:7,y:21},
    ],
    description: 'Where legends are immortalized. Check your rank.',
    action: 'View Leaderboard',
  },
];

// ─── EMOTES ───────────────────────────────────────────────────────────────────

export const EMOTES: Emote[] = [
  { emoji: '👋', label: 'Wave' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '💀', label: 'Dead' },
  { emoji: '🫡', label: 'Salute' },
  { emoji: '🤙', label: 'Shaka' },
  { emoji: '😤', label: 'Grind' },
  { emoji: '🥳', label: 'Party' },
  { emoji: '🫠', label: 'Melt' },
  { emoji: '🤯', label: 'Mind Blown' },
  { emoji: '👀', label: 'Eyes' },
];

// ─── BATTLE SYSTEM ────────────────────────────────────────────────────────────

import type { BattleAction } from '../types';

export const BASE_BATTLE_ACTIONS: BattleAction[] = [
  { id: 'strike',  name: 'Basic Strike',  emoji: '⚔️',  cost: 0,  damageMin: 8,  damageMax: 16, description: 'Reliable. Costs nothing. Gets the job done.' },
  { id: 'power',   name: 'Power Blow',    emoji: '💥',  cost: 15, damageMin: 22, damageMax: 34, description: 'Spend coins for real damage.' },
  { id: 'shield',  name: 'Shield Up',     emoji: '🛡️',  cost: 0,  damageMin: 0,  damageMax: 0,  shieldTurns: 1, description: 'Block 65% of the next hit. Free.' },
  { id: 'potion',  name: 'Coin Potion',   emoji: '🧪',  cost: 30, damageMin: 0,  damageMax: 0,  healAmount: 28, description: 'Restore 28 HP. Crucial when desperate.' },
];

// Role-specific ultimate moves
export const ULTIMATES: Record<string, BattleAction> = {
  'CEO': {
    id: 'ult', name: 'Vision Drop', emoji: '💡', cost: 50, isUltimate: true,
    damageMin: 50, damageMax: 68, critChance: 0.35,
    description: 'The big idea. Reality-warping damage. High crit chance.',
  },
  'Technology Lead': {
    id: 'ult', name: 'Deploy to Prod', emoji: '🚀', cost: 50, isUltimate: true,
    damageMin: 44, damageMax: 58,
    description: 'Ships a bug directly to the opponent. Catastrophic.',
  },
  'Super Admin & HR': {
    id: 'ult', name: 'Performance Review', emoji: '📋', cost: 50, isUltimate: true,
    damageMin: 20, damageMax: 28, healAmount: 30,
    description: 'Demoralizes the enemy AND restores your confidence.',
  },
  'COO & Marketing': {
    id: 'ult', name: 'Go Viral', emoji: '📣', cost: 50, isUltimate: true,
    damageMin: 32, damageMax: 50, critChance: 0.25,
    description: 'Engagement goes through the roof. High variance damage.',
  },
  'Programmer & Analyst': {
    id: 'ult', name: 'Deploy to Prod', emoji: '⚡', cost: 50, isUltimate: true,
    damageMin: 42, damageMax: 56,
    description: 'Executes flawless code on the enemy. No debug needed.',
  },
  'CFO': {
    id: 'ult', name: 'Budget Audit', emoji: '📊', cost: 50, isUltimate: true,
    damageMin: 38, damageMax: 52, stealCoins: 25,
    description: 'Audits their finances. Deals damage AND steals coins.',
  },
  'Compliance & Licensing': {
    id: 'ult', name: 'Cease & Desist', emoji: '⚖️', cost: 50, isUltimate: true,
    damageMin: 44, damageMax: 60,
    description: 'Legally obligated to destroy you. Irresistible force.',
  },
};

export function getBattleMaxHP(level: number): number {
  return 80 + level * 12;
}

export function getBattleActions(role: string): BattleAction[] {
  const ult = ULTIMATES[role] || {
    id: 'ult', name: 'Power Surge', emoji: '⚡', cost: 50, isUltimate: true,
    damageMin: 40, damageMax: 55, description: 'Raw overwhelming force.',
  };
  return [...BASE_BATTLE_ACTIONS, ult];
}

// ─── XP LEVEL CONFIG ──────────────────────────────────────────────────────────

export const LEVEL_TIERS = [
  { min: 1, max: 5, title: 'Rookie', color: '#9ca3af', crown: false, cape: false },
  { min: 6, max: 10, title: 'Regular', color: '#3b82f6', crown: false, cape: false },
  { min: 11, max: 20, title: 'Senior', color: '#8b5cf6', crown: false, cape: true },
  { min: 21, max: 30, title: 'Elite', color: '#f59e0b', crown: true, cape: true },
  { min: 31, max: 50, title: 'Legend', color: '#ef4444', crown: true, cape: true },
];

export function getLevelTier(level: number) {
  return LEVEL_TIERS.find(t => level >= t.min && level <= t.max) || LEVEL_TIERS[0];
}

export function getXpForLevel(level: number): number {
  return Math.floor(500 * Math.pow(1.3, level - 1));
}

// ─── WORLD CONFIG ─────────────────────────────────────────────────────────────

export const WORLD_COLS = 36;
export const WORLD_ROWS = 24;
export const TILE_SIZE = 32;

export const ZONE_TILE_SET = (() => {
  const map: Record<string, Zone> = {};
  for (const zone of ZONES) {
    for (const t of zone.tiles) {
      map[`${t.x},${t.y}`] = zone;
    }
  }
  return map;
})();
