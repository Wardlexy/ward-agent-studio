import React from 'react'
import type { MissionTask, RoomPropKind } from '../ops/types'
import { filterTasksForPanel, statusLabel } from '../ops/agentOps'
import { portfolioDashboardData } from '../portfolio/demoData'

interface RoomPropPanelProps {
  kind: RoomPropKind
  tasks: MissionTask[]
  onClose: () => void
}

const PANEL_COPY: Record<RoomPropKind, { kicker: string; title: string; empty: string }> = {
  today: {
    kicker: 'Today',
    title: "Today's Tasks",
    empty: 'No active tasks yet',
  },
  mission: {
    kicker: 'Command Deck',
    title: 'Mission Queue',
    empty: 'No missions on deck',
  },
  build: {
    kicker: 'Quantum Core',
    title: 'Build / Test Logs',
    empty: 'No build or test work running',
  },
  ideas: {
    kicker: 'Greenhouse Bay',
    title: 'Ideas / Research Backlog',
    empty: 'No ideas growing yet',
  },
}

const RoomPropPanel: React.FC<RoomPropPanelProps> = ({ kind, tasks, onClose }) => {
  const copy = PANEL_COPY[kind]
  const visibleTasks = filterTasksForPanel(kind, tasks)
  const supportItems =
    kind === 'ideas'
      ? [...portfolioDashboardData.projectIdeas, ...portfolioDashboardData.learningRoadmap].slice(0, 5)
      : kind === 'today'
        ? portfolioDashboardData.todayNextSteps
        : kind === 'build'
          ? portfolioDashboardData.buildLog
          : []

  return (
    <section className="ops-panel room-prop-panel" aria-label={copy.title}>
      <header className="ops-panel-header">
        <div>
          <div className="ops-kicker">{copy.kicker}</div>
          <h2>{copy.title}</h2>
        </div>
        <button className="ops-close" type="button" onClick={onClose} aria-label={`Close ${copy.title}`}>x</button>
      </header>

      {visibleTasks.length === 0 && supportItems.length === 0 ? (
        <p className="ops-empty">{copy.empty}</p>
      ) : (
        <div className="ops-log-list">
          {visibleTasks.map(task => (
            <article key={task.id} className={`ops-log-card status-${task.status}`}>
              <div className="ops-task-topline">
                <strong>{task.title}</strong>
                <span>{statusLabel(task.status)}</span>
              </div>
              <p>{task.description}</p>
              <div className="ops-log-lines">
                {task.log.slice(-3).map((line, index) => (
                  <span key={`${task.id}-${index}`}>{line}</span>
                ))}
              </div>
            </article>
          ))}
          {supportItems.map(item => (
            <article key={item.id} className={`ops-log-card status-${item.status}`}>
              <div className="ops-task-topline">
                <strong>{item.title}</strong>
                <span>{statusLabel(item.status)}</span>
              </div>
              <p>{item.description}</p>
              <div className="ops-log-lines">
                <span>{item.nextAction}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default RoomPropPanel
