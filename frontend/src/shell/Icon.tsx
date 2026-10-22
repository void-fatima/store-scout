import type { ReactNode } from 'react'
type IconName = 'search' | 'pin' | 'book' | 'info' | 'chevron' | 'list' | 'map' | 'menu'
const paths: Record<IconName, ReactNode> = {
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  book: <path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.5" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  list: <><rect x="4" y="2" width="16" height="20" rx="3" /><path d="M8 7h8M8 12h8m-8 5h4" /></>,
  map: <><path d="m2 9 6-3 8 3 6-3v14l-6 3-8-3-6 3Zm6-3v14m8-11v14" /><path d="M17 5c0 3-3 6-3 6s-3-3-3-6a3 3 0 0 1 6 0Z" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
}
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={`ui-icon ${className}`} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
export function CompassMark() {
  return <svg className="brand-mark" width="44" height="52" viewBox="0 0 44 52" aria-hidden="true">
    <path fill="currentColor" d="m22 0 5 7a20 20 0 0 1 0 38l-5 7-5-7a20 20 0 0 1 0-38Z" />
    <circle cx="22" cy="26" r="14.5" fill="white" />
    <path d="m32 16-6 14-14 6 6-14Z" fill="currentColor" /><path d="m22 26 10-10-6 14Z" fill="#ff8e9f" />
  </svg>
}
