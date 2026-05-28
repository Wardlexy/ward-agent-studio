/**
 * config.ts — shared configuration constants
 *
 * Reads boss settings from office.config.json in the project root.
 * Users can customise their boss name, sprite, and colour there.
 */

import userConfig from '../office.config.example.json'

type UserConfig = {
  boss?: { name?: string; sprite?: string; color?: string; emoji?: string }
}

const config = userConfig as UserConfig

const bossName   = config.boss?.name   ?? 'Boss'
const bossSprite = config.boss?.sprite ?? 'Me-1'
const bossColor  = config.boss?.color  ?? '#ff4444'
const bossEmoji  = config.boss?.emoji  ?? '👑'

// The boss — always in the office
export const BOSS_CHAR = bossSprite
export const BOSS_ROLE = 'boss'
export const BOSS_NAME = bossName
export const BOSS_COLOR = bossColor
export const BOSS_EMOJI = bossEmoji

// Map agent roles to character sprite base names (in /sprites/characters/)
export const ROLE_TO_CHAR: Record<string, string> = {
  'boss':                  bossSprite,
  'assistant':             'Claude-1',
  'debugger':              'astronaut-1',
  'code-reviewer':         'employee-1',
  'frontend-developer':    'Frontend-dev-1',
  'fullstack-developer':   'dev-2',
  'test-engineer':         'employee-2',
  'security-auditor':      'security-audit-1',
  'devops-engineer':       'employee-3',
  'architect-reviewer':    'employee-1',
  'performance-engineer':  'employee-2',
  'database-architect':    'employee-3',
  'typescript-pro':        'employee-1',
  'ai-engineer':           'dev-2',
  'prompt-engineer':       'dev-2',
  'idea-agent':            'employee-1',
  'builder-agent':         'astronaut-1',
  'designer-agent':        'Frontend-dev-1',
  'researcher-agent':      'explore-1',
  'tutor-agent':           'employee-2',
  'qa-agent':              'security-audit-1',
  'archivist-agent':       'employee-3',
  'launcher-agent':        'dev-2',
  'station-ops-captain':   'orbit-pirate-1',
  'station-systems-engineer': 'orbit-monk-1',
  'station-coordinator':   'orbit-cardigan-1',
  'station-mission-specialist': 'orbit-elegant-astronaut-1',
  'station-field-tech':    'astronaut-1',
  'general-purpose':       'employee-3',
  'Explore':               'explore-1',
  // MCPs
  'github':                'employee-3',
  'supabase':              'Frontend-dev-1',
  'playwright':            'employee-2',
  'chrome':                'employee-1',
  'memory':                'dev-2',
  'seo':                   'Frontend-dev-1',
  'gmail':                 'dev-1',
  'ios-simulator':         'security-audit-1',
}
