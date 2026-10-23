import { useEffect, useState } from 'react'

/** Presentation navigation only; all shopping data remains in the controller. */
export function usePanelHash() {
  return usePanelNavigation().hash
}

export function usePanelNavigation() {
  const [navigation, setNavigation] = useState<{ hash: string; previousHash: string | null }>(() => ({ hash: window.location.hash, previousHash: null }))
  useEffect(() => {
    const changed = () => {
      const hash = window.location.hash
      setNavigation(previous => previous.hash === hash ? previous : { hash, previousHash: previous.hash })
    }
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [])
  return navigation
}
