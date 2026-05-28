import React from 'react'
import type { MissionTask } from '../ops/types'
import { statusLabel } from '../ops/agentOps'
import { AGENT_CONFIGS } from '../types'

interface MissionQueueProps {
  tasks: MissionTask[]
  onClose: () => void
}

const MissionQueue: React.FC<MissionQueueProps> = ({ tasks, onClose }) => {
  const active = tasks.filter(task => task.status !== 'done')
  const done = tasks.length - active.length

  return (
    <section className="ops-panel mission-queue" aria-label="Mission Queue">
      <header className="ops-panel-header">
        <div>
          <div className="ops-kicker">Mission Queue</div>
          <h2>{active.length} active / {done} done</h2>
        </div>
        <button className="ops-close" type="button" onClick={onClose} aria-label="Close mission queue">x</button>
      </header>

      <div className="ops-task-list">
        {tasks.map(task => {
          const cfg = AGENT_CONFIGS[task.assignedRole ?? 'default'] ?? AGENT_CONFIGS.default
          return (
            <article key={task.id} className={`ops-task-card status-${task.status}`}>
              <div className="ops-task-topline">
                <strong>{task.title}</strong>
                <span>{task.progress}%</span>
              </div>
              <p>{task.lastAction}</p>
              <div className="ops-task-meta">
                <span style={{ color: cfg.color }}>{cfg.title}</span>
                <span>{statusLabel(task.status)}</span>
              </div>
              <div className="ops-progress-track small">
                <div className={`ops-progress-fill status-${task.status}`} style={{ width: `${task.progress}%` }} />
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default MissionQueue
