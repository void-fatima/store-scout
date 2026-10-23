import { useEffect, useState } from 'react'

function currentView(): 'search' | 'comparison' {
  return window.location.hash === '#comparison' ? 'comparison' : 'search'
}

/** The URL fragment is the navigation source; it contains no shopping state. */
export function useJourneyView() {
  const [view, setView] = useState(currentView)
  useEffect(() => {
    const changed = () => {
      if (['', '#search', '#results', '#edit-search', '#comparison', '#guide', '#about', '#alternatives'].includes(window.location.hash) || /^#(?:explanation|alternative|checklist)\//.test(window.location.hash)) {
        setView(currentView())
        if (window.location.hash === '#guide') requestAnimationFrame(() => document.getElementById('guide')?.focus())
      }
    }
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [])
  return view
}
