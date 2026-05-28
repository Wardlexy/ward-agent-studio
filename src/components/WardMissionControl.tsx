import React from 'react'
import type { MissionTask } from '../ops/types'
import { statusLabel } from '../ops/agentOps'
import { wardAgentBrief } from '../ops/wardMission'
import { portfolioDashboardData } from '../portfolio/demoData'
import { portfolioMissionTemplates } from '../portfolio/missionTemplates'
import { MissionTemplateCard, PortfolioMissionCard } from './PortfolioMissionCard'
import LearningRoadmap from './LearningRoadmap'
import PromptLibrary from './PromptLibrary'
import JobHuntTracker from './JobHuntTracker'

interface WardMissionControlProps {
  tasks: MissionTask[]
  onStartMission: (templateId: string) => void
  onClose: () => void
}

const WardMissionControl: React.FC<WardMissionControlProps> = ({ tasks, onStartMission, onClose }) => {
  const activeTasks = tasks.filter(task => task.status !== 'done')
  const topTasks = activeTasks.slice(0, 4)
  const averageProgress = tasks.length
    ? Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length)
    : 0
  const activeTemplateIds = new Set(
    activeTasks
      .map(task => portfolioMissionTemplates.find(template => task.id.includes(template.id))?.id)
      .filter(Boolean) as string[],
  )

  return (
    <section className="ops-panel ward-mission-control" aria-label="Ward Mission Control">
      <header className="ops-panel-header ward-mission-header">
        <div>
          <div className="ops-kicker">Ward Agent Studio</div>
          <h2>Ward Mission Control</h2>
          <p className="ward-product-line">Visual AI agent workspace for building projects, learning, prompts, and career prep.</p>
        </div>
        <button className="ops-close" type="button" onClick={onClose} aria-label="Close Ward Mission Control">x</button>
      </header>

      <div className="ward-mission-summary">
        <div>
          <span>Active Missions</span>
          <strong>{activeTasks.length}</strong>
        </div>
        <div>
          <span>Avg Progress</span>
          <strong>{averageProgress}%</strong>
        </div>
        <div>
          <span>Studio Mode</span>
          <strong>Portfolio</strong>
        </div>
      </div>

      <div className="ward-mission-scroll">
        <section className="ward-section active-missions-section">
          <div className="ward-section-heading">
            <span>Live Ops</span>
            <h3>Active Portfolio Missions</h3>
          </div>
          <div className="ward-active-list">
            {topTasks.map(task => (
              <article key={task.id} className={`ward-active-card status-${task.status}`}>
                <div className="ops-task-topline">
                  <strong>{task.title}</strong>
                  <span>{task.progress}%</span>
                </div>
                <p>{task.lastAction}</p>
                <div className="ops-task-meta">
                  <span>{task.currentRoom.replace('-', ' ')}</span>
                  <span>{statusLabel(task.status)}</span>
                </div>
                <div className="ops-progress-track small">
                  <div className={`ops-progress-fill status-${task.status}`} style={{ width: `${task.progress}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ward-section">
          <div className="ward-section-heading">
            <span>Start Here</span>
            <h3>Mission Templates</h3>
          </div>
          <div className="ward-template-grid">
            {portfolioMissionTemplates.map(template => (
              <MissionTemplateCard
                key={template.id}
                template={template}
                isRunning={activeTemplateIds.has(template.id)}
                onStart={onStartMission}
              />
            ))}
          </div>
        </section>

        <section className="ward-section">
          <div className="ward-section-heading">
            <span>Agent Squad</span>
            <h3>Who Does What</h3>
          </div>
          <div className="ward-brief-grid">
            {wardAgentBrief.map(item => (
              <article key={item.role} className="ward-brief-card">
                <strong>{item.role}</strong>
                <p>{item.output}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="ward-section-grid">
          <section className="ward-section">
            <div className="ward-section-heading">
              <span>Incubator</span>
              <h3>Project Ideas</h3>
            </div>
            <div className="ward-item-list">
              {portfolioDashboardData.projectIdeas.map(item => (
                <PortfolioMissionCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          <section className="ward-section">
            <div className="ward-section-heading">
              <span>Skill Log</span>
              <h3>Learning Roadmap</h3>
            </div>
            <LearningRoadmap items={portfolioDashboardData.learningRoadmap} />
          </section>

          <section className="ward-section">
            <div className="ward-section-heading">
              <span>Reusable</span>
              <h3>Prompt Library</h3>
            </div>
            <PromptLibrary items={portfolioDashboardData.promptLibrary} />
          </section>

          <section className="ward-section">
            <div className="ward-section-heading">
              <span>Career Prep</span>
              <h3>Job Hunt Tracker</h3>
            </div>
            <JobHuntTracker items={portfolioDashboardData.jobHuntTracker} />
          </section>

          <section className="ward-section">
            <div className="ward-section-heading">
              <span>Build Notes</span>
              <h3>Build Log / Agent Activity</h3>
            </div>
            <div className="ward-item-list">
              {portfolioDashboardData.buildLog.map(item => (
                <PortfolioMissionCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          <section className="ward-section">
            <div className="ward-section-heading">
              <span>Do Now</span>
              <h3>Today's Next Steps</h3>
            </div>
            <div className="ward-item-list">
              {portfolioDashboardData.todayNextSteps.map(item => (
                <PortfolioMissionCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}

export default WardMissionControl
