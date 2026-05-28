import type { RoomId } from '../rooms'
import type { OpsStatus } from '../ops/types'

export type PortfolioPriority = 'low' | 'medium' | 'high'

export interface PortfolioItem {
  id: string
  title: string
  description: string
  status: OpsStatus
  priority: PortfolioPriority
  owner: string
  nextAction: string
}

export interface LearningNote {
  id: string
  title: string
  description: string
  skill: string
  status: OpsStatus
  priority: PortfolioPriority
  nextAction: string
}

export interface PromptItem {
  id: string
  title: string
  description: string
  category: string
  status: OpsStatus
  priority: PortfolioPriority
  nextAction: string
}

export interface JobApplicationItem {
  id: string
  company: string
  role: string
  status: OpsStatus
  priority: PortfolioPriority
  nextAction: string
}

export interface ActivityLogItem {
  id: string
  title: string
  description: string
  status: OpsStatus
  priority: PortfolioPriority
  owner: string
  nextAction: string
}

export interface PortfolioMissionTemplate {
  id: string
  title: string
  goal: string
  description: string
  priority: PortfolioPriority
  status: OpsStatus
  assignedRole: string
  assignedAgentId?: string
  currentRoom: RoomId
  targetSpotId: string
  suggestedAgents: string[]
  checklist: string[]
  expectedOutput: string
}

export interface PortfolioDashboardData {
  projectIdeas: PortfolioItem[]
  learningRoadmap: LearningNote[]
  promptLibrary: PromptItem[]
  jobHuntTracker: JobApplicationItem[]
  buildLog: ActivityLogItem[]
  todayNextSteps: PortfolioItem[]
}
