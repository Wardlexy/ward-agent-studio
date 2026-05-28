import type { Agent } from '../types'
import type { MissionTask, OpsEvent, OpsStatus, RoomPropKind } from './types'

const STATUS_FLOW: OpsStatus[] = ['planning', 'researching', 'coding', 'testing', 'reviewing', 'done']

const ACTIONS: Record<OpsStatus, string[]> = {
  idle: ['Standing by for the next mission'],
  planning: ['Breaking the mission into tiny steps', 'Checking the next useful move', 'Updating the checklist'],
  researching: ['Scanning references', 'Ranking ideas by usefulness', 'Filtering out noisy options'],
  coding: ['Wiring the first usable path', 'Patching rough UI behavior', 'Keeping the implementation small'],
  testing: ['Clicking through the main flow', 'Checking room transitions', 'Looking for obvious regressions'],
  reviewing: ['Comparing screenshots', 'Checking visual alignment', 'Writing review notes'],
  blocked: ['Waiting on a blocker to clear'],
  done: ['Mission complete'],
}

function nextStatus(status: OpsStatus): OpsStatus {
  const index = STATUS_FLOW.indexOf(status)
  if (index < 0) return status
  return STATUS_FLOW[Math.min(index + 1, STATUS_FLOW.length - 1)]
}

function actionFor(status: OpsStatus, progress: number): string {
  const actions = ACTIONS[status] ?? ACTIONS.idle
  return actions[Math.floor((progress / 17) % actions.length)]
}

export function advanceMissions(
  tasks: MissionTask[],
  now: number,
  dtMs: number,
): { tasks: MissionTask[]; events: OpsEvent[] } {
  const events: OpsEvent[] = []

  const nextTasks = tasks.map(task => {
    if (task.status === 'done') return task

    let status: OpsStatus = task.status
    let progress = task.progress

    const shouldPause =
      task.id === 'mission-smoke-test' &&
      progress >= 56 &&
      progress < 66 &&
      Math.floor(now / 11_000) % 4 === 0

    if (shouldPause) {
      status = 'blocked'
      progress = Math.min(66, progress + dtMs / 10_000)
    } else {
      if (status === 'blocked') status = 'testing'
      const rate = status === 'coding' || status === 'testing' ? 0.9 : 0.65
      progress = Math.min(100, progress + (dtMs / 1000) * rate)

      if (progress >= 72 && status === 'planning') status = 'researching'
      if (progress >= 82) status = nextStatus(status)
      if (progress >= 100) status = 'done'
    }

    const roundedProgress = Math.round(progress)
    const statusChanged = status !== task.status
    const crossedStep = Math.floor(roundedProgress / 20) > Math.floor(task.progress / 20)
    const lastAction =
      status === 'done'
        ? 'Finished and ready to inspect'
        : status === 'blocked'
          ? 'Blocked on one flaky check'
          : actionFor(status, roundedProgress)

    const log = statusChanged || crossedStep
      ? [...task.log.slice(-4), lastAction]
      : task.log

    if (statusChanged || crossedStep) {
      events.push({
        taskId: task.id,
        agentRole: task.assignedRole,
        message: status === 'done'
          ? `done: ${task.title}`
          : `${status}: ${task.title} (${roundedProgress}%)`,
      })
    }

    return {
      ...task,
      status,
      progress: roundedProgress,
      lastAction,
      updatedAt: now,
      resultSummary: status === 'done'
        ? task.resultSummary ?? `${task.title} is ready to review.`
        : task.resultSummary,
      outputSummary: status === 'done'
        ? task.outputSummary ?? 'Output summarized in the mission log.'
        : task.outputSummary,
      log,
    }
  })

  return { tasks: nextTasks, events }
}

export function getTaskForAgent(agent: Agent, tasks: MissionTask[]): MissionTask | undefined {
  return tasks.find(task => task.assignedAgentId === agent.id) ??
    tasks.find(task => !task.assignedAgentId && task.assignedRole === agent.role)
}

export function filterTasksForPanel(kind: RoomPropKind, tasks: MissionTask[]): MissionTask[] {
  if (kind === 'build') {
    return tasks.filter(task =>
      task.currentRoom === 'quantum-core' ||
      task.status === 'coding' ||
      task.status === 'testing' ||
      task.status === 'blocked'
    )
  }
  if (kind === 'ideas') {
    return tasks.filter(task =>
      task.currentRoom === 'orbital-greenhouse' ||
      task.status === 'researching' ||
      task.status === 'planning'
    )
  }
  if (kind === 'today') return tasks
  return tasks
}

export function statusLabel(status: OpsStatus): string {
  return status.replace('-', ' ')
}

export function elapsedLabel(startedAt: number, now = Date.now()): string {
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes <= 0) return `${seconds}s`
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}
