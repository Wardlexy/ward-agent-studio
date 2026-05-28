import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import './styles/office.css'
import './styles/rooms.css'
import SlackChat, { ChatMessage } from './components/SlackChat'
import Character from './components/Character'
import FurnitureRenderer from './components/FurnitureRenderer'
import AgentInspector from './components/AgentInspector'
import MissionQueue from './components/MissionQueue'
import RoomPropPanel from './components/RoomPropPanel'
import WardMissionControl from './components/WardMissionControl'
import { Agent, OfficeEvent, AGENT_CONFIGS } from './types'
import { getCurrentPhase, getPhaseLabel, type DayPhase } from './daylight'
import { ROOMS, type RoomId } from './rooms'
import type { RoomPropKind } from './ops/types'
import { createDemoMissions } from './ops/missions'
import { advanceMissions, getTaskForAgent, statusLabel } from './ops/agentOps'
import { createMissionFromTemplate } from './portfolio/missionTemplates'
import { useAgentSocket } from './hooks/useAgentSocket'
import * as sfx from './sounds'
import {
  assignSpot,
  createAgent,
  stepToward,
  findWaypointPath,
  WALK_SPEED,
  BREAK_MIN_DESK_TIME,
  BREAK_CHANCE_PER_SEC,
  BREAK_DURATION,
  spawnMessage,
  workMessage,
  doneMessage,
  coffeeMessage,
  waterMessage,
} from './agentManager'
import { BOSS_ROLE, BOSS_NAME } from './config'
import { pickEvent } from './events'
import { getInteraction } from './interactions'
import {
  useTheme, getRoomImage, getAngelaCat, getTheme,
  OFFICE_SIM_TOOL_MESSAGES, OFFICE_SIM_BOSS_PROMPTS,
  assignCharacterToRole, releaseRole, nextUnusedOfficeCharacter, displayNameFromSlug,
} from './theme'

// ---------------------------------------------------------------------------
// Placement helper — loaded via ?helper query param
// ---------------------------------------------------------------------------
const PlacementHelper = lazy(() => import('./components/PlacementHelper'))
const params = new URLSearchParams(window.location.search)
const isHelperMode = params.has('helper')
const isSimMode = params.has('sim') || params.has('video')
const isVideoMode = params.has('video')
// Why: allow ?theme=office on demo/sim URLs to preload Dunder Mifflin mode
import { setTheme as _setTheme } from './theme'
if (params.get('theme') === 'office') { _setTheme('office') }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeNow(): string {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

let nextMsgId = 1
function makeMsgId() { return nextMsgId++ }

// Room spots for main office
const MAIN_ROOM = ROOMS['main-office']
const STATION_ROOM = ROOMS['station-command']
const QUANTUM_ROOM = ROOMS['quantum-core']
const GREENHOUSE_ROOM = ROOMS['orbital-greenhouse']
const ENTRY = MAIN_ROOM.entryPoint           // door position (%)
const COFFEE_SPOT = MAIN_ROOM.agentSpots.find(s => s.type === 'coffee') ?? null
const WATER_SPOTS  = MAIN_ROOM.agentSpots.filter(s => s.type === 'water')

// Agent that is walking toward door to leave has this as targetPosition
const DOOR_TARGET = { x: ENTRY.x, y: ENTRY.y }

const FILING_SPOT = MAIN_ROOM.agentSpots.find(s => s.type === 'filing') ?? null

/**
 * Compute a pathQueue from one position to another using the main-office
 * waypoint graph.  Returns an array of intermediate {x,y} steps — the agent
 * should walk through each in order, then continue straight to targetPosition.
 */
function computePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  roomId: RoomId = 'main-office',
): { x: number; y: number }[] {
  const waypoints = ROOMS[roomId].waypoints ?? []
  if (waypoints.length === 0) {
    console.warn(`[pathfinding] No waypoints loaded for ${roomId}!`)
    return []
  }
  const path = findWaypointPath(from.x, from.y, to.x, to.y, waypoints)
  console.log(`[pathfinding:${roomId}] from (${from.x.toFixed(1)},${from.y.toFixed(1)}) to (${to.x.toFixed(1)},${to.y.toFixed(1)}) → ${path.length} waypoints`, path)
  return path
}

// Roles that go to the filing cabinet instead of their desk (browsing codebase)
const FILING_ROLES = new Set(['Explore', 'general-purpose', 'researcher-agent', 'archivist-agent'])

// The boss — always in the office, permanent desk (spot-1)
const BOSS_ID = `boss-${BOSS_NAME.toLowerCase()}`
const BOSS_SPOT = MAIN_ROOM.agentSpots.find(s => s.id === 'spot-1') ?? MAIN_ROOM.agentSpots.find(s => s.type === 'desk') ?? null

function createBoss(): Agent {
  const cfg = AGENT_CONFIGS[BOSS_ROLE] ?? AGENT_CONFIGS['default']
  const spot = BOSS_SPOT ?? { id: 'spot-temp', type: 'desk' as const, x: 28.9, y: 66 }
  const entry = MAIN_ROOM.entryPoint
  const target = { x: spot.x, y: spot.y }
  return {
    id: BOSS_ID,
    name: cfg.title,
    type: 'subagent',
    role: BOSS_ROLE,
    state: 'new-hire',
    position: { x: entry.x, y: entry.y },
    targetPosition: target,
    deskPosition: target,
    room: 'main-office',
    assignedRoom: 'main-office',
    assignedSpotId: spot.id,
    spriteFacing: spot.spriteFacing,
    task: 'Running the show',
    statusText: 'clocked in',
    color: cfg.color,
    emoji: cfg.emoji,
    hiredAt: Date.now(),
    pathQueue: computePath(entry, target),
  }
}

// Codex — the assistant, always in the office at spot-2
const CLAUDE_ID = 'assistant-claude'
const CLAUDE_ROLE = 'assistant'
const CLAUDE_SPOT = MAIN_ROOM.agentSpots.find(s => s.id === 'spot-2') ?? null

function createCodex(): Agent {
  const cfg = AGENT_CONFIGS[CLAUDE_ROLE] ?? AGENT_CONFIGS['default']
  const spot = CLAUDE_SPOT ?? { id: 'spot-2', type: 'desk' as const, x: 37.9, y: 68.2, spriteFacing: 'rear-right' as const }
  const entry = MAIN_ROOM.entryPoint
  const target = { x: spot.x, y: spot.y }
  return {
    id: CLAUDE_ID,
    name: cfg.title,
    type: 'subagent',
    role: CLAUDE_ROLE,
    state: 'new-hire',
    position: { x: entry.x, y: entry.y },
    targetPosition: target,
    deskPosition: target,
    room: 'main-office',
    assignedRoom: 'main-office',
    assignedSpotId: spot.id,
    spriteFacing: spot.spriteFacing,
    task: 'Office assistant',
    statusText: 'clocked in',
    color: cfg.color,
    emoji: cfg.emoji,
    hiredAt: Date.now() + 500, // arrives just after the boss
    pathQueue: computePath(entry, target),
  }
}

const STATION_CREW = [
  { id: 'station-ops-captain', role: 'station-ops-captain', spotId: 'station-ops', task: 'Polishing portfolio stories' },
  { id: 'station-systems-engineer', role: 'station-systems-engineer', spotId: 'station-systems', task: 'Planning build work' },
  { id: 'station-coordinator', role: 'station-coordinator', spotId: 'station-strategy', task: 'Keeping the mission plan tidy' },
  { id: 'station-mission-specialist', role: 'station-mission-specialist', spotId: 'station-research', task: 'Researching ideas and job targets' },
  { id: 'station-field-tech', role: 'station-field-tech', spotId: 'station-field', task: 'Testing portfolio flows' },
] as const

function createStationCrew(): Agent[] {
  return STATION_CREW.map((crew, index) => {
    const cfg = AGENT_CONFIGS[crew.role] ?? AGENT_CONFIGS['default']
    const spot = STATION_ROOM.agentSpots.find(s => s.id === crew.spotId) ?? STATION_ROOM.agentSpots[index]
    const position = { x: spot.x, y: spot.y }
    return {
      id: crew.id,
      name: cfg.title,
      type: 'subagent',
      role: crew.role,
      state: 'working' as const,
      position,
      targetPosition: position,
      deskPosition: position,
      room: 'station-command',
      assignedRoom: 'station-command',
      assignedSpotId: spot.id,
      spriteFacing: spot.spriteFacing,
      task: crew.task,
      statusText: 'on station',
      color: cfg.color,
      emoji: cfg.emoji,
      hiredAt: Date.now() + index,
      pathQueue: [],
    }
  })
}

const QUANTUM_CREW = [
  { id: 'quantum-ops-captain', role: 'station-ops-captain', spotId: 'quantum-left-console', task: 'Packaging project proof' },
  { id: 'quantum-systems-engineer', role: 'station-systems-engineer', spotId: 'quantum-reactor-left', task: 'Building app features' },
  { id: 'quantum-coordinator', role: 'station-coordinator', spotId: 'quantum-front-left', task: 'Coordinating lab procedures' },
  { id: 'quantum-mission-specialist', role: 'station-mission-specialist', spotId: 'quantum-reactor-right', task: 'Researching implementation options' },
  { id: 'quantum-field-tech', role: 'station-field-tech', spotId: 'quantum-front-right', task: 'Running UI smoke checks' },
] as const

function createQuantumCrew(): Agent[] {
  return QUANTUM_CREW.map((crew, index) => {
    const cfg = AGENT_CONFIGS[crew.role] ?? AGENT_CONFIGS['default']
    const spot = QUANTUM_ROOM.agentSpots.find(s => s.id === crew.spotId) ?? QUANTUM_ROOM.agentSpots[index]
    const position = { x: spot.x, y: spot.y }
    return {
      id: crew.id,
      name: cfg.title,
      type: 'subagent',
      role: crew.role,
      state: 'working' as const,
      position,
      targetPosition: position,
      deskPosition: position,
      room: 'quantum-core',
      assignedRoom: 'quantum-core',
      assignedSpotId: spot.id,
      spriteFacing: spot.spriteFacing,
      task: crew.task,
      statusText: 'in lab',
      color: cfg.color,
      emoji: cfg.emoji,
      hiredAt: Date.now() + index,
      pathQueue: [],
    }
  })
}

const GREENHOUSE_CREW = [
  { id: 'greenhouse-ops-captain', role: 'station-ops-captain', spotId: 'greenhouse-wall-left', task: 'Curating portfolio ideas' },
  { id: 'greenhouse-systems-engineer', role: 'station-systems-engineer', spotId: 'greenhouse-bio-left', task: 'Shaping buildable concepts' },
  { id: 'greenhouse-coordinator', role: 'station-coordinator', spotId: 'greenhouse-front-console', task: 'Scheduling learning sprints' },
  { id: 'greenhouse-mission-specialist', role: 'station-mission-specialist', spotId: 'greenhouse-right-row', task: 'Growing research notes' },
  { id: 'greenhouse-field-tech', role: 'station-field-tech', spotId: 'greenhouse-right-lower-row', task: 'Checking demo readiness' },
] as const

function createGreenhouseCrew(): Agent[] {
  return GREENHOUSE_CREW.map((crew, index) => {
    const cfg = AGENT_CONFIGS[crew.role] ?? AGENT_CONFIGS['default']
    const spot = GREENHOUSE_ROOM.agentSpots.find(s => s.id === crew.spotId) ?? GREENHOUSE_ROOM.agentSpots[index]
    const position = { x: spot.x, y: spot.y }
    return {
      id: crew.id,
      name: cfg.title,
      type: 'subagent',
      role: crew.role,
      state: 'working' as const,
      position,
      targetPosition: position,
      deskPosition: position,
      room: 'orbital-greenhouse',
      assignedRoom: 'orbital-greenhouse',
      assignedSpotId: spot.id,
      spriteFacing: spot.spriteFacing,
      task: crew.task,
      statusText: 'in greenhouse',
      color: cfg.color,
      emoji: cfg.emoji,
      hiredAt: Date.now() + index,
      pathQueue: [],
    }
  })
}

const ROOM_PROP_HOTSPOTS: Array<{
  id: string
  roomId: RoomId
  kind: RoomPropKind
  label: string
  position: { x: number; y: number }
}> = [
  { id: 'office-today-board', roomId: 'main-office', kind: 'today', label: 'Ward Mission Control', position: { x: 80, y: 42 } },
  { id: 'station-mission-console', roomId: 'station-command', kind: 'mission', label: 'Mission Queue', position: { x: 55, y: 55 } },
  { id: 'quantum-build-console', roomId: 'quantum-core', kind: 'build', label: 'Build/Test Logs', position: { x: 50, y: 58 } },
  { id: 'greenhouse-idea-pod', roomId: 'orbital-greenhouse', kind: 'ideas', label: 'Ideas / Research Backlog', position: { x: 50, y: 57 } },
]

// How close (in %-units) an agent must be to their target before we consider
// them "arrived"
const ARRIVAL_THRESHOLD = 0.3

// ---------------------------------------------------------------------------
// Per-agent runtime metadata (not stored in Agent itself to avoid re-renders)
// ---------------------------------------------------------------------------
// Minimum time (ms) an agent stays visible after spawning before they can leave
const MIN_VISIBLE_TIME = 30_000

interface AgentMeta {
  /** Timestamp when agent spawned */
  spawnedAt: number
  /** Timestamp when agent arrived at their desk */
  arrivedAtDeskAt: number | null
  /** Timestamp when agent entered idle state */
  idleSince: number | null
  /** Is agent currently on a break (coffee/water) */
  onBreak: boolean
  /** When the break started */
  breakStartedAt: number | null
}

// ---------------------------------------------------------------------------
// Side-effect descriptor — computed during state updates, flushed after
// ---------------------------------------------------------------------------
type SfxEffect = 'doorOpen' | 'typing' | 'celebration' | 'coffee' | 'alarm' | 'error' | 'powerDown' | 'notification'

interface PendingEffect {
  msg?: { sender: string; role: string; color: string; text: string; isSystem?: boolean }
  sfx?: SfxEffect
  furnitureState?: { id: string; state: string }
}

// ---------------------------------------------------------------------------
// App component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Cinematic simulation data — realistic agent activity for screen recording
// ---------------------------------------------------------------------------
const SIM_SCENARIOS = [
  {
    role: 'idea-agent',
    task: 'Turning a messy idea into a tiny project plan',
    slackMessages: [
      'scanning the idea pile...',
      'found 3 possible app ideas: habit tracker, asset lab, mini finance board',
      'ranking by easiest to finish this week',
      'turning the best one into a 5-step build plan',
      'project brief ready — small enough to actually finish',
    ],
  },
  {
    role: 'designer-agent',
    task: 'Making the next project look clean before coding starts',
    slackMessages: [
      'collecting visual references for the interface',
      'choosing a simple palette that will not fight the room art',
      'drafting component style rules: compact, readable, not cluttered',
      'checking mobile layout before we overbuild it',
      'visual direction ready for Builder',
    ],
  },
  {
    role: 'builder-agent',
    task: 'Building a useful first version from the project brief',
    slackMessages: [
      'setting up the first screen and core interaction',
      'keeping scope tiny: one clear workflow first',
      'adding empty states so it does not feel broken',
      'found one rough edge in the interaction flow',
      'first usable version ready for Tester',
    ],
  },
]

// Extra random slack chatter between agents
const SIM_CHATTER = [
  { sender: 'Inventor', role: 'idea-agent', msg: 'new mission idea: tiny app that tracks what you learned today' },
  { sender: 'Researcher', role: 'researcher-agent', msg: 'found two good references, ignoring the overcomplicated ones' },
  { sender: 'Designer', role: 'designer-agent', msg: 'visual rule: clean, cozy, no random clutter' },
  { sender: 'Builder', role: 'builder-agent', msg: 'I can make the first version in one screen' },
  { sender: 'Tutor', role: 'tutor-agent', msg: 'I can explain the code after Builder finishes' },
  { sender: 'Tester', role: 'qa-agent', msg: 'I will click through it like a confused user' },
  { sender: 'Archivist', role: 'archivist-agent', msg: 'saving the decision log so we do not forget why' },
  { sender: 'Launcher', role: 'launcher-agent', msg: 'when it works, I will prep README and screenshots' },
  { sender: 'Codex', role: 'assistant', msg: 'best next move: one small useful thing, not ten cool unfinished things' },
  { sender: 'Inventor', role: 'idea-agent', msg: 'scope check: can this be useful in 30 minutes?' },
  { sender: 'Researcher', role: 'researcher-agent', msg: 'checking if someone already solved this better' },
  { sender: 'Designer', role: 'designer-agent', msg: 'button labels are readable, layout still calm' },
  { sender: 'Builder', role: 'builder-agent', msg: 'first draft compiled, now making it less embarrassing' },
  { sender: 'Tutor', role: 'tutor-agent', msg: 'noting the part worth learning from this build' },
  { sender: 'Ward', role: 'boss', msg: 'what can we make today that is actually useful?' },
  { sender: 'Ward', role: 'boss', msg: 'keep it simple, make it real' },
  { sender: 'Ward', role: 'boss', msg: 'show me the smallest working version' },
]

// Dunder Mifflin themed chatter — used when /the-office is active
const OFFICE_SIM_CHATTER = [
  { sender: 'Debugger', role: 'debugger', msg: 'found a bug in the system — Creed. again.' },
  { sender: 'Frontend', role: 'frontend-developer', msg: 'new catalog brochure looks cleaner than Dwight\'s desk' },
  { sender: 'Security', role: 'security-auditor', msg: 'heads up — Dwight is conducting another surprise fire drill' },
  { sender: 'Reviewer', role: 'code-reviewer', msg: 'the ream count checks out. approved.' },
  { sender: 'DBA', role: 'database-architect', msg: 'indexed the client list alphabetically. like the old days.' },
  { sender: 'DevOps', role: 'devops-engineer', msg: 'loading the delivery truck — Schrute beet vans.' },
  { sender: 'Codex', role: 'assistant', msg: 'Michael is in the conference room. again. please help.' },
  { sender: 'Tester', role: 'test-engineer', msg: 'tested the paper quality. still paper. 94% paper.' },
  { sender: 'PerfEng', role: 'performance-engineer', msg: 'the printer warms up 200ms faster. small wins.' },
  { sender: 'Frontend', role: 'frontend-developer', msg: 'mobile layout works — even Creed noticed' },
  { sender: 'Codex', role: 'assistant', msg: 'someone get the printer, it\'s on fire. literal fire.' },
  { sender: 'Architect', role: 'architect-reviewer', msg: 'the Finer Things Club charter is immaculate' },
  { sender: 'AI Eng', role: 'ai-engineer', msg: 'teaching the copier to recognize Stanley\'s handwriting' },
  { sender: 'TS Pro', role: 'typescript-pro', msg: 'false. that is not a staple. it is a Dwight.' },
  { sender: 'Antony', role: 'boss', msg: "anyone want to go to Chili's? I got Baby Back Ribs on the brain." },
  { sender: 'Antony', role: 'boss', msg: 'ship it. we\'ll fix it in prod. PARKOUR!' },
  { sender: 'Antony', role: 'boss', msg: 'how many reams did we move today?' },
  { sender: 'Antony', role: 'boss', msg: "I'm not superstitious, but I am a little stitious." },
  { sender: 'Debugger', role: 'debugger', msg: 'Bears. Beets. Battlestar Galactica.' },
  { sender: 'Security', role: 'security-auditor', msg: 'Identity theft is not a joke, Jim! Millions of families suffer every year!' },
  { sender: 'Reviewer', role: 'code-reviewer', msg: "that's what she said" },
  { sender: 'Frontend', role: 'frontend-developer', msg: 'I feel God in this Chili\'s tonight' },
  { sender: 'Tester', role: 'test-engineer', msg: 'Would I rather be feared or loved? Easy. Both.' },
  { sender: 'DevOps', role: 'devops-engineer', msg: 'I declare BANKRUPTCY' },
]

const App: React.FC = () => {
  // All hooks must be at the top — before any conditional returns.
  const theme = useTheme() // Why: re-render rooms + agents when /the-office toggles
  const [currentRoom, setCurrentRoom] = useState<RoomId>('main-office')
  const [roomTransitioning, setRoomTransitioning] = useState(false)
  const [agents, setAgents] = useState<Agent[]>(() => [createBoss(), createCodex()])
  const [stationAgents, setStationAgents] = useState<Agent[]>(() => createStationCrew())
  const [quantumAgents, setQuantumAgents] = useState<Agent[]>(() => createQuantumCrew())
  const [greenhouseAgents, setGreenhouseAgents] = useState<Agent[]>(() => createGreenhouseCrew())
  const [missionTasks, setMissionTasks] = useState(() => createDemoMissions())
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [openRoomProp, setOpenRoomProp] = useState<RoomPropKind | null>(null)
  const [missionQueueOpen, setMissionQueueOpen] = useState(false)
  const [wardMissionOpen, setWardMissionOpen] = useState(false)
  const agentMetaRef = useRef<Map<string, AgentMeta>>(new Map([
    [BOSS_ID, { spawnedAt: Date.now(), arrivedAtDeskAt: Date.now(), idleSince: null, onBreak: false, breakStartedAt: null }],
    [CLAUDE_ID, { spawnedAt: Date.now(), arrivedAtDeskAt: Date.now(), idleSince: null, onBreak: false, breakStartedAt: null }],
  ]))

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatTypingUser, setChatTypingUser] = useState<string | null>(null)
  const [lastSeenId, setLastSeenId] = useState<number | null>(null)
  const [muted, setMuted] = useState(false)
  const [dayPhase, setDayPhase] = useState<DayPhase>(getCurrentPhase())
  const [dayNightMode, setDayNightMode] = useState<'auto' | 'day' | 'night'>('auto')

  // Compressed day cycle: 10 min = 24 hours
  // nightOpacity: 0 = full day, 1 = full night
  const [nightOpacity, setNightOpacity] = useState(0)

  // Track interactive furniture state (coffee on/off, filing open/closed)
  const [furnitureStates, setFurnitureStates] = useState<Record<string, string>>({})

  // Visual flicker state for power-flicker event
  const [flickering, setFlickering] = useState(false)

  // Boss interaction cooldowns
  const interactionCooldowns = useRef<Map<string, number>>(new Map())

  // Boss interaction effect (shown above boss character)
  const [bossEffect, setBossEffect] = useState<string | null>(null)
  const currentRoomDef = ROOMS[currentRoom]
  const isStationRoom = currentRoom === 'station-command'
  const isQuantumRoom = currentRoom === 'quantum-core'
  const isGreenhouseRoom = currentRoom === 'orbital-greenhouse'
  const isMainOfficeRoom = currentRoom === 'main-office'
  const allOpsAgents = useMemo(
    () => [...agents, ...stationAgents, ...quantumAgents, ...greenhouseAgents],
    [agents, stationAgents, quantumAgents, greenhouseAgents],
  )
  const selectedAgent = selectedAgentId
    ? allOpsAgents.find(agent => agent.id === selectedAgentId) ?? null
    : null
  const selectedAgentTask = selectedAgent ? getTaskForAgent(selectedAgent, missionTasks) : undefined

  const handleFurnitureClick = useCallback((itemId: string) => {
    const interaction = getInteraction(itemId)
    if (!interaction) return

    // Check cooldown
    const now = Date.now()
    const lastUsed = interactionCooldowns.current.get(itemId) ?? 0
    if (now - lastUsed < interaction.cooldown) return
    interactionCooldowns.current.set(itemId, now)

    // Walk boss to the item
    const target = interaction.walkTo
    setAgents(prev => prev.map(a => {
      if (a.id !== BOSS_ID) return a
      return {
        ...a,
        state: 'walking-to-desk' as const,
        targetPosition: target,
        pathQueue: computePath(a.position, target),
        statusText: Array.isArray(interaction.chatMessage)
          ? interaction.chatMessage[Math.floor(Math.random() * interaction.chatMessage.length)]
          : interaction.chatMessage,
      }
    }))

    // Set up arrival watcher — when boss reaches target, trigger effects
    const checkArrival = setInterval(() => {
      const boss = agentsRef.current.find(a => a.id === BOSS_ID)
      if (!boss) { clearInterval(checkArrival); return }
      const dist = Math.sqrt((boss.position.x - target.x) ** 2 + (boss.position.y - target.y) ** 2)
      if (dist < 2) {
        clearInterval(checkArrival)

        // Play sound if specified
        if (interaction.sound === 'bell') sfx.playBell()
        else if (interaction.sound === 'notification') sfx.playNotification()
        else if (interaction.sound === 'coffee') sfx.playCoffee()

        // Show effect above boss
        setBossEffect(interaction.effect)
        setTimeout(() => setBossEffect(null), interaction.duration)

        // Post chat message
        const msg = Array.isArray(interaction.chatMessage)
          ? interaction.chatMessage[Math.floor(Math.random() * interaction.chatMessage.length)]
          : interaction.chatMessage
        const bossCfg = AGENT_CONFIGS[BOSS_ROLE] ?? AGENT_CONFIGS['default']
        // Use setMessages directly to avoid addMsg dependency ordering
        setMessages(prev => [...prev.slice(-50), {
          id: makeMsgId(),
          sender: bossCfg.title,
          senderSprite: BOSS_ROLE,
          senderColor: bossCfg.color,
          text: msg,
          channel: 'ward-studio',
          timestamp: timeNow(),
        }])

        // Furniture state change
        if (interaction.furnitureState) {
          const fs = interaction.furnitureState
          setFurnitureStates(prev => ({ ...prev, [fs.id]: fs.state }))
          if (fs.revertAfter) {
            setTimeout(() => {
              setFurnitureStates(prev => {
                const next = { ...prev }
                delete next[fs.id]
                return next
              })
            }, fs.revertAfter)
          }
        }

        // Walk boss back to desk after effect
        setTimeout(() => {
          setAgents(prev => prev.map(a => {
            if (a.id !== BOSS_ID) return a
            return {
              ...a,
              state: 'walking-to-desk' as const,
              targetPosition: { ...a.deskPosition },
              pathQueue: computePath(a.position, a.deskPosition),
              statusText: 'back to work',
            }
          }))
        }, interaction.duration + 500)
      }
    }, 200)

    // Safety: clear after 15s if boss never arrives
    setTimeout(() => clearInterval(checkArrival), 15000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // We store agents in a ref as well so animation callbacks can read them
  // without needing to be re-created every render.
  const agentsRef = useRef<Agent[]>([])
  agentsRef.current = agents
  const stationAgentsRef = useRef<Agent[]>([])
  stationAgentsRef.current = stationAgents
  const quantumAgentsRef = useRef<Agent[]>([])
  quantumAgentsRef.current = quantumAgents
  const greenhouseAgentsRef = useRef<Agent[]>([])
  greenhouseAgentsRef.current = greenhouseAgents
  const missionTasksRef = useRef(missionTasks)
  missionTasksRef.current = missionTasks

  // Pending side-effects: computed during state updater, flushed in useEffect
  const pendingEffectsRef = useRef<PendingEffect[]>([])
  const recentChatKeysRef = useRef<Set<string>>(new Set())
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Agents currently showing typing indicator (before a Slack message)
  const [typingAgents, setTypingAgents] = useState<Set<string>>(new Set())

  // Video mode: auto-type text into the Slack input
  const [autoTypeText, setAutoTypeText] = useState<string | undefined>(undefined)

  // ---------------------------------------------------------------------------
  // Slack chat helpers
  // ---------------------------------------------------------------------------

  const addMsg = useCallback((
    sender: string,
    role: string,
    color: string,
    text: string,
    isSystem = false,
  ) => {
    setMessages(prev => [...prev.slice(-50), {
      id: makeMsgId(),
      sender,
      senderSprite: role,
      senderColor: color,
      text,
      channel: 'ward-studio',
      timestamp: timeNow(),
      isSystem,
      reactions: undefined,
    }])
  }, [])

  const handleStartPortfolioMission = useCallback((templateId: string) => {
    const now = Date.now()
    const mission = createMissionFromTemplate(templateId, now)
    if (!mission) return

    let didStart = false
    setMissionTasks(prev => {
      const alreadyRunning = prev.some(task => task.id.includes(templateId) && task.status !== 'done')
      if (alreadyRunning) return prev
      didStart = true
      return [mission, ...prev].slice(0, 12)
    })

    setTimeout(() => {
      setWardMissionOpen(false)
      setMissionQueueOpen(true)
      if (!didStart) return
      const cfg = AGENT_CONFIGS[mission.assignedRole ?? 'station-coordinator'] ?? AGENT_CONFIGS.default
      addMsg(cfg.title, mission.assignedRole ?? 'station-coordinator', cfg.color, `started portfolio mission: ${mission.title}`)
    }, 0)
  }, [addMsg])

  const handleRoomTransition = useCallback((toRoom: RoomId) => {
    if (toRoom === currentRoom) return
    setRoomTransitioning(true)
    setSelectedAgentId(null)
    setOpenRoomProp(null)
    setMissionQueueOpen(false)
    setWardMissionOpen(false)
    if (!sfx.isMuted()) sfx.playDoorOpen()

    setTimeout(() => {
      setCurrentRoom(toRoom)
      const roomName = ROOMS[toRoom].name
      addMsg('system', 'default', '#8b8d91', `Entering ${roomName}`, true)
    }, 120)

    setTimeout(() => setRoomTransitioning(false), 260)
  }, [addMsg, currentRoom])

  useEffect(() => {
    let lastTick = Date.now()
    const interval = setInterval(() => {
      const now = Date.now()
      const dtMs = now - lastTick
      lastTick = now

      setMissionTasks(prev => {
        const { tasks, events } = advanceMissions(prev, now, dtMs)
        for (const event of events.slice(0, 1)) {
          const role = event.agentRole ?? 'default'
          const cfg = AGENT_CONFIGS[role] ?? AGENT_CONFIGS.default
          setTimeout(() => addMsg(cfg.title, role, cfg.color, event.message), 0)
        }
        return tasks
      })
    }, 2200)

    return () => clearInterval(interval)
  }, [addMsg])

  // ---------------------------------------------------------------------------
  // Flush side-effects after state updates
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const effects = pendingEffectsRef.current
    if (effects.length === 0) return
    pendingEffectsRef.current = []

    for (const fx of effects) {
      if (fx.msg && !fx.msg.isSystem) {
        // Show typing indicator 500ms before message appears
        const role = fx.msg.role
        const agentId = agents.find(a => a.role === role)?.id
        if (agentId) {
          setTypingAgents(prev => new Set(prev).add(agentId))
          setTimeout(() => {
            setTypingAgents(prev => {
              const next = new Set(prev)
              next.delete(agentId)
              return next
            })
            addMsg(fx.msg!.sender, fx.msg!.role, fx.msg!.color, fx.msg!.text, fx.msg!.isSystem)
          }, 500)
        } else {
          addMsg(fx.msg.sender, fx.msg.role, fx.msg.color, fx.msg.text, fx.msg.isSystem)
        }
      } else if (fx.msg) {
        addMsg(fx.msg.sender, fx.msg.role, fx.msg.color, fx.msg.text, fx.msg.isSystem)
      }
      if (fx.sfx && !sfx.isMuted()) {
        switch (fx.sfx) {
          case 'doorOpen':    sfx.playDoorOpen(); break
          case 'typing':      sfx.playTyping(); break
          case 'celebration': sfx.playCelebration(); break
          case 'coffee':      sfx.playCoffee(); break
          case 'alarm':       sfx.playAlarm(); break
          case 'error':       sfx.playError(); break
          case 'powerDown':   sfx.playPowerDown(); break
          case 'notification': sfx.playNotification(); break
        }
      }
      if (fx.furnitureState) {
        const { id, state } = fx.furnitureState
        setFurnitureStates(prev => ({ ...prev, [id]: state }))
      }
    }
  })

  // Boss & Codex arrival messages (ref guard prevents StrictMode double-fire)
  const arrivedRef = useRef(false)
  useEffect(() => {
    if (arrivedRef.current) return
    arrivedRef.current = true
    const bossCfg = AGENT_CONFIGS[BOSS_ROLE] ?? AGENT_CONFIGS['default']
    addMsg(bossCfg.title, BOSS_ROLE, bossCfg.color, '👑 clocked in')
    const codexCfg = AGENT_CONFIGS[CLAUDE_ROLE] ?? AGENT_CONFIGS['default']
    setTimeout(() => {
      addMsg(codexCfg.title, CLAUDE_ROLE, codexCfg.color, '🤖 clocked in')
    }, 1500)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Day/night cycle — compressed: 10 min = 24 hours
  // Timeline (600s total):
  //   0-60s:    dawn transition (night→day fade)
  //   60-300s:  daytime (full day)
  //   300-360s: dusk transition (day→night fade)
  //   360-600s: nighttime (full night)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const CYCLE_MS = 10 * 60 * 1000 // 10 minutes
    const startTime = Date.now()
    let lastPhase: DayPhase | null = null

    const tick = () => {
      const elapsed = (Date.now() - startTime) % CYCLE_MS
      const t = elapsed / 1000 // seconds into cycle

      let opacity: number
      let phase: DayPhase

      if (t < 60) {
        // Dawn: fade night→day (1→0)
        opacity = 1 - (t / 60)
        phase = 'dawn'
      } else if (t < 300) {
        // Daytime
        opacity = 0
        phase = t < 180 ? 'morning' : 'afternoon'
      } else if (t < 360) {
        // Dusk: fade day→night (0→1)
        opacity = (t - 300) / 60
        phase = 'dusk'
      } else {
        // Nighttime
        opacity = 1
        phase = 'night'
      }

      setNightOpacity(opacity)

      if (phase !== lastPhase) {
        lastPhase = phase
        setDayPhase(phase)
      }
    }

    tick() // initial
    const interval = setInterval(tick, 500) // update every 500ms for smooth fade
    return () => clearInterval(interval)
  }, [])

  // ---------------------------------------------------------------------------
  // WebSocket event handler
  // ---------------------------------------------------------------------------

  const handleEvent = useCallback((event: OfficeEvent) => {
    const effects: PendingEffect[] = []

    setAgents(prev => {
      switch (event.type) {
        // ── New agent spawned ────────────────────────────────────────────────
        case 'agent_spawned': {
          const raw = event.agent ?? {}
          const id   = raw.id   ?? `agent-${Date.now()}`
          const name = raw.name ?? 'Agent'
          const role = raw.role ?? 'general-purpose'
          const task = raw.task

          // Already tracked? Skip.
          if (prev.some(a => a.id === id)) return prev

          // Filing roles go to the filing cabinet, others get a desk
          const isFiler = FILING_ROLES.has(role)
          const filingTaken = isFiler && FILING_SPOT !== null && prev.some(a => a.assignedSpotId === FILING_SPOT.id)

          let spot
          if (isFiler && !filingTaken && FILING_SPOT !== null) {
            spot = FILING_SPOT
          } else {
            spot = assignSpot(prev, MAIN_ROOM.agentSpots)
          }

          if (!spot) {
            const cfg = AGENT_CONFIGS[role] ?? AGENT_CONFIGS['default']
            effects.push({ msg: { sender: name, role, color: cfg.color, text: 'waiting for a desk...' } })
            return prev
          }

          const agentBase = createAgent({ id, name, role, task, spot })
          const agent = {
            ...agentBase,
            pathQueue: computePath(agentBase.position, agentBase.targetPosition),
          }

          // Initialise runtime meta
          agentMetaRef.current.set(id, {
            spawnedAt: Date.now(),
            arrivedAtDeskAt: null,
            idleSince: null,
            onBreak: false,
            breakStartedAt: null,
          })

          const cfg = AGENT_CONFIGS[role] ?? AGENT_CONFIGS['default']
          effects.push({
            msg: { sender: name, role, color: cfg.color, text: task ? `📋 ${task}` : spawnMessage() },
            sfx: 'doorOpen',
          })

          return [...prev, agent]
        }

        // ── Agent started working / status update ──────────────────────────
        case 'agent_working': {
          const id = event.agentId ?? event.agent?.id
          const statusMsg = event.status ?? workMessage()

          if (id) {
            // Targeted update — specific agent
            return prev.map(a => {
              if (a.id !== id) return a
              const cfg = AGENT_CONFIGS[a.role] ?? AGENT_CONFIGS['default']
              effects.push({
                msg: { sender: a.name, role: a.role, color: cfg.color, text: `⚡ ${statusMsg}` },
              })
              return { ...a, state: 'working' as const, statusText: statusMsg }
            })
          }

          // No agentId — broadcast to a random working agent (tool use from main thread)
          const workers = prev.filter(a => a.state === 'working' && a.id !== BOSS_ID)
          if (workers.length > 0) {
            const target = workers[Math.floor(Math.random() * workers.length)]
            const cfg = AGENT_CONFIGS[target.role] ?? AGENT_CONFIGS['default']
            effects.push({
              msg: { sender: target.name, role: target.role, color: cfg.color, text: `⚡ ${statusMsg}` },
            })
            return prev.map(a =>
              a.id === target.id ? { ...a, statusText: statusMsg } : a
            )
          }

          return prev
        }

        // ── Agent completed task ─────────────────────────────────────────────
        case 'agent_completed': {
          const id = event.agentId ?? event.agent?.id
          if (!id) return prev

          // Delay departure if agent hasn't been visible long enough
          const completeMeta = agentMetaRef.current.get(id)
          if (completeMeta) {
            const elapsed = Date.now() - completeMeta.spawnedAt
            if (elapsed < MIN_VISIBLE_TIME) {
              const delay = MIN_VISIBLE_TIME - elapsed
              setTimeout(() => handleEvent(event), delay)
              return prev
            }
          }

          return prev.map(a => {
            if (a.id !== id) return a
            const cfg = AGENT_CONFIGS[a.role] ?? AGENT_CONFIGS['default']
            const resultMsg = event.result ?? doneMessage()
            effects.push({
              msg: { sender: a.name, role: a.role, color: cfg.color, text: `✅ ${resultMsg}` },
              sfx: 'celebration',
            })

            // Boss replies to completed tasks
            const bossCfg = AGENT_CONFIGS[BOSS_ROLE] ?? AGENT_CONFIGS['default']
            const bossReplies = [
              `nice work ${a.name} 👊`,
              `solid 🔥`,
              `ship it!`,
              `great stuff, grab a Red Bull`,
              `legend 💯`,
              `good job, who\'s next?`,
              `that was quick, another one?`,
              `clean work 👌`,
              `cheers ${a.name}`,
              `merged. next task loading...`,
            ]
            // Why: when Office theme is on, Michael Scott occasionally lands his signature line.
            const isMichael = getTheme() === 'office'
            const reply = isMichael && Math.random() < 0.25
              ? `That's what she said 😏`
              : bossReplies[Math.floor(Math.random() * bossReplies.length)]
            effects.push({
              msg: { sender: bossCfg.title, role: BOSS_ROLE, color: bossCfg.color, text: reply },
            })

            // Mark as completed and start walking to door
            const meta = agentMetaRef.current.get(a.id)
            if (meta) {
              meta.arrivedAtDeskAt = null
              meta.onBreak = false
            }
            // Close filing cabinet if this agent was using it
            if (a.assignedSpotId === 'spot-filing') {
              effects.push({ furnitureState: { id: 'filing-1', state: 'closed' } })
            }

            return {
              ...a,
              state: 'completed' as const,
              targetPosition: { ...DOOR_TARGET },
              statusText: event.result ?? doneMessage(),
              pathQueue: computePath(a.position, DOOR_TARGET),
            }
          })
        }

        // ── MCP call started ─────────────────────────────────────────────────
        case 'mcp_call': {
          const server = (event as any).server ?? ''
          const tool = (event as any).tool ?? ''
          const id = event.agentId ?? event.agent?.id
          if (!id) return prev
          const mcpMsg = `🔌 ${server} → ${tool}`
          return prev.map(a => {
            if (a.id !== id) return a
            const cfg = AGENT_CONFIGS[a.role] ?? AGENT_CONFIGS['default']
            effects.push({ msg: { sender: a.name, role: a.role, color: cfg.color, text: mcpMsg } })
            return { ...a, statusText: `${server}.${tool}` }
          })
        }

        // ── MCP call finished ────────────────────────────────────────────────
        case 'mcp_done': {
          const id = event.agentId ?? event.agent?.id
          if (!id) return prev
          return prev.map(a =>
            a.id === id
              ? { ...a, statusText: event.result ?? 'done' }
              : a
          )
        }

        // ── Typing indicator ─────────────────────────────────────────────
        case 'chat_typing': {
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
          setChatTypingUser((event as any).sender ?? '')
          typingTimeoutRef.current = setTimeout(() => setChatTypingUser(null), 10000)
          return prev
        }

        // ── Emoji reactions on a message ──────────────────────────────────
        case 'chat_reaction': {
          const { messageId, reactions } = event as any
          if (messageId && reactions) {
            setMessages(prev => prev.map(m =>
              m.id === messageId ? { ...m, reactions } : m
            ))
          }
          return prev
        }

        // ── Read receipt ──────────────────────────────────────────────────
        case 'chat_seen': {
          setLastSeenId((event as any).messageId ?? null)
          return prev
        }

        // ── Chat message from server (Codex replying via an agent) ──────
        case 'chat_message': {
          const sender = event.sender ?? 'Agent'
          const text = event.text ?? ''
          const ts = (event as any).timestamp as number | undefined

          // Clear typing indicator when Codex sends a real message
          setChatTypingUser(null)

          // Skip messages from the boss — those are added locally by onSendMessage
          const bossCfg = AGENT_CONFIGS[BOSS_ROLE] ?? AGENT_CONFIGS['default']
          if (sender === bossCfg.title || sender.toLowerCase() === bossCfg.title.toLowerCase()) {
            return prev
          }

          // Deduplicate by timestamp+text — skip if we already have this exact message
          const dedupKey = `${ts ?? 0}:${text}`
          if (recentChatKeysRef.current.has(dedupKey)) {
            return prev
          }
          recentChatKeysRef.current.add(dedupKey)
          // Keep the set from growing unbounded
          if (recentChatKeysRef.current.size > 50) {
            const first = recentChatKeysRef.current.values().next().value
            if (first !== undefined) recentChatKeysRef.current.delete(first)
          }

          const role = (event as any).role as string | undefined
          let msgSender: string, msgRole: string, msgColor: string

          // If sender is "Claude" or "Codex" (from AI watcher/bridge), always attribute to Codex
          if (sender.toLowerCase() === 'claude' || sender.toLowerCase() === 'codex') {
            const codexCfg = AGENT_CONFIGS[CLAUDE_ROLE] ?? AGENT_CONFIGS['default']
            msgSender = codexCfg.title; msgRole = CLAUDE_ROLE; msgColor = codexCfg.color
          } else if (role && AGENT_CONFIGS[role]) {
            const cfg = AGENT_CONFIGS[role]
            msgSender = cfg.title; msgRole = role; msgColor = cfg.color
          } else {
            // Attribute to a working agent or fall back to Codex
            const workers = prev.filter(a => a.id !== BOSS_ID && a.id !== CLAUDE_ID && a.state === 'working')
            if (workers.length > 0) {
              const agent = workers[Math.floor(Math.random() * workers.length)]
              const cfg = AGENT_CONFIGS[agent.role] ?? AGENT_CONFIGS['default']
              msgSender = agent.name; msgRole = agent.role; msgColor = cfg.color
            } else {
              const codexCfg = AGENT_CONFIGS[CLAUDE_ROLE] ?? AGENT_CONFIGS['default']
              msgSender = codexCfg.title; msgRole = CLAUDE_ROLE; msgColor = codexCfg.color
            }
          }
          // Use setTimeout to escape the setAgents updater before calling addMsg
          setTimeout(() => addMsg(msgSender, msgRole, msgColor, text), 0)
          return prev
        }

        default:
          return prev
      }
    })

    // Schedule effects to be flushed after state settles
    pendingEffectsRef.current.push(...effects)
  }, [])

  // ---------------------------------------------------------------------------
  // WebSocket connection
  // ---------------------------------------------------------------------------

  useAgentSocket({ onEvent: handleEvent, url: 'ws://localhost:3334/ws', disabled: isSimMode })

  // ---------------------------------------------------------------------------
  // Simulation loop — spawns/completes fake agents (only in ?sim mode)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isSimMode) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const intervals: ReturnType<typeof setInterval>[] = []

    // ---- Office-theme rotation sim: 10 staff, constant door churn, cycles all 22 ----
    if (getTheme() === 'office' && !isVideoMode) {
      // Why: roles are synthetic "dm-0..dm-9" so each slot gets its own cast entry
      const STAFF_COUNT = 10
      const ROTATION_MS = 9000 // Why: fast enough to see all 22 in <2 min
      const ROLES = ['debugger', 'code-reviewer', 'frontend-developer', 'fullstack-developer',
                      'test-engineer', 'security-auditor', 'devops-engineer',
                      'architect-reviewer', 'performance-engineer', 'ai-engineer'] as const
      let lastRetired: string | null = null

      const spawnSlot = (slotIdx: number, initialDelay = 0) => {
        const role = `dm-slot-${slotIdx}`
        const baseRole = ROLES[slotIdx % ROLES.length]
        const cfg = AGENT_CONFIGS[baseRole] ?? AGENT_CONFIGS['default']
        const slug = nextUnusedOfficeCharacter(new Set(lastRetired ? [lastRetired] : []))
        const displayName = displayNameFromSlug(slug)

        timers.push(setTimeout(() => {
          // Why: force this synthetic role to map to the chosen Office character
          assignCharacterToRole(role, slug)
          handleEvent({
            type: 'agent_spawned',
            agent: {
              id: `dm-${slotIdx}-${Date.now()}`,
              name: displayName,
              role, // synthetic — so castByRole maps uniquely
              task: `Dunder Mifflin — ${displayName}`,
            },
          })
          timers.push(setTimeout(() => {
            addMsg(displayName, role, cfg.color, `clocked in — ${displayName} reporting`)
          }, 1000))
        }, initialDelay))
      }

      // Spawn 10 staff staggered over first 8s
      for (let i = 0; i < STAFF_COUNT; i++) {
        spawnSlot(i, i * 800)
      }

      // Rotation: every ROTATION_MS, retire oldest agent, spawn a new one in its slot
      let nextSlotToRotate = 0
      intervals.push(setInterval(() => {
        const slotIdx = nextSlotToRotate % STAFF_COUNT
        nextSlotToRotate++
        const role = `dm-slot-${slotIdx}`

        // Find the current agent for this slot and complete it (walks to door, exits)
        setAgents(prev => {
          const agent = prev.find(a => a.role === role)
          if (agent) {
            lastRetired = null // will be set after release
            handleEvent({
              type: 'agent_completed',
              agentId: agent.id,
              result: `${agent.name} heading out for a pretzel`,
            })
          }
          return prev
        })

        // After the exit animation, release the cast slot and spawn replacement
        timers.push(setTimeout(() => {
          releaseRole(role)
          spawnSlot(slotIdx, 800) // small gap before new hire walks in
        }, 3500))
      }, ROTATION_MS))

      // Periodic Office chatter from random staff
      intervals.push(setInterval(() => {
        setAgents(prev => {
          const staff = prev.filter(a => a.role.startsWith('dm-slot-'))
          if (staff.length === 0) return prev
          const speaker = staff[Math.floor(Math.random() * staff.length)]
          const lines = OFFICE_SIM_TOOL_MESSAGES[ROLES[parseInt(speaker.role.split('-')[2], 10) % ROLES.length]] ?? []
          const line = lines[Math.floor(Math.random() * lines.length)] ?? 'selling paper'
          const cfg = AGENT_CONFIGS[ROLES[0]] ?? AGENT_CONFIGS['default']
          addMsg(speaker.name, speaker.role, cfg.color, line)
          return prev
        })
      }, 4500))

      return () => {
        timers.forEach(t => clearTimeout(t))
        intervals.forEach(i => clearInterval(i))
      }
    }

    // Helper: post a message with an optional typing indicator beforehand.
    // showTyping=true will set a typing state for ~1.5s before the message appears.
    const postWithTyping = (
      sender: string,
      role: string,
      msg: string,
      delay: number,
      showTyping: boolean,
    ) => {
      if (showTyping) {
        timers.push(setTimeout(() => {
          setChatTypingUser(sender)
        }, delay))
        timers.push(setTimeout(() => {
          const cfg = AGENT_CONFIGS[role] ?? AGENT_CONFIGS['default']
          setChatTypingUser(null)
          addMsg(sender, role, cfg.color, msg)
        }, delay + 1500))
      } else {
        timers.push(setTimeout(() => {
          const cfg = AGENT_CONFIGS[role] ?? AGENT_CONFIGS['default']
          addMsg(sender, role, cfg.color, msg)
        }, delay))
      }
    }

    // Helper: add a random emoji reaction to the second-to-last chat message.
    const reactToLastMsg = (delay: number) => {
      timers.push(setTimeout(() => {
        setMessages(prev => {
          const target = prev[prev.length - 2]
          if (target && !target.reactions?.length) {
            const emoji = ['👍', '🔥', '😂', '🚀', '💯'][Math.floor(Math.random() * 5)]
            return prev.map(m => m.id === target.id ? { ...m, reactions: [emoji] } : m)
          }
          return prev
        })
      }, delay))
    }

    // Phase 1: Stagger-spawn 3 agents (1s, 3s, 5s) with proactive "starting:" messages
    SIM_SCENARIOS.forEach((sim, i) => {
      const cfg = AGENT_CONFIGS[sim.role] ?? AGENT_CONFIGS['default']
      const spawnAt = 1000 + i * 2500
      timers.push(setTimeout(() => {
        handleEvent({
          type: 'agent_spawned',
          agent: {
            id: `sim-${sim.role}`,
            name: cfg.title,
            role: sim.role,
            task: sim.task,
          },
        })
        // Proactive "starting:" message a moment after spawn
        timers.push(setTimeout(() => {
          addMsg(cfg.title, sim.role, cfg.color, `starting: ${sim.task}`)
        }, 1200))
      }, spawnAt))
    })

    // Phase 2: Drip-feed task progress messages
    const msgIndexes = SIM_SCENARIOS.map(() => 0)
    timers.push(setTimeout(() => {
      const progressInterval = setInterval(() => {
        // Pick a random agent to send a progress update
        const idx = Math.floor(Math.random() * SIM_SCENARIOS.length)
        const sim = SIM_SCENARIOS[idx]
        const msgIdx = msgIndexes[idx]
        if (msgIdx < sim.slackMessages.length) {
          const cfg = AGENT_CONFIGS[sim.role] ?? AGENT_CONFIGS['default']
          // Show typing indicator before every other progress message
          const useTyping = msgIdx % 2 === 0
          if (useTyping) {
            setChatTypingUser(cfg.title)
            timers.push(setTimeout(() => {
              setChatTypingUser(null)
              addMsg(cfg.title, sim.role, cfg.color, sim.slackMessages[msgIdx])
            }, 1500))
          } else {
            addMsg(cfg.title, sim.role, cfg.color, sim.slackMessages[msgIdx])
          }
          msgIndexes[idx]++

          // Add a reaction to the previous message after a short delay
          reactToLastMsg(3000)

          // Trigger ultra-think powerup on specific messages
          if (sim.slackMessages[msgIdx].includes('race condition') ||
              sim.slackMessages[msgIdx].includes('scanning') ||
              sim.slackMessages[msgIdx].includes('architecture')) {
            setAgents(prev => prev.map(a =>
              a.role === sim.role
                ? { ...a, statusText: 'ultra-think: deep analysis...' }
                : a
            ))
            // Clear ultra-think after a few seconds
            timers.push(setTimeout(() => {
              setAgents(prev => prev.map(a =>
                a.role === sim.role
                  ? { ...a, statusText: sim.slackMessages[msgIdx] }
                  : a
              ))
            }, 8000))
          }
        }
      }, 4000)
      intervals.push(progressInterval)
    }, 12000)) // start after agents have settled at desks

    // Phase 3: Random chatter between agents — typing indicator on every 3rd message
    timers.push(setTimeout(() => {
      let chatterIdx = 0
      const chatterInterval = setInterval(() => {
        // Why: pool chosen at fire time so /the-office toggle mid-sim swaps the chatter instantly
        const pool = getTheme() === 'office' ? OFFICE_SIM_CHATTER : SIM_CHATTER
        if (chatterIdx >= pool.length) {
          chatterIdx = 0 // loop
        }
        const chat = pool[chatterIdx]
        const showTyping = chatterIdx % 3 === 0
        postWithTyping(chat.sender, chat.role, chat.msg, 0, showTyping)

        // React to the previous message after some chatter
        if (chatterIdx % 4 === 2) {
          reactToLastMsg(4000)
        }

        chatterIdx++
      }, 7000)
      intervals.push(chatterInterval)
    }, 18000))

    // Phase 4: Spawn a Researcher partway through (reference search)
    timers.push(setTimeout(() => {
      const exploreCfg = AGENT_CONFIGS['researcher-agent'] ?? AGENT_CONFIGS['default']
      handleEvent({
        type: 'agent_spawned',
        agent: {
          id: 'sim-researcher',
          name: exploreCfg.title,
          role: 'researcher-agent',
          task: 'Finding references and examples for the next build',
        },
      })
      timers.push(setTimeout(() => {
        addMsg(exploreCfg.title, 'researcher-agent', exploreCfg.color, 'starting: Finding references and examples for the next build')
      }, 1200))
      // Explorer completes and leaves after 20s
      timers.push(setTimeout(() => {
        handleEvent({
          type: 'agent_completed',
          agentId: 'sim-researcher',
          result: 'Found 5 useful references and 2 ideas to ignore',
        })
        timers.push(setTimeout(() => {
          addMsg(exploreCfg.title, 'researcher-agent', exploreCfg.color, 'done: Found 5 useful references and 2 ideas to ignore')
        }, 800))
      }, 20000))
    }, 25000))

    // Phase 5: One agent completes task, walks to door, leaves — then a new one spawns
    timers.push(setTimeout(() => {
      handleEvent({
        type: 'agent_completed',
        agentId: 'sim-builder-agent',
        result: 'First usable version ready for testing',
      })
      timers.push(setTimeout(() => {
        const builderCfg = AGENT_CONFIGS['builder-agent'] ?? AGENT_CONFIGS['default']
        addMsg(builderCfg.title, 'builder-agent', builderCfg.color, 'done: First usable version ready for testing')
      }, 800))
      // Replacement agent arrives
      timers.push(setTimeout(() => {
        const cfg = AGENT_CONFIGS['qa-agent'] ?? AGENT_CONFIGS['default']
        handleEvent({
          type: 'agent_spawned',
          agent: {
            id: 'sim-qa-agent',
            name: cfg.title,
            role: 'qa-agent',
            task: 'Testing the first version like a normal user',
          },
        })
        timers.push(setTimeout(() => {
          addMsg(cfg.title, 'qa-agent', cfg.color, 'starting: Testing the first version like a normal user')
        }, 1200))
      }, 8000))
    }, 50000))

    return () => {
      timers.forEach(t => clearTimeout(t))
      intervals.forEach(i => clearInterval(i))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Video mode — scripted demo for TikTok recording (?video)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isVideoMode) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const bossCfg = AGENT_CONFIGS[BOSS_ROLE] ?? AGENT_CONFIGS['default']

    const officeSim0 = getTheme() === 'office'

    // 0-3s: Office is just Antony, settling in
    timers.push(setTimeout(() => {
      addMsg(bossCfg.title, BOSS_ROLE, bossCfg.color,
        officeSim0 ? "👑 World's Best Boss clocked in, let's sell some paper" : '👑 Orbit Lab online. Lets build one useful thing.')
    }, 2000))

    // 4s: Antony types a question in Slack
    timers.push(setTimeout(() => {
      setAutoTypeText(officeSim0
        ? (OFFICE_SIM_BOSS_PROMPTS[0] ?? '/ultra-think audit our authentication system for security vulnerabilities')
        : 'help me choose one small project I can actually finish today')
    }, 4000))

    // 8s: 3 agents spawn with ultra-think tasks (energy drinks!)
    timers.push(setTimeout(() => {
      const spawns = [
        { id: 'vid-idea', role: 'idea-agent', name: 'Inventor', task: 'ultra-think: pick one useful project idea' },
        { id: 'vid-designer', role: 'designer-agent', name: 'Designer', task: 'ultra-think: shape the simplest clean interface' },
        { id: 'vid-builder', role: 'builder-agent', name: 'Builder', task: 'ultra-think: plan the smallest working version' },
      ]
      spawns.forEach((s, i) => {
        timers.push(setTimeout(() => {
          handleEvent({ type: 'agent_spawned', agent: s })
        }, i * 2000))
      })
    }, 8000))

    // 16s: Realistic tool output messages in Slack.
    // Why: swap to Office-themed chatter when /the-office mode is on at sim start
    const isOfficeSim = getTheme() === 'office'
    const defaultToolMessages = [
      { t: 16000, sender: 'Inventor', role: 'idea-agent', text: 'reading your current interests: AI tools, visual assets, small apps' },
      { t: 18000, sender: 'Designer', role: 'designer-agent', text: 'checking which ideas have a clean first screen' },
      { t: 20000, sender: 'Inventor', role: 'idea-agent', text: 'best candidate: personal project tracker with AI helper notes' },
      { t: 22000, sender: 'Builder', role: 'builder-agent', text: 'mapping MVP: add idea, pick next step, mark progress' },
      { t: 24000, sender: 'Designer', role: 'designer-agent', text: 'keeping it compact: list, focus panel, progress log' },
      { t: 26000, sender: 'Builder', role: 'builder-agent', text: 'avoiding accounts/database for v1 so it stays finishable' },
      { t: 28000, sender: 'Inventor', role: 'idea-agent', text: 'saving bonus ideas for later, not today' },
      { t: 30000, sender: 'Builder', role: 'builder-agent', text: 'plan ready: one useful screen first' },
    ]
    const toolMessages = isOfficeSim
      ? defaultToolMessages.map((m, i) => {
          const pool = OFFICE_SIM_TOOL_MESSAGES[m.role] ?? []
          return { ...m, text: pool[i % pool.length] ?? m.text }
        })
      : defaultToolMessages
    toolMessages.forEach(({ t, sender, role, text }) => {
      timers.push(setTimeout(() => {
        const cfg = AGENT_CONFIGS[role] ?? AGENT_CONFIGS['default']
        addMsg(sender, role, cfg.color, text)
      }, t))
    })

    // 25s: Antony types a follow-up
    timers.push(setTimeout(() => {
      setAutoTypeText(isOfficeSim ? (OFFICE_SIM_BOSS_PROMPTS[1] ?? 'how bad is the localStorage issue?') : 'can we make it useful without overbuilding?')
    }, 25000))

    // 27s: Agent replies
    timers.push(setTimeout(() => {
      const cfg = AGENT_CONFIGS['idea-agent'] ?? AGENT_CONFIGS['default']
      addMsg('Inventor', 'idea-agent', cfg.color,
        isOfficeSim
          ? 'critical — Dwight-level bad. any XSS gives full account takeover. moving to httpOnly cookies now'
          : 'yes. one workflow only: capture idea, choose next step, log progress.')
    }, 27500))

    // 30s: Random chatter
    timers.push(setTimeout(() => {
      const cfg = AGENT_CONFIGS['designer-agent'] ?? AGENT_CONFIGS['default']
      addMsg('Designer', 'designer-agent', cfg.color,
        isOfficeSim ? 'I can handle the cookie migration — easier than organizing the Dundies' : 'I will keep the interface quiet and readable.')
    }, 30000))

    timers.push(setTimeout(() => {
      const cfg = AGENT_CONFIGS['builder-agent'] ?? AGENT_CONFIGS['default']
      addMsg('Builder', 'builder-agent', cfg.color,
        isOfficeSim ? 'lgtm. ship it to Stamford, boom. roasted.' : 'small version first. We can add fancy stuff after it works.')
    }, 32000))

    // 33s: Antony checks status with a slash command
    timers.push(setTimeout(() => {
      setAutoTypeText('/status')
    }, 33000))

    // 35s: Explorer spawns to check codebase
    timers.push(setTimeout(() => {
      handleEvent({
        type: 'agent_spawned',
        agent: { id: 'vid-researcher', name: 'Researcher', role: 'researcher-agent', task: 'Finding examples and avoiding rabbit holes' },
      })
    }, 35000))

    // 38s: Pizza delivery event!
    timers.push(setTimeout(() => {
      addMsg('system', 'default', '#8b8d91',
        officeSim0 ? '🥨 IT\'S PRETZEL DAY' : '🍕 Energy break in the galley', true)
      addMsg(bossCfg.title, BOSS_ROLE, bossCfg.color,
        officeSim0 ? "You don't understand. It's pretzel day." : 'Quick break, then ship the tiny version.')
      // Move all agents to door
      setAgents(prev => prev.map(a => ({
        ...a,
        state: 'walking-to-desk' as const,
        targetPosition: { x: 67.5, y: 48.9 },
        pathQueue: computePath(a.position, { x: 67.5, y: 48.9 }),
        statusText: 'Pizza Delivery',
      })))
      // Back to desks after 5s
      timers.push(setTimeout(() => {
        setAgents(prev => prev.map(a => ({
          ...a,
          state: 'walking-to-desk' as const,
          targetPosition: { ...a.deskPosition },
          pathQueue: computePath(a.position, a.deskPosition),
          statusText: 'back to work',
        })))
      }, 5000))
    }, 38000))

    // 45s: Agent chatter after pizza/pretzels
    timers.push(setTimeout(() => {
      const cfg = AGENT_CONFIGS['qa-agent'] ?? AGENT_CONFIGS['default']
      addMsg('Tester', 'qa-agent', cfg.color,
        officeSim0 ? 'all the toppings. Stanley has been waiting all year.' : 'I found one confusing state. Fixing the label is enough.')
    }, 46000))

    timers.push(setTimeout(() => {
      const cfg = AGENT_CONFIGS['archivist-agent'] ?? AGENT_CONFIGS['default']
      addMsg('Archivist', 'archivist-agent', cfg.color,
        officeSim0 ? "that's what she said" : 'I saved the decisions so tomorrow is easier.')
    }, 47500))

    // 48s: Inventor completes
    timers.push(setTimeout(() => {
      handleEvent({
        type: 'agent_completed',
        agentId: 'vid-idea',
        result: officeSim0
          ? 'Audit complete — beets secured. 3 critical issues booked into the Schrute Manual.'
          : 'Project idea chosen and scoped to one workflow',
      })
    }, 48000))

    // 52s: Researcher completes
    timers.push(setTimeout(() => {
      handleEvent({
        type: 'agent_completed',
        agentId: 'vid-researcher',
        result: officeSim0 ? 'Found 8 auth files — all filed under B for "Beet".' : 'Found references and filtered out the distractions',
      })
    }, 52000))

    // 55s: Antony wraps up
    timers.push(setTimeout(() => {
      setAutoTypeText(officeSim0 ? 'great work team — boom. roasted. 🥨' : 'nice. build the smallest useful version. 🚀')
    }, 55000))

    // 58s: Remaining agents complete
    timers.push(setTimeout(() => {
      handleEvent({ type: 'agent_completed', agentId: 'vid-designer',
        result: officeSim0 ? 'All PRs reviewed — Jim-approved.' : 'Visual direction ready' })
    }, 58000))

    timers.push(setTimeout(() => {
      handleEvent({ type: 'agent_completed', agentId: 'vid-builder',
        result: officeSim0 ? 'Cookies deployed — Kevin took half for his chili.' : 'Build plan ready for implementation' })
    }, 60000))

    return () => timers.forEach(t => clearTimeout(t))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Animation loop — moves agents toward their targets each frame
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let rafId: number
    let lastTime = performance.now()

    function tick(now: number) {
      const dt = Math.min((now - lastTime) / 16.67, 3)
      lastTime = now

      const prev = agentsRef.current
      if (prev.length === 0) {
        rafId = requestAnimationFrame(tick)
        return
      }

      const nowMs = Date.now()
      let changed = false

      const next = prev.map(agent => {
        const meta = agentMetaRef.current.get(agent.id) ?? {
          spawnedAt: Date.now(),
          arrivedAtDeskAt: null,
          idleSince: null,
          onBreak: false,
          breakStartedAt: null,
        }
        agentMetaRef.current.set(agent.id, meta)

        const speed = WALK_SPEED * dt

        // Walk toward the first waypoint in the queue, or directly to the
        // final targetPosition if the queue is empty.
        const queue = agent.pathQueue ?? []
        const immediateTarget = queue.length > 0 ? queue[0] : agent.targetPosition

        const { position, arrived } = stepToward(
          agent.position,
          immediateTarget,
          speed,
        )

        // Always update position (even if not arrived — this is the walking animation)
        const moved = position.x !== agent.position.x || position.y !== agent.position.y
        if (moved && agent.state !== 'working' && agent.state !== 'idle') {
          // Debug: log first few frames of movement
          if (Math.random() < 0.01) {
            const q = agent.pathQueue ?? []
            console.log(`[walk] ${agent.name} at (${agent.position.x.toFixed(1)},${agent.position.y.toFixed(1)}) → (${position.x.toFixed(1)},${position.y.toFixed(1)}) queue:${q.length} target:(${immediateTarget.x.toFixed(1)},${immediateTarget.y.toFixed(1)}) arrived:${arrived}`)
          }
        }
        let updated: Agent = moved
          ? (changed = true, { ...agent, position })
          : agent

        if (arrived) {
          // If there are more waypoints in the queue, pop the first one and
          // keep walking — don't trigger "arrived at final destination" yet.
          if (queue.length > 0) {
            const newQueue = queue.slice(1)
            updated = { ...agent, position, pathQueue: newQueue }
            changed = true
          } else {
            // Queue is empty — agent has reached (or is walking directly to)
            // their final targetPosition.
            const isAtDesk = (
              Math.abs(agent.targetPosition.x - agent.deskPosition.x) < ARRIVAL_THRESHOLD &&
              Math.abs(agent.targetPosition.y - agent.deskPosition.y) < ARRIVAL_THRESHOLD
            )
            const isAtDoor = (
              Math.abs(agent.targetPosition.x - DOOR_TARGET.x) < ARRIVAL_THRESHOLD &&
              Math.abs(agent.targetPosition.y - DOOR_TARGET.y) < ARRIVAL_THRESHOLD
            )

            if (agent.state === 'new-hire' || agent.state === 'walking-to-desk') {
              if (isAtDesk || agent.state === 'new-hire') {
                meta.arrivedAtDeskAt = nowMs
                meta.onBreak = false
                // Open filing cabinet if this agent's desk is the filing spot
                if (agent.assignedSpotId === 'spot-filing') {
                  setFurnitureStates(prev => ({ ...prev, 'filing-1': 'open' }))
                }
                updated = { ...agent, position, state: 'working', statusText: workMessage() }
                changed = true
              }
            } else if (agent.state === 'completed' && isAtDoor) {
              updated = { ...agent, position }
              changed = true
            } else if (agent.state === 'coffee-break') {
              if (!meta.onBreak) {
                meta.onBreak = true
                meta.breakStartedAt = nowMs
                // Toggle furniture state on arrival
                if (COFFEE_SPOT !== null && agent.id !== BOSS_ID) {
                  const atCoffee = Math.abs(position.x - COFFEE_SPOT.x) < 3 && Math.abs(position.y - COFFEE_SPOT.y) < 3
                  if (atCoffee) {
                    setFurnitureStates(prev => ({ ...prev, coffee: 'on' }))
                  }
                }
                const filingSpot = MAIN_ROOM.agentSpots.find(s => s.type === 'filing')
                const atFiling = filingSpot && Math.abs(position.x - filingSpot.x) < 3 && Math.abs(position.y - filingSpot.y) < 3
                if (atFiling) {
                  setFurnitureStates(prev => ({ ...prev, 'filing-1': 'open' }))
                }
                updated = { ...agent, position }
                changed = true
              } else {
                const waited = nowMs - (meta.breakStartedAt ?? nowMs)
                if (waited >= BREAK_DURATION) {
                  meta.onBreak = false
                  meta.breakStartedAt = null
                  meta.arrivedAtDeskAt = nowMs
                  // Toggle furniture state back on departure
                  setFurnitureStates(prev => ({ ...prev, coffee: 'off', 'filing-1': 'closed' }))
                  const newTarget = { ...agent.deskPosition }
                  updated = {
                    ...agent,
                    position,
                    state: 'walking-to-desk',
                    targetPosition: newTarget,
                    statusText: workMessage(),
                    pathQueue: computePath(position, newTarget),
                  }
                  changed = true
                }
              }
            } else {
              if (
                Math.abs(position.x - agent.position.x) > 0.01 ||
                Math.abs(position.y - agent.position.y) > 0.01
              ) {
                updated = { ...agent, position }
                changed = true
              }
            }
          }
        } else {
          // Still walking
          if (
            Math.abs(position.x - agent.position.x) > 0.001 ||
            Math.abs(position.y - agent.position.y) > 0.001
          ) {
            updated = { ...agent, position }
            changed = true
          }
        }

        // Random break trigger
        if (
          updated.state === 'working' &&
          meta.arrivedAtDeskAt !== null &&
          !meta.onBreak &&
          COFFEE_SPOT !== null
        ) {
          const deskTime = nowMs - meta.arrivedAtDeskAt
          if (deskTime >= BREAK_MIN_DESK_TIME) {
            const breakRoll = BREAK_CHANCE_PER_SEC * (dt / 60)
            if (Math.random() < breakRoll) {
              const useWater = Math.random() < 0.35 && WATER_SPOTS.length > 0
              const breakSpot = useWater
                ? WATER_SPOTS[Math.floor(Math.random() * WATER_SPOTS.length)]
                : COFFEE_SPOT

              meta.onBreak = false
              meta.arrivedAtDeskAt = null

              const cfg = AGENT_CONFIGS[updated.role] ?? AGENT_CONFIGS['default']
              const isBoss = updated.id === BOSS_ID
              const breakMsg = useWater ? waterMessage() : (isBoss ? 'grabbing a Red Bull' : coffeeMessage())
              const breakIcon = isBoss ? '🥫' : (useWater ? '💧' : '☕')
              addMsg(updated.name, updated.role, cfg.color, `${breakIcon} ${breakMsg}`)
              if (!sfx.isMuted()) sfx.playCoffee()

              const breakTarget = { x: breakSpot.x, y: breakSpot.y }
              updated = {
                ...updated,
                state: 'coffee-break',
                targetPosition: breakTarget,
                statusText: breakMsg,
                pathQueue: computePath(updated.position, breakTarget),
              }
              changed = true
            }
          }
        }

        return updated
      })

      // Prune completed agents at the door (never prune the boss)
      const pruned = next.filter(a => {
        if (a.id === BOSS_ID || a.id === CLAUDE_ID) return true
        if (a.state === 'completed') {
          const atDoor = (
            Math.abs(a.position.x - DOOR_TARGET.x) < ARRIVAL_THRESHOLD * 2 &&
            Math.abs(a.position.y - DOOR_TARGET.y) < ARRIVAL_THRESHOLD * 2
          )
          if (atDoor) {
            agentMetaRef.current.delete(a.id)
            return false
          }
        }
        return true
      })

      if (changed || pruned.length !== next.length) {
        setAgents(pruned)
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let rafId: number
    let lastTime = performance.now()

    function tick(now: number) {
      const dt = Math.min((now - lastTime) / 16.67, 3)
      lastTime = now
      const speed = WALK_SPEED * dt * 0.75
      let changed = false

      const next = stationAgentsRef.current.map(agent => {
        const queue = agent.pathQueue ?? []
        const immediateTarget = queue.length > 0 ? queue[0] : agent.targetPosition
        const { position, arrived } = stepToward(agent.position, immediateTarget, speed)
        let updated: Agent = position.x !== agent.position.x || position.y !== agent.position.y
          ? (changed = true, { ...agent, position })
          : agent

        if (arrived) {
          if (queue.length > 0) {
            updated = { ...updated, position, pathQueue: queue.slice(1) }
            changed = true
          } else if (agent.state !== 'working') {
            updated = { ...updated, position, state: 'working', statusText: 'on station' }
            changed = true
          }
        }

        return updated
      })

      if (changed) setStationAgents(next)
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  useEffect(() => {
    const stationTargets = STATION_ROOM.agentSpots.filter(s => s.type === 'desk' || s.type === 'standing')
    const interval = setInterval(() => {
      setStationAgents(prev => {
        if (prev.length === 0 || stationTargets.length === 0) return prev
        const agent = prev[Math.floor(Math.random() * prev.length)]
        const task = getTaskForAgent(agent, missionTasksRef.current)
        const opsSpot = task?.currentRoom === 'station-command' && task.targetSpotId
          ? STATION_ROOM.agentSpots.find(s => s.id === task.targetSpotId)
          : undefined
        const available = stationTargets.filter(s => s.id !== agent.assignedSpotId)
        const spot = opsSpot ?? (available.length > 0 ? available : stationTargets)[Math.floor(Math.random() * (available.length > 0 ? available.length : stationTargets.length))]
        const target = { x: spot.x, y: spot.y }
        return prev.map(a => {
          if (a.id !== agent.id) return a
          return {
            ...a,
            state: 'walking-to-desk' as const,
            targetPosition: target,
            deskPosition: target,
            assignedSpotId: spot.id,
            spriteFacing: spot.spriteFacing,
            task: task?.title ?? a.task,
            statusText: task?.lastAction ?? 'crossing the deck',
            pathQueue: computePath(a.position, target, 'station-command'),
          }
        })
      })
    }, 6500)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let rafId: number
    let lastTime = performance.now()

    function tick(now: number) {
      const dt = Math.min((now - lastTime) / 16.67, 3)
      lastTime = now
      const speed = WALK_SPEED * dt * 0.75
      let changed = false

      const next = quantumAgentsRef.current.map(agent => {
        const queue = agent.pathQueue ?? []
        const immediateTarget = queue.length > 0 ? queue[0] : agent.targetPosition
        const { position, arrived } = stepToward(agent.position, immediateTarget, speed)
        let updated: Agent = position.x !== agent.position.x || position.y !== agent.position.y
          ? (changed = true, { ...agent, position })
          : agent

        if (arrived) {
          if (queue.length > 0) {
            updated = { ...updated, position, pathQueue: queue.slice(1) }
            changed = true
          } else if (agent.state !== 'working') {
            updated = { ...updated, position, state: 'working', statusText: 'in lab' }
            changed = true
          }
        }

        return updated
      })

      if (changed) setQuantumAgents(next)
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  useEffect(() => {
    const quantumTargets = QUANTUM_ROOM.agentSpots.filter(s => s.type === 'desk' || s.type === 'standing')
    const interval = setInterval(() => {
      setQuantumAgents(prev => {
        if (prev.length === 0 || quantumTargets.length === 0) return prev
        const agent = prev[Math.floor(Math.random() * prev.length)]
        const task = getTaskForAgent(agent, missionTasksRef.current)
        const opsSpot = task?.currentRoom === 'quantum-core' && task.targetSpotId
          ? QUANTUM_ROOM.agentSpots.find(s => s.id === task.targetSpotId)
          : undefined
        const available = quantumTargets.filter(s => s.id !== agent.assignedSpotId)
        const pool = available.length > 0 ? available : quantumTargets
        const spot = opsSpot ?? pool[Math.floor(Math.random() * pool.length)]
        const target = { x: spot.x, y: spot.y }
        return prev.map(a => {
          if (a.id !== agent.id) return a
          return {
            ...a,
            state: 'walking-to-desk' as const,
            targetPosition: target,
            deskPosition: target,
            assignedSpotId: spot.id,
            spriteFacing: spot.spriteFacing,
            task: task?.title ?? a.task,
            statusText: task?.lastAction ?? 'checking the core',
            pathQueue: computePath(a.position, target, 'quantum-core'),
          }
        })
      })
    }, 7200)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let rafId: number
    let lastTime = performance.now()

    function tick(now: number) {
      const dt = Math.min((now - lastTime) / 16.67, 3)
      lastTime = now
      const speed = WALK_SPEED * dt * 0.75
      let changed = false

      const next = greenhouseAgentsRef.current.map(agent => {
        const queue = agent.pathQueue ?? []
        const immediateTarget = queue.length > 0 ? queue[0] : agent.targetPosition
        const { position, arrived } = stepToward(agent.position, immediateTarget, speed)
        let updated: Agent = position.x !== agent.position.x || position.y !== agent.position.y
          ? (changed = true, { ...agent, position })
          : agent

        if (arrived) {
          if (queue.length > 0) {
            updated = { ...updated, position, pathQueue: queue.slice(1) }
            changed = true
          } else if (agent.state !== 'working') {
            updated = { ...updated, position, state: 'working', statusText: 'in greenhouse' }
            changed = true
          }
        }

        return updated
      })

      if (changed) setGreenhouseAgents(next)
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  useEffect(() => {
    const greenhouseTargets = GREENHOUSE_ROOM.agentSpots.filter(s => s.type === 'desk' || s.type === 'standing')
    const interval = setInterval(() => {
      setGreenhouseAgents(prev => {
        if (prev.length === 0 || greenhouseTargets.length === 0) return prev
        const agent = prev[Math.floor(Math.random() * prev.length)]
        const task = getTaskForAgent(agent, missionTasksRef.current)
        const opsSpot = task?.currentRoom === 'orbital-greenhouse' && task.targetSpotId
          ? GREENHOUSE_ROOM.agentSpots.find(s => s.id === task.targetSpotId)
          : undefined
        const available = greenhouseTargets.filter(s => s.id !== agent.assignedSpotId)
        const pool = available.length > 0 ? available : greenhouseTargets
        const spot = opsSpot ?? pool[Math.floor(Math.random() * pool.length)]
        const target = { x: spot.x, y: spot.y }
        return prev.map(a => {
          if (a.id !== agent.id) return a
          return {
            ...a,
            state: 'walking-to-desk' as const,
            targetPosition: target,
            deskPosition: target,
            assignedSpotId: spot.id,
            spriteFacing: spot.spriteFacing,
            task: task?.title ?? a.task,
            statusText: task?.lastAction ?? 'checking grow pods',
            pathQueue: computePath(a.position, target, 'orbital-greenhouse'),
          }
        })
      })
    }, 7600)

    return () => clearInterval(interval)
  }, [])

  // ---------------------------------------------------------------------------
  // Random office events — fire every 60-120 seconds
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Percentage-based target positions for each event type (matching room layout)
    const EVENT_TARGETS: Record<string, { x: number; y: number }> = {
      'fire-drill': { x: 67.5, y: 48.9 },
      'pizza':      { x: 67.5, y: 48.9 },
      'standup':    { x: 28.9, y: 66.0 },
      'birthday':   { x: 73.5, y: 56.7 },
      'printer-jam': { x: 83.8, y: 63 },
    }

    const bossCfg = AGENT_CONFIGS[BOSS_ROLE] ?? AGENT_CONFIGS['default']

    function fireEvent() {
      const event = pickEvent()

      // Post main slack announcement (system message)
      addMsg('system', 'default', '#8b8d91', event.slackAnnouncement, true)

      // Play associated sound
      if (event.sound && !sfx.isMuted()) {
        switch (event.sound) {
          case 'alarm':        sfx.playAlarm(); break
          case 'celebration':  sfx.playCelebration(); break
          case 'doorOpen':     sfx.playDoorOpen(); break
          case 'error':        sfx.playError(); break
          case 'powerDown':    sfx.playPowerDown(); break
          case 'notification': sfx.playNotification(); break
          case 'coffee':       sfx.playCoffee(); break
        }
      }

      // Manager message from boss
      if (event.managerMessage) {
        setTimeout(() => {
          addMsg(bossCfg.title, BOSS_ROLE, bossCfg.color, event.managerMessage!)
        }, 500)
      }

      // Staggered agent messages as reactions
      const messages = event.agentMessages ?? []
      const currentAgents = agentsRef.current
      // Build list of participating agents (include boss)
      const participants = currentAgents.filter(a => a.id === BOSS_ID || a.state === 'working' || a.state === 'coffee-break')

      // Pick ONE random agent message (not a wall of spam)
      if (messages.length > 0) {
        const text = messages[Math.floor(Math.random() * messages.length)]
        setTimeout(() => {
          const nonBoss = participants.filter(a => a.id !== BOSS_ID)
          if (nonBoss.length === 0) return
          const agent = nonBoss[Math.floor(Math.random() * nonBoss.length)]
          const cfg = AGENT_CONFIGS[agent.role] ?? AGENT_CONFIGS['default']
          addMsg(agent.name, agent.role, cfg.color, text)
        }, 1200)
      }

      // Handle event types
      if (event.type === 'all-move') {
        const target = EVENT_TARGETS[event.id] ?? { x: 67.5, y: 48.9 }

        // Move all agents (including boss) to target
        setAgents(prev => prev.map(a => ({
          ...a,
          state: 'walking-to-desk' as const,
          targetPosition: { ...target },
          statusText: event.name,
          pathQueue: computePath(a.position, target),
        })))

        // After duration, send agents back to their desks
        setTimeout(() => {
          setAgents(prev => prev.map(a => ({
            ...a,
            state: 'walking-to-desk' as const,
            targetPosition: { ...a.deskPosition },
            statusText: 'back to work',
            pathQueue: computePath(a.position, a.deskPosition),
          })))
        }, event.duration)

      } else if (event.type === 'single-agent') {
        const target = EVENT_TARGETS[event.id] ?? { x: 83.8, y: 63 }
        // Pick a random non-boss working agent
        const workers = agentsRef.current.filter(a => a.id !== BOSS_ID && (a.state === 'working' || a.state === 'walking-to-desk'))
        if (workers.length > 0) {
          const chosen = workers[Math.floor(Math.random() * workers.length)]

          // Printer jam: break the printer when agent walks over
          if (event.id === 'printer-jam') {
            setFurnitureStates(prev => ({ ...prev, 'printer-1': 'broken' }))
          }

          setAgents(prev => prev.map(a => {
            if (a.id !== chosen.id) return a
            return {
              ...a,
              state: 'walking-to-desk' as const,
              targetPosition: { ...target },
              statusText: event.name,
              pathQueue: computePath(a.position, target),
            }
          }))
          // Return after duration, fix the printer
          setTimeout(() => {
            if (event.id === 'printer-jam') {
              setFurnitureStates(prev => ({ ...prev, 'printer-1': 'working' }))
            }
            setAgents(prev => prev.map(a => {
              if (a.id !== chosen.id) return a
              return {
                ...a,
                state: 'walking-to-desk' as const,
                targetPosition: { ...a.deskPosition },
                statusText: 'back to work',
                pathQueue: computePath(a.position, a.deskPosition),
              }
            }))
          }, event.duration)
        }

      } else if (event.type === 'visual-only') {
        // Power flicker: add CSS class for flicker animation
        setFlickering(true)
        setTimeout(() => setFlickering(false), event.duration)
      }
      // 'slack-only' events: messages already posted above — no movement
    }

    // Schedule first event after 60-120 seconds, then repeat
    function scheduleNext() {
      const delay = 60_000 + Math.random() * 60_000
      return setTimeout(() => {
        fireEvent()
        timerRef = scheduleNext()
      }, delay)
    }

    let timerRef = scheduleNext()
    return () => clearTimeout(timerRef)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addMsg])

  // ---------------------------------------------------------------------------
  // Ambient office sounds
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Start ambient hum (only if not muted)
    if (!sfx.isMuted()) {
      // Delay slightly to let AudioContext resume after first user interaction
      const startTimer = setTimeout(() => {
        sfx.playAmbientHum()
      }, 2000)
      return () => {
        clearTimeout(startTimer)
        sfx.stopAmbient()
      }
    }
    return () => sfx.stopAmbient()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keyboard clatter every 2-4 seconds when agents are working
  useEffect(() => {
    const interval = setInterval(() => {
      if (sfx.isMuted()) return
      const working = agentsRef.current.filter(a => a.state === 'working')
      if (working.length === 0) return
      sfx.playKeyboardClatter()
    }, 2000 + Math.random() * 2000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Stop/start ambient when mute changes
  useEffect(() => {
    if (muted) {
      sfx.stopAmbient()
    } else {
      sfx.playAmbientHum()
    }
  }, [muted])

  // ---------------------------------------------------------------------------
  // Misc handlers
  // ---------------------------------------------------------------------------

  // Effective day phase (respects manual override)
  const effectivePhase: DayPhase = dayNightMode === 'auto' ? dayPhase
    : dayNightMode === 'day' ? 'morning' : 'night'
  const isNight = effectivePhase === 'night' || effectivePhase === 'dusk'

  const [volume, setVolume] = useState(sfx.getVolume())

  const handleToggleMute = useCallback(() => {
    const nowMuted = sfx.toggleMute()
    setMuted(nowMuted)
    setVolume(sfx.getVolume())
  }, [])

  const handleVolumeChange = useCallback((v: number) => {
    sfx.setVolume(v)
    setVolume(v)
    setMuted(v === 0)
  }, [])

  const roomDayImage = isMainOfficeRoom ? getRoomImage('day') : currentRoomDef.background.day
  const roomNightImage = isMainOfficeRoom ? getRoomImage('night') : currentRoomDef.background.night
  const activeFurniture = currentRoomDef.furniture.map(item => {
    const stateOverride = furnitureStates[item.id]
    if (!stateOverride) return item
    if (item.id === 'coffee' && stateOverride === 'on') {
      return { ...item, sprite: 'coffee-on' }
    }
    if (item.id === 'filing-1' && stateOverride === 'open') {
      return { ...item, sprite: 'filing-open' }
    }
    if (item.id === 'printer-1' && stateOverride === 'broken') {
      return { ...item, sprite: 'printer-broken' }
    }
    return item
  })
  const activeConnections = currentRoomDef.connections.filter(conn => {
    if (currentRoom === 'main-office') return conn.toRoom === 'station-command'
    if (currentRoom === 'station-command') return conn.toRoom === 'main-office' || conn.toRoom === 'quantum-core' || conn.toRoom === 'orbital-greenhouse'
    if (currentRoom === 'quantum-core') return conn.toRoom === 'station-command'
    if (currentRoom === 'orbital-greenhouse') return conn.toRoom === 'station-command'
    return true
  })
  const visibleAgents = isStationRoom ? stationAgents : isQuantumRoom ? quantumAgents : isGreenhouseRoom ? greenhouseAgents : agents
  const activeRoomProps = ROOM_PROP_HOTSPOTS.filter(prop => prop.roomId === currentRoom)

  // ---------------------------------------------------------------------------
  // Render — helper mode renders PlacementHelper in place of the full app
  // ---------------------------------------------------------------------------

  if (isHelperMode) {
    return (
      <Suspense fallback={<div style={{ color: '#666', padding: 20 }}>Loading helper...</div>}>
        <PlacementHelper />
      </Suspense>
    )
  }

  return (
    <div className="app-wrapper">
      <div className="title-bar">
        <div className="title-bar-dot" style={{ background: '#ff5f57' }} />
        <div className="title-bar-dot" style={{ background: '#febc2e' }} />
        <div className="title-bar-dot" style={{ background: '#28c840' }} />
        <span className="title-bar-text">WARD AGENT STUDIO</span>
        <button
          className="title-bar-control"
          type="button"
          title="Open Ward Mission Control"
          aria-label="Open Ward Mission Control"
          onClick={() => {
            setWardMissionOpen(true)
            setSelectedAgentId(null)
            setOpenRoomProp(null)
            setMissionQueueOpen(false)
          }}
        >
          CONTROL
        </button>
        <button
          className="title-bar-daynight"
          onClick={() => setDayNightMode(prev =>
            prev === 'auto' ? 'day' : prev === 'day' ? 'night' : 'auto'
          )}
          title={`Mode: ${dayNightMode}`}
        >
          {dayNightMode === 'auto' ? 'AUTO' : dayNightMode === 'day' ? 'DAY' : 'NIGHT'}
        </button>
        <span className="title-bar-phase">{getPhaseLabel(effectivePhase)}</span>
      </div>

      <div className="app-body">
      <div className="office-view">
        <div
          className={`room-container${flickering ? ' flickering' : ''}${roomTransitioning ? ' room-transitioning' : ''}`}
          style={{
            aspectRatio: '4800/3584',
            width: '100%',
            maxHeight: '100%',
            position: 'relative',
          }}
        >
          {/* Room backgrounds — both rendered, night crossfades via opacity. Theme swaps source art. */}
          <div
            key={`day-${theme}-${currentRoom}`}
            className="room-background"
            style={{ backgroundImage: `url(${roomDayImage})` }}
          />
          <div
            key={`night-${theme}-${currentRoom}`}
            className="room-background room-background-night"
            style={{
              backgroundImage: `url(${roomNightImage})`,
              opacity: dayNightMode === 'auto' ? nightOpacity : dayNightMode === 'night' ? 1 : 0,
            }}
          />

          <div className="room-label">{currentRoomDef.name}</div>

          {/* Furniture — apply interactive state overrides */}
          <FurnitureRenderer onItemClick={isMainOfficeRoom ? handleFurnitureClick : undefined} items={activeFurniture} />

          {/* Door transitions */}
          {activeConnections.map(conn => {
            const label = conn.label ?? ROOMS[conn.toRoom].name
            return (
              <button
                key={`${currentRoom}-${conn.toRoom}`}
                className="room-door-hotspot room-door-hotspot-subtle"
                style={{ left: `${conn.position.x}%`, top: `${conn.position.y}%` }}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => handleRoomTransition(conn.toRoom)}
              >
                <span className="door-label">{label}</span>
                <span className="door-arrow">&gt;</span>
              </button>
            )
          })}

          {/* Clickable ops props */}
          {activeRoomProps.map(prop => (
            <button
              key={prop.id}
              className="room-door-hotspot room-door-hotspot-subtle room-prop-hotspot"
              style={{ left: `${prop.position.x}%`, top: `${prop.position.y}%` }}
              type="button"
              title={prop.label}
              aria-label={prop.label}
              onClick={() => {
                setSelectedAgentId(null)
                setWardMissionOpen(false)
                if (prop.kind === 'mission') {
                  setMissionQueueOpen(true)
                  setOpenRoomProp(null)
                } else if (prop.kind === 'today') {
                  setMissionQueueOpen(false)
                  setOpenRoomProp(null)
                  setWardMissionOpen(true)
                } else {
                  setMissionQueueOpen(false)
                  setOpenRoomProp(prop.kind)
                }
              }}
            >
              <span className="door-label">{prop.label}</span>
              <span className="door-arrow">i</span>
            </button>
          ))}

          {/* Agents */}
          {visibleAgents.map(agent => {
            // Use spot zIndex override when agent is at their desk
            const spot = currentRoomDef.agentSpots.find(s => s.id === agent.assignedSpotId)
            const atDesk = Math.abs(agent.position.x - agent.deskPosition.x) < 1 &&
                           Math.abs(agent.position.y - agent.deskPosition.y) < 1
            const zOverride = atDesk && spot?.zIndex ? spot.zIndex : undefined

            const meta = agentMetaRef.current.get(agent.id)
            const idleDurationMs =
              agent.state === 'idle' && meta?.idleSince
                ? Date.now() - meta.idleSince
                : 0
            const opsTask = getTaskForAgent(agent, missionTasks)
            const opsStatus = opsTask?.status ?? 'idle'

            return (
              <Character
                key={agent.id}
                agent={agent}
                idleDurationMs={idleDurationMs}
                zIndex={zOverride}
                isTyping={typingAgents.has(agent.id)}
                onClick={(clickedAgent) => {
                  setSelectedAgentId(clickedAgent.id)
                  setMissionQueueOpen(false)
                  setOpenRoomProp(null)
                  setWardMissionOpen(false)
                }}
                selected={selectedAgentId === agent.id}
                opsStatus={opsStatus}
                opsProgress={opsTask?.progress ?? 0}
                opsLabel={opsTask ? statusLabel(opsTask.status) : 'idle'}
              />
            )
          })}

          {/* Angela's cat — follows whoever is cast as Angela in Office theme */}
          {(() => {
            if (!isMainOfficeRoom) return null
            const angela = getAngelaCat()
            if (!angela) return null
            const host = agents.find(a => a.role === angela.role)
            if (!host) return null
            return (
              <img
                src={angela.catSprite}
                alt="cat"
                className="angela-cat"
                style={{
                  position: 'absolute',
                  left: `${host.position.x + 2.2}%`,
                  top: `${host.position.y}%`,
                  // Why: cats are 30-40% of ~78px character = ~24-30px tall
                  height: 28,
                  width: 'auto',
                  transform: 'translate(-50%, -10%)',
                  zIndex: Math.round(host.position.y) + 1,
                  pointerEvents: 'none',
                  filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))',
                }}
                draggable={false}
              />
            )
          })()}

          {/* Boss interaction effect */}
          {bossEffect && (() => {
            if (!isMainOfficeRoom) return null
            const boss = agents.find(a => a.id === BOSS_ID)
            if (!boss) return null
            return (
              <div
                className="boss-interaction-effect"
                style={{
                  position: 'absolute',
                  left: `${boss.position.x}%`,
                  top: `${boss.position.y - 8}%`,
                  transform: 'translate(-50%, -100%)',
                  zIndex: 999,
                  pointerEvents: 'none',
                }}
              >
                <img
                  src={bossEffect}
                  alt="interaction"
                  style={{ height: 32, width: 'auto', imageRendering: 'pixelated' }}
                />
              </div>
            )
          })()}

          {/* Day/night overlay */}
          <div className={`day-overlay ${effectivePhase}`} />

          {selectedAgent && (
            <AgentInspector
              agent={selectedAgent}
              task={selectedAgentTask}
              onClose={() => setSelectedAgentId(null)}
            />
          )}
          {missionQueueOpen && (
            <MissionQueue
              tasks={missionTasks}
              onClose={() => setMissionQueueOpen(false)}
            />
          )}
          {openRoomProp && (
            <RoomPropPanel
              kind={openRoomProp}
              tasks={missionTasks}
              onClose={() => setOpenRoomProp(null)}
            />
          )}
          {wardMissionOpen && (
            <WardMissionControl
              tasks={missionTasks}
              onStartMission={handleStartPortfolioMission}
              onClose={() => setWardMissionOpen(false)}
            />
          )}
        </div>
      </div>

      <SlackChat
        messages={messages}
        muted={muted}
        volume={volume}
        onToggleMute={handleToggleMute}
        onVolumeChange={handleVolumeChange}
        onSendMessage={(text) => {
          const bossCfg = AGENT_CONFIGS[BOSS_ROLE] ?? AGENT_CONFIGS['default']
          addMsg(bossCfg.title, BOSS_ROLE, bossCfg.color, text)
          setAutoTypeText(undefined)
          // Send to server so Codex can read it
          fetch('http://127.0.0.1:3334/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender: bossCfg.title, text }),
          }).catch(() => {})
        }}
        autoTypeText={autoTypeText}
        dayPhase={effectivePhase}
        typingUser={chatTypingUser}
        lastSeenId={lastSeenId}
        onReaction={(messageId, reactions) => {
          setMessages(prev => prev.map(m =>
            m.id === messageId ? { ...m, reactions } : m
          ))
        }}
      />
      </div>
    </div>
  )
}

export default App
