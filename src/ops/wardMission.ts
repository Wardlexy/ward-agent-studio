export interface WardMissionItem {
  id: string
  title: string
  detail: string
  tag?: string
}

export interface WardMissionSection {
  id: string
  title: string
  kicker: string
  items: WardMissionItem[]
}

export const wardMissionSections: WardMissionSection[] = [
  {
    id: 'ideas',
    title: 'Project Ideas',
    kicker: 'Incubator',
    items: [
      {
        id: 'idea-learning-coach',
        title: 'AI Learning Coach',
        detail: 'Track what Ward learned, what error happened, and the next tiny exercise.',
        tag: 'useful',
      },
      {
        id: 'idea-prompt-lab',
        title: 'Prompt Lab',
        detail: 'Store prompt versions, compare outputs, and keep the prompt that actually works.',
        tag: 'creative',
      },
      {
        id: 'idea-asset-director',
        title: 'Asset Director',
        detail: 'Review sprites, rooms, screenshots, and write cleaner art prompts for the next asset pass.',
        tag: 'visual',
      },
    ],
  },
  {
    id: 'learning',
    title: 'Learning Notes',
    kicker: 'Skill Log',
    items: [
      {
        id: 'learn-react-state',
        title: 'React state is the control room',
        detail: 'Room, panel, and task behavior all become simple once the state shape is clear.',
      },
      {
        id: 'learn-small-scope',
        title: 'Small v1 beats giant idea',
        detail: 'Ship one useful panel first, then connect it to real agent output later.',
      },
      {
        id: 'learn-verify',
        title: 'Build plus screenshot is the checkpoint',
        detail: 'A feature is not done until it compiles and the important screen can be seen.',
      },
    ],
  },
  {
    id: 'prompts',
    title: 'Prompt Library',
    kicker: 'Reusable',
    items: [
      {
        id: 'prompt-mission',
        title: 'Mission prompt',
        detail: 'Goal, agent roles, v1 scope, constraints, verification, and expected result.',
      },
      {
        id: 'prompt-asset',
        title: 'Asset prompt',
        detail: 'Reference match, canvas, style, negative prompt, and exact target files.',
      },
      {
        id: 'prompt-review',
        title: 'Review prompt',
        detail: 'Ask for bugs first, screenshots second, and next steps last.',
      },
    ],
  },
  {
    id: 'next',
    title: "Today's Next Steps",
    kicker: 'Do Now',
    items: [
      {
        id: 'next-click',
        title: 'Click the board',
        detail: 'Use Ward Mission Control as the home base for deciding what the agents do next.',
      },
      {
        id: 'next-pick',
        title: 'Pick one real mission',
        detail: 'Choose Learning Coach, Prompt Lab, or Asset Director as the first useful project.',
      },
      {
        id: 'next-wire',
        title: 'Wire real output later',
        detail: 'Replace demo data with actual markdown logs or backend task results when ready.',
      },
    ],
  },
]

export const wardAgentBrief = [
  {
    role: 'Coordinator',
    output: 'Chooses priorities and breaks portfolio goals into small missions.',
  },
  {
    role: 'Researcher',
    output: 'Studies references, docs, job targets, and project ideas before Ward builds.',
  },
  {
    role: 'Builder',
    output: 'Implements app features and keeps the first usable version small.',
  },
  {
    role: 'Tester',
    output: 'Runs build checks, clicks the app flow, and captures proof screenshots.',
  },
  {
    role: 'Archivist',
    output: 'Writes README notes, changelog summaries, and learning logs.',
  },
  {
    role: 'Career Agent',
    output: 'Tracks job prep, CV bullets, interview notes, and application next steps.',
  },
  {
    role: 'Portfolio Curator',
    output: 'Turns projects into showcase material: screenshots, case studies, and GitHub polish.',
  },
]
