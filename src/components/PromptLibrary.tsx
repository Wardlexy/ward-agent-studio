import React from 'react'
import type { PromptItem } from '../portfolio/types'

interface PromptLibraryProps {
  items: PromptItem[]
}

const PromptLibrary: React.FC<PromptLibraryProps> = ({ items }) => (
  <div className="ward-item-list">
    {items.map(item => (
      <article key={item.id} className={`ward-item-card priority-${item.priority} status-${item.status}`}>
        <div>
          <strong>{item.title}</strong>
          <span>{item.category}</span>
        </div>
        <p>{item.description}</p>
        <footer className="ward-card-footer">
          <small>{item.priority} priority</small>
          <small>{item.nextAction}</small>
        </footer>
      </article>
    ))}
  </div>
)

export default PromptLibrary
