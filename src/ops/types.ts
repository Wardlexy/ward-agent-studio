import type { RoomId } from '../rooms'

export type OpsStatus =
  | 'idle'
  | 'planning'
  | 'researching'
  | 'coding'
  | 'testing'
  | 'reviewing'
  | 'blocked'
  | 'done'

export type RoomPropKind = 'today' | 'mission' | 'build' | 'ideas'

export interface MissionTask {
  id: string
  title: string
  description: string
  assignedAgentId?: string
  assignedRole?: string
  status: OpsStatus
  progress: number
  currentRoom: RoomId
  targetSpotId?: string
  lastAction: string
  createdAt: number
  updatedAt: number
  resultSummary?: string
  outputSummary?: string
  log: string[]
}

export interface OpsEvent {
  taskId: string
  agentRole?: string
  message: string
}
