import { useEffect, useState } from 'react'

/** Presentation navigation only; all shopping data remains in the controller. */
export function usePanelHash() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const changed = () => setHash(window.location.hash)
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [])
  return hash
}
