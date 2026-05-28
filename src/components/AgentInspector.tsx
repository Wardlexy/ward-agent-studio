import React from 'react'
import { AGENT_CONFIGS, type Agent } from '../types'
import { ROOMS } from '../rooms'
import type { MissionTask } from '../ops/types'
import { elapsedLabel, statusLabel } from '../ops/agentOps'

interface AgentInspectorProps {
  agent: Agent
  task?: MissionTask
  onClose: () => void
}

const AgentInspector: React.FC<AgentInspectorProps> = ({ agent, task, onClose }) => {
  const progress = task?.progress ?? (agent.state === 'working' ? 12 : 0)
  const status = task?.status ?? (agent.state === 'working' ? 'idle' : 'idle')
  const roomName = ROOMS[task?.currentRoom ?? agent.room]?.name ?? agent.room
  const agentTitle = AGENT_CONFIGS[agent.role]?.title ?? agent.role

  return (
    <section className="ops-panel agent-inspector" aria-label="Agent inspector">
      <header className="ops-panel-header">
        <div>
          <div className="ops-kicker">Agent Inspector</div>
          <h2>{agent.name}</h2>
        </div>
        <button className="ops-close" type="button" onClick={onClose} aria-label="Close agent inspector">x</button>
      </header>

      <div className="ops-agent-meta">
        <span>{agentTitle}</span>
        <span>{roomName}</span>
      </div>

      <div className={`ops-status-row status-${status}`}>
        <span>{statusLabel(status)}</span>
        <strong>{progress}%</strong>
      </div>
      <div className="ops-progress-track">
        <div className={`ops-progress-fill status-${status}`} style={{ width: `${progress}%` }} />
      </div>

      <dl className="ops-detail-list">
        <div>
          <dt>Current task</dt>
          <dd>{task?.title ?? agent.task ?? 'Standing by'}</dd>
        </div>
        <div>
          <dt>Last action</dt>
          <dd>{task?.lastAction ?? agent.statusText ?? 'Waiting for a mission'}</dd>
        </div>
        <div>
          <dt>Elapsed</dt>
          <dd>{elapsedLabel(task?.createdAt ?? agent.hiredAt)}</dd>
        </div>
        <div>
          <dt>Output</dt>
          <dd>{task?.outputSummary ?? task?.resultSummary ?? 'No output yet'}</dd>
        </div>
      </dl>

      {task?.log?.length ? (
        <div className="ops-log">
          {task.log.slice(-3).map((line, index) => (
            <p key={`${task.id}-${index}`}>{line}</p>
          ))}
        </div>
      ) : null}
    </section>
  )
}

export default AgentInspector
