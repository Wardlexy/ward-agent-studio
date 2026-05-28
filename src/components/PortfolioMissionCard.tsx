import React from 'react'
import type { PortfolioItem, PortfolioMissionTemplate } from '../portfolio/types'

interface PortfolioMissionCardProps {
  item: PortfolioItem
}

export const PortfolioMissionCard: React.FC<PortfolioMissionCardProps> = ({ item }) => (
  <article className={`ward-item-card priority-${item.priority} status-${item.status}`}>
    <div>
      <strong>{item.title}</strong>
      <span>{item.priority}</span>
    </div>
    <p>{item.description}</p>
    <footer className="ward-card-footer">
      <small>{item.owner}</small>
      <small>{item.nextAction}</small>
    </footer>
  </article>
)

interface MissionTemplateCardProps {
  template: PortfolioMissionTemplate
  isRunning: boolean
  onStart: (templateId: string) => void
}

export const MissionTemplateCard: React.FC<MissionTemplateCardProps> = ({ template, isRunning, onStart }) => (
  <article className={`ward-template-card priority-${template.priority} status-${template.status}`}>
    <div className="ward-template-title">
      <strong>{template.title}</strong>
      <span>{template.priority}</span>
    </div>
    <p>{template.goal}</p>
    <div className="ward-template-agents">{template.suggestedAgents.slice(0, 4).join(' + ')}</div>
    <button
      className="ward-start-button"
      type="button"
      onClick={() => onStart(template.id)}
      disabled={isRunning}
    >
      {isRunning ? 'Running' : 'Start Mission'}
    </button>
  </article>
)
