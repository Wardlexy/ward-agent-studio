import React from 'react'
import type { JobApplicationItem } from '../portfolio/types'
import { statusLabel } from '../ops/agentOps'

interface JobHuntTrackerProps {
  items: JobApplicationItem[]
}

const JobHuntTracker: React.FC<JobHuntTrackerProps> = ({ items }) => (
  <div className="ward-item-list">
    {items.map(item => (
      <article key={item.id} className={`ward-item-card priority-${item.priority} status-${item.status}`}>
        <div>
          <strong>{item.role}</strong>
          <span>{item.priority}</span>
        </div>
        <p>{item.company}</p>
        <footer className="ward-card-footer">
          <small>{statusLabel(item.status)}</small>
          <small>{item.nextAction}</small>
        </footer>
      </article>
    ))}
  </div>
)

export default JobHuntTracker
