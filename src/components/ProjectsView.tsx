import { useState, useEffect } from 'react';
import { TEAM_MEMBERS, IDEAS } from '../data/gameData';
import { fetchProjectContexts, fetchWorkSummaries, type DBProjectContext, type DBWorkSummary } from '../lib/supabase';
import type { Idea } from '../types';

// ─── PROJECT DATA ─────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  assigneeId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  linkedIdeaId?: string;
}

export interface Project {
  id: string;
  name: string;
  emoji: string;
  description: string;
  status: 'active' | 'planning' | 'completed' | 'on_hold';
  ownerId: string;
  teamIds: string[];
  color: string;
  progress: number; // 0-100
  tasks: Task[];
  linkedIdeaIds: string[];
  startDate: string;
  targetDate: string;
  tags: string[];
}

const PROJECTS: Project[] = [
  {
    id: 'dome-brain',
    name: 'DOME Brain MCP Server',
    emoji: '🧠',
    description: 'Centralized AI brain for the team — all 7 database connections through one Railway-hosted MCP server, accessible from Claude.',
    status: 'active',
    ownerId: 'scott',
    teamIds: ['scott', 'shayne'],
    color: '#6366f1',
    progress: 88,
    startDate: '2026-03-01',
    targetDate: '2026-04-30',
    tags: ['infrastructure', 'ai', 'mcp'],
    linkedIdeaIds: ['2'],
    tasks: [
      { id: 't1', title: 'Deploy server to Railway with all 7 DB connections', status: 'done', assigneeId: 'shayne', priority: 'critical' },
      { id: 't2', title: 'Fix DNS rebinding protection for Railway hostname', status: 'done', assigneeId: 'shayne', priority: 'high' },
      { id: 't3', title: 'Add Claude.ai connector with auth', status: 'done', assigneeId: 'scott', priority: 'high' },
      { id: 't4', title: 'Wire up Mission Control to live data', status: 'in_progress', assigneeId: 'shayne', priority: 'high', dueDate: '2026-04-15' },
      { id: 't5', title: 'Add dome_ideas, dome_badges, dome_xp tables to Supabase', status: 'todo', assigneeId: 'scott', priority: 'medium', dueDate: '2026-04-20' },
      { id: 't6', title: 'Write team onboarding guide + distribute', status: 'done', assigneeId: 'scott', priority: 'medium' },
    ],
  },
  {
    id: 'millennium',
    name: 'Millennium Platform v2',
    emoji: '🏗️',
    description: 'Core insurance platform rebuild — faster quote generation, new agent portal, commission automation.',
    status: 'active',
    ownerId: 'shayne',
    teamIds: ['shayne', 'kat', 'derek'],
    color: '#10b981',
    progress: 62,
    startDate: '2026-01-15',
    targetDate: '2026-06-30',
    tags: ['platform', 'core', 'insurance'],
    linkedIdeaIds: [],
    tasks: [
      { id: 't7', title: 'Migrate to new API version', status: 'done', assigneeId: 'shayne', priority: 'critical' },
      { id: 't8', title: 'Fix commission calculation double-charge bug', status: 'done', assigneeId: 'shayne', priority: 'critical' },
      { id: 't9', title: 'Build new agent portal UI', status: 'in_progress', assigneeId: 'shayne', priority: 'high', dueDate: '2026-05-01' },
      { id: 't10', title: 'Automate monthly commission reports', status: 'in_progress', assigneeId: 'kat', priority: 'high', dueDate: '2026-04-30' },
      { id: 't11', title: 'Load testing — simulate 500 concurrent quotes', status: 'todo', assigneeId: 'shayne', priority: 'medium', dueDate: '2026-05-15' },
      { id: 't12', title: 'Commission transparency view for agents', status: 'todo', assigneeId: 'derek', priority: 'medium', dueDate: '2026-05-30' },
    ],
  },
  {
    id: 'agent-growth',
    name: 'Agent Recruitment Engine',
    emoji: '🚀',
    description: 'Scale agent recruitment from 40 to 200 active agents. Includes automated onboarding, training AI, and tracking dashboards.',
    status: 'active',
    ownerId: 'marcus',
    teamIds: ['marcus', 'jessica', 'priya'],
    color: '#f59e0b',
    progress: 35,
    startDate: '2026-02-01',
    targetDate: '2026-07-31',
    tags: ['growth', 'agents', 'sales'],
    linkedIdeaIds: ['4'],
    tasks: [
      { id: 't13', title: 'Design AI-powered agent onboarding flow', status: 'in_progress', assigneeId: 'priya', priority: 'high', dueDate: '2026-04-25' },
      { id: 't14', title: 'Build agent recruitment landing page', status: 'in_progress', assigneeId: 'jessica', priority: 'high', dueDate: '2026-04-20' },
      { id: 't15', title: 'April cold outreach campaign — 500 leads', status: 'in_progress', assigneeId: 'marcus', priority: 'critical', dueDate: '2026-04-30' },
      { id: 't16', title: 'Create video training library (10 modules)', status: 'todo', assigneeId: 'priya', priority: 'medium', dueDate: '2026-05-15' },
      { id: 't17', title: 'Set up agent performance tracking dashboard', status: 'todo', assigneeId: 'marcus', priority: 'medium', dueDate: '2026-05-30' },
      { id: 't18', title: 'A/B test 3 subject lines on recruitment emails', status: 'blocked', assigneeId: 'jessica', priority: 'medium', dueDate: '2026-04-18' },
    ],
  },
  {
    id: 'marketing',
    name: 'Q2 Marketing Push',
    emoji: '📣',
    description: 'Double inbound leads for Q2. Content calendar, paid campaigns, email sequences, and LinkedIn presence.',
    status: 'active',
    ownerId: 'jessica',
    teamIds: ['jessica', 'marcus'],
    color: '#ec4899',
    progress: 45,
    startDate: '2026-04-01',
    targetDate: '2026-06-30',
    tags: ['marketing', 'leads', 'content'],
    linkedIdeaIds: [],
    tasks: [
      { id: 't19', title: 'April email campaign to 2,400 leads', status: 'done', assigneeId: 'jessica', priority: 'critical' },
      { id: 't20', title: 'Publish 4 LinkedIn articles this month', status: 'in_progress', assigneeId: 'jessica', priority: 'medium', dueDate: '2026-04-30' },
      { id: 't21', title: 'Set up Google Ads campaign ($2k/mo budget)', status: 'todo', assigneeId: 'jessica', priority: 'high', dueDate: '2026-04-22' },
      { id: 't22', title: 'Record 2 agent testimonial videos', status: 'todo', assigneeId: 'marcus', priority: 'medium', dueDate: '2026-05-01' },
    ],
  },
  {
    id: 'mission-control',
    name: 'DOME Mission Control',
    emoji: '🎮',
    description: 'The team OS — isometric world map, gamification, ideas board, battle system, live activity feed. All connected to DOME Brain.',
    status: 'active',
    ownerId: 'scott',
    teamIds: ['scott', 'shayne'],
    color: '#8b5cf6',
    progress: 70,
    startDate: '2026-04-05',
    targetDate: '2026-05-01',
    tags: ['internal', 'gamification', 'tools'],
    linkedIdeaIds: ['1', '7'],
    tasks: [
      { id: 't23', title: 'Build isometric Polytopia-style world map', status: 'done', assigneeId: 'scott', priority: 'high' },
      { id: 't24', title: 'Build 25-badge gamification system', status: 'done', assigneeId: 'scott', priority: 'medium' },
      { id: 't25', title: 'Build ideas board with upvoting', status: 'done', assigneeId: 'scott', priority: 'medium' },
      { id: 't26', title: 'Build coin battle system', status: 'done', assigneeId: 'scott', priority: 'high' },
      { id: 't27', title: 'Connect to DOME Brain live data', status: 'in_progress', assigneeId: 'shayne', priority: 'critical', dueDate: '2026-04-20' },
      { id: 't28', title: 'Projects module with task tracking', status: 'in_progress', assigneeId: 'scott', priority: 'high', dueDate: '2026-04-15' },
      { id: 't29', title: 'Add team-wide Slack notifications for badges', status: 'todo', assigneeId: 'shayne', priority: 'medium', dueDate: '2026-04-25' },
      { id: 't30', title: 'Deploy as hosted web app for the whole team', status: 'todo', assigneeId: 'shayne', priority: 'high', dueDate: '2026-05-01' },
    ],
  },
];

// Ideas that could become projects (open with high votes)
const PIPELINE_IDEAS = IDEAS.filter(i => i.status === 'open' && i.upvotes.length >= 3);

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  active:    { label: 'Active',     color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  planning:  { label: 'Planning',   color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
  completed: { label: 'Completed',  color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  on_hold:   { label: 'On Hold',    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
};

const TASK_STATUS_CFG = {
  todo:        { label: 'To Do',       color: '#6b7280', dot: '○' },
  in_progress: { label: 'In Progress', color: '#6366f1', dot: '◐' },
  done:        { label: 'Done',        color: '#22c55e', dot: '●' },
  blocked:     { label: 'Blocked',     color: '#ef4444', dot: '✕' },
};

const PRIORITY_CFG = {
  low:      { label: 'Low',      color: '#6b7280' },
  medium:   { label: 'Med',      color: '#6366f1' },
  high:     { label: 'High',     color: '#f59e0b' },
  critical: { label: 'Critical', color: '#ef4444' },
};

// ─── HEALTH INDICATOR ─────────────────────────────────────────────────────────

type HealthStatus = 'green' | 'yellow' | 'red' | null;

const HEALTH_CFG: Record<'green' | 'yellow' | 'red', { color: string; label: string; emoji: string }> = {
  green:  { color: '#22c55e', label: 'Active',   emoji: '🟢' },
  yellow: { color: '#f59e0b', label: 'Quiet',    emoji: '🟡' },
  red:    { color: '#ef4444', label: 'Stale',    emoji: '🔴' },
};

function getProjectHealth(projectName: string, summaries: DBWorkSummary[]): HealthStatus {
  if (!summaries.length) return null;
  const nameLower = projectName.toLowerCase();
  const keywords = nameLower.split(/\s+/).filter(w => w.length > 3);
  const matches = summaries.filter(ws => {
    const wsName = ws.project_name.toLowerCase();
    return keywords.some(kw => wsName.includes(kw)) || wsName.includes(nameLower.slice(0, 8));
  });
  if (!matches.length) return null;
  const mostRecent = matches.reduce((a, b) =>
    new Date(a.created_at) > new Date(b.created_at) ? a : b
  );
  const daysSince = Math.floor((Date.now() - new Date(mostRecent.created_at).getTime()) / 86400000);
  if (daysSince < 7)  return 'green';
  if (daysSince < 14) return 'yellow';
  return 'red';
}

function timeToDate(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, color: '#ef4444' };
  if (days === 0) return { label: 'Due today', color: '#f59e0b' };
  if (days <= 3) return { label: `${days}d left`, color: '#f59e0b' };
  return { label: `${days}d`, color: '#6b7280' };
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: Task }) {
  const assignee = TEAM_MEMBERS.find(m => m.id === task.assigneeId);
  const statusCfg = TASK_STATUS_CFG[task.status];
  const priorityCfg = PRIORITY_CFG[task.priority];
  const due = timeToDate(task.dueDate);
  return (
    <div className="flex items-center gap-3 py-1.5 px-3 rounded-lg hover:bg-white/5 transition-colors group">
      <span className="text-sm font-bold shrink-0" style={{ color: statusCfg.color }}>{statusCfg.dot}</span>
      <span className={`flex-1 text-sm ${task.status === 'done' ? 'line-through text-gray-600' : 'text-gray-200'}`}>{task.title}</span>
      {due && task.status !== 'done' && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: due.color + '22', color: due.color }}>{due.label}</span>
      )}
      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: priorityCfg.color + '22', color: priorityCfg.color }}>{priorityCfg.label}</span>
      {assignee && (
        <div title={assignee.name} className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
          style={{ background: assignee.avatarColor }}>
          {assignee.name[0]}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, isExpanded, onToggle, health }: { project: Project; isExpanded: boolean; onToggle: () => void; health: HealthStatus }) {
  const owner = TEAM_MEMBERS.find(m => m.id === project.ownerId);
  const statusCfg = STATUS_CFG[project.status];
  const doneTasks = project.tasks.filter(t => t.status === 'done').length;
  const totalTasks = project.tasks.length;
  const blockedCount = project.tasks.filter(t => t.status === 'blocked').length;
  const healthCfg = health ? HEALTH_CFG[health] : null;

  const sortedTasks = [...project.tasks].sort((a, b) => {
    const order = { blocked: 0, in_progress: 1, todo: 2, done: 3 };
    return order[a.status] - order[b.status];
  });

  return (
    <div className="rounded-xl overflow-hidden transition-all" style={{ border: `1px solid ${project.color}33`, background: 'rgba(0,0,0,0.35)' }}>
      {/* Header */}
      <button className="w-full text-left p-4 flex items-start gap-3" onClick={onToggle}>
        {/* Emoji + name */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ background: project.color + '22', border: `1px solid ${project.color}44` }}>
          {project.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white text-sm">{project.name}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: statusCfg.bg, color: statusCfg.color }}>{statusCfg.label}</span>
            {blockedCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-500/20 text-red-400">⚠️ {blockedCount} blocked</span>
            )}
            {healthCfg && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: healthCfg.color + '22', color: healthCfg.color, border: `1px solid ${healthCfg.color}44` }}
                title={`DOME Brain activity: ${healthCfg.label}`}
              >{healthCfg.emoji} {healthCfg.label}</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{project.description}</p>

          {/* Progress bar */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${project.progress}%`, background: `linear-gradient(90deg, ${project.color}, ${project.color}bb)`, boxShadow: `0 0 6px ${project.color}66` }} />
            </div>
            <span className="text-[11px] font-bold shrink-0" style={{ color: project.color }}>{project.progress}%</span>
            <span className="text-[10px] text-gray-500">{doneTasks}/{totalTasks} tasks</span>
          </div>
        </div>

        {/* Team avatars + dates */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex -space-x-1">
            {project.teamIds.map(id => {
              const m = TEAM_MEMBERS.find(x => x.id === id);
              return m ? (
                <div key={id} title={m.name} className="w-6 h-6 rounded-full border-2 border-black flex items-center justify-center text-white text-[9px] font-bold"
                  style={{ background: m.avatarColor }}>{m.name[0]}</div>
              ) : null;
            })}
          </div>
          <div className="text-[10px] text-gray-500">Due {new Date(project.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
        </div>
      </button>

      {/* Expanded task list */}
      {isExpanded && (
        <div className="px-3 pb-3 flex flex-col gap-0.5 border-t border-white/5 pt-2">
          {/* Tags */}
          <div className="flex gap-1 flex-wrap mb-2">
            {project.tags.map(t => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500">{t}</span>
            ))}
            {project.linkedIdeaIds.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>💡 {project.linkedIdeaIds.length} linked ideas</span>
            )}
          </div>
          {sortedTasks.map(task => <TaskRow key={task.id} task={task} />)}
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

function statusToProjectStatus(s: string): Project['status'] {
  if (s === 'active' || s === 'in_progress') return 'active';
  if (s === 'completed' || s === 'done') return 'completed';
  if (s === 'on_hold' || s === 'paused') return 'on_hold';
  return 'planning';
}

const PROJECT_COLORS = ['#6366f1','#10b981','#f59e0b','#ec4899','#06b6d4','#8b5cf6','#ef4444','#22c55e'];

export default function ProjectsView() {
  const [expandedId, setExpandedId] = useState<string | null>('mission-control');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [promotingIdeaId, setPromotingIdeaId] = useState<string | null>(null);
  const [promotedIdeas, setPromotedIdeas] = useState<Set<string>>(new Set());
  const [liveProjects, setLiveProjects] = useState<DBProjectContext[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [workSummaries, setWorkSummaries] = useState<DBWorkSummary[]>([]);

  useEffect(() => {
    fetchProjectContexts().then(data => {
      setLiveProjects(data);
      setLiveLoading(false);
    });
    fetchWorkSummaries(100).then(data => setWorkSummaries(data));
  }, []);

  // Convert live DOME Brain projects → Project cards (no tasks, just context)
  const brainProjects: Project[] = liveProjects
    .filter(lp => !PROJECTS.some(p => p.name.toLowerCase() === lp.project_name.toLowerCase()))
    .map((lp, i) => ({
      id: `brain_${lp.id}`,
      name: lp.project_name,
      emoji: '🧠',
      description: lp.description || lp.goals || 'Active DOME Brain project',
      status: statusToProjectStatus(lp.status),
      ownerId: TEAM_MEMBERS.find(m => m.name.toLowerCase() === (lp.owner || '').toLowerCase())?.id || 'scott',
      teamIds: (lp.collaborators || '').split(',').map(s => {
        const name = s.trim().toLowerCase();
        return TEAM_MEMBERS.find(m => m.name.toLowerCase().startsWith(name))?.id || '';
      }).filter(Boolean),
      color: PROJECT_COLORS[i % PROJECT_COLORS.length],
      progress: lp.status === 'completed' ? 100 : lp.status === 'active' || lp.status === 'in_progress' ? 60 : 20,
      tasks: [],
      linkedIdeaIds: [],
      startDate: lp.created_at?.split('T')[0] || '2026-01-01',
      targetDate: '',
      tags: ['dome-brain'],
      isLive: true,
    } as Project & { isLive?: boolean }));

  const allProjects = [...PROJECTS, ...brainProjects];

  const filtered = statusFilter === 'all'
    ? allProjects
    : allProjects.filter(p => p.status === statusFilter);

  // Stats
  const totalTasks = PROJECTS.flatMap(p => p.tasks).length;
  const doneTasks = PROJECTS.flatMap(p => p.tasks).filter(t => t.status === 'done').length;
  const inProgress = PROJECTS.flatMap(p => p.tasks).filter(t => t.status === 'in_progress').length;
  const blockedTasks = PROJECTS.flatMap(p => p.tasks).filter(t => t.status === 'blocked').length;

  return (
    <div className="flex gap-4 h-full overflow-hidden">
      {/* Main project list */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 shrink-0">
          {[
            { label: 'Active Projects', value: allProjects.filter(p => p.status === 'active').length, color: '#22c55e', emoji: '🚀' },
            { label: 'Tasks Done', value: `${doneTasks}/${totalTasks}`, color: '#6366f1', emoji: '✅' },
            { label: 'In Progress', value: inProgress, color: '#f59e0b', emoji: '⚡' },
            { label: 'Blocked', value: blockedTasks, color: '#ef4444', emoji: '⚠️', urgent: blockedTasks > 0 },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${s.urgent ? s.color + '55' : 'rgba(255,255,255,0.08)'}` }}>
              <div className="text-xl">{s.emoji}</div>
              <div className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs font-medium text-white mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 shrink-0">
          {['all', 'active', 'planning', 'on_hold', 'completed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors capitalize"
              style={statusFilter === s
                ? { background: 'rgba(99,102,241,0.35)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.5)' }
                : { background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
              {s === 'all' ? '🗂️ All' : STATUS_CFG[s as keyof typeof STATUS_CFG]?.label || s}
            </button>
          ))}
        </div>

        {/* Projects */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
          {liveLoading && brainProjects.length === 0 && (
            <div className="text-xs text-gray-600 animate-pulse px-1">Loading DOME Brain projects...</div>
          )}
          {filtered.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              isExpanded={expandedId === p.id}
              onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
              health={getProjectHealth(p.name, workSummaries)}
            />
          ))}
        </div>
      </div>

      {/* Right sidebar — pipeline */}
      <div className="w-64 flex flex-col gap-3 overflow-y-auto shrink-0">
        <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">💡 Ideas Pipeline</div>
          <div className="text-[10px] text-gray-500 mb-3">High-vote ideas ready to become projects</div>
          <div className="flex flex-col gap-2">
            {PIPELINE_IDEAS.filter(i => !promotedIdeas.has(i.id)).map(idea => {
              const author = TEAM_MEMBERS.find(m => m.id === idea.authorId);
              return (
                <div key={idea.id} className="rounded-lg p-2.5" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <div className="text-xs font-semibold text-white leading-tight mb-1">{idea.title}</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center text-white"
                        style={{ background: author?.avatarColor }}>{author?.name[0]}</div>
                      <span className="text-[10px] text-gray-500">{idea.upvotes.length} votes</span>
                    </div>
                    <button
                      onClick={() => {
                        setPromotedIdeas(s => new Set([...s, idea.id]));
                        setPromotingIdeaId(null);
                      }}
                      className="text-[10px] px-2 py-0.5 rounded-md font-bold transition-colors hover:scale-105"
                      style={{ background: 'rgba(99,102,241,0.3)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.4)' }}>
                      → Project
                    </button>
                  </div>
                </div>
              );
            })}
            {PIPELINE_IDEAS.filter(i => !promotedIdeas.has(i.id)).length === 0 && (
              <div className="text-xs text-gray-600 text-center py-2">All ideas promoted! 🎉</div>
            )}
          </div>
        </div>

        {/* Quick task status overview */}
        <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Team Load</div>
          {TEAM_MEMBERS.filter(m => m.status !== 'offline').map(m => {
            const myTasks = PROJECTS.flatMap(p => p.tasks).filter(t => t.assigneeId === m.id);
            const open = myTasks.filter(t => t.status !== 'done').length;
            const blocked = myTasks.filter(t => t.status === 'blocked').length;
            return (
              <div key={m.id} className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                  style={{ background: m.avatarColor }}>{m.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-medium text-white truncate">{m.name}</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500/70" style={{ width: `${Math.min(100, open * 16)}%` }} />
                    </div>
                    <span className="text-[9px] text-gray-500 shrink-0">{open} open</span>
                    {blocked > 0 && <span className="text-[9px] text-red-400 shrink-0">⚠️{blocked}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
