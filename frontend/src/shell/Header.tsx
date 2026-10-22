import { useState } from 'react'
import { CompassMark, Icon } from './Icon'

export function Header({ comparisonCount, view }: { comparisonCount: number; view: 'search' | 'comparison' }) {
  const [open, setOpen] = useState(false)
  return <header className="site-header">
    <div className="container header-inner">
      <a className="brand" href="#search" aria-label="استوراسکاوت، خانه" onClick={() => setOpen(false)}>
        <CompassMark /><span>استوراسکاوت<small lang="en" dir="ltr">StoreScout</small></span>
      </a>
      <button className="menu-toggle secondary-button" type="button" aria-label="فهرست ناوبری" aria-expanded={open} aria-controls="primary-navigation" onClick={() => setOpen(!open)}><Icon name="menu" /></button>
      <nav id="primary-navigation" className={open ? 'primary-nav is-open' : 'primary-nav'} aria-label="ناوبری اصلی" onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); document.querySelector<HTMLButtonElement>('.menu-toggle')?.focus() } }}>
        <a href="#search" aria-current={view === 'search' ? 'page' : undefined} onClick={() => setOpen(false)}>پیشنهادها</a>
        <a href="#comparison" aria-current={view === 'comparison' ? 'page' : undefined} onClick={() => setOpen(false)}>مقایسه <span className="comparison-count" aria-label={`${new Intl.NumberFormat('fa-IR').format(comparisonCount)} انتخاب`}>{new Intl.NumberFormat('fa-IR').format(comparisonCount)}</span></a>
        <a href="#guide" onClick={() => setOpen(false)}><Icon name="book" />راهنمای خرید</a>
      </nav>
      <span className="header-tagline"><Icon name="pin" />همراه خرید حضوری</span>
    </div>
  </header>
}
