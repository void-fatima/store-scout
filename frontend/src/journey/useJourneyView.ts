import { useEffect, useState } from 'react'

function currentView() {
  return window.location.hash === '#comparison' ? 'comparison' : 'search'
}

/** The URL fragment is the navigation source; it contains no shopping state. */
export function useJourneyView() {
  const [view, setView] = useState(currentView)
  useEffect(() => {
    const changed = () => {
      if (['', '#search', '#comparison'].includes(window.location.hash)) setView(currentView())
    }
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [])
  return view
}
