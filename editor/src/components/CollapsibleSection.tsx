import { useState } from 'react'
import type { ReactNode } from 'react'

type CollapsibleSectionProps = {
  title: string
  children: ReactNode
  initialOpen?: boolean
  persistKey?: string
  onToggle?: (nextOpen: boolean) => void
}

function CollapsibleSection({
  title,
  children,
  initialOpen = true,
  persistKey,
  onToggle,
}: CollapsibleSectionProps) {
  const storageKey = `zodiac_editor.section.${encodeURIComponent(persistKey ?? title)}`
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored === 'true') {
        return true
      }
      if (stored === 'false') {
        return false
      }
    } catch {
      return initialOpen
    }
    return initialOpen
  })

  const toggleOpen = () => {
    setIsOpen((current) => {
      const next = !current
      try {
        localStorage.setItem(storageKey, String(next))
      } catch {
        return next
      }
      onToggle?.(next)
      return next
    })
  }
  return (
    <div className="section">
      <div className="collapsible-header" onClick={toggleOpen}>
        <h2>{title}</h2>
        <span className={`arrow ${isOpen ? 'open' : 'closed'}`}>▼</span>
      </div>
      {isOpen ? children : null}
    </div>
  )
}

export default CollapsibleSection
