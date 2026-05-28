import React from 'react'
import type { LearningNote } from '../portfolio/types'
import { statusLabel } from '../ops/agentOps'

interface LearningRoadmapProps {
  items: LearningNote[]
}

const LearningRoadmap: React.FC<LearningRoadmapProps> = ({ items }) => (
  <div className="ward-item-list">
    {items.map(item => (
      <article key={item.id} className={`ward-item-card priority-${item.priority} status-${item.status}`}>
        <div>
          <strong>{item.title}</strong>
          <span>{item.skill}</span>
        </div>
        <p>{item.description}</p>
        <footer className="ward-card-footer">
          <small>{statusLabel(item.status)}</small>
          <small>{item.nextAction}</small>
        </footer>
      </article>
    ))}
  </div>
)

export default LearningRoadmap
