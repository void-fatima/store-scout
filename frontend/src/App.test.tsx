import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import html from '../index.html?raw'
import App from './App'

it('renders semantic Persian navigation, content and the empty feature mount', () => {
  render(<App />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('با آگاهی بیشتر')
  expect(within(screen.getByRole('navigation', { name: 'ناوبری اصلی' }))
    .getByRole('link', { name: 'راهنمای خرید' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
  expect(document.getElementById('recommendation-root')).toBeEmptyDOMElement()
  expect(screen.getByRole('contentinfo')).toBeInTheDocument()
})

it('provides a keyboard-first skip link and reachable navigation', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.tab()
  const skip = screen.getByRole('link', { name: 'رفتن به محتوای اصلی' })
  expect(skip).toHaveFocus()
  expect(skip).toHaveAttribute('href', '#main-content')
  await user.keyboard('{Enter}')
  // jsdom does not implement browser fragment focus; assert a focusable target.
  expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1')
  await user.tab()
  expect(screen.getByRole('link', { name: 'استوراسکاوت، خانه' })).toHaveFocus()
})

it('serves the document in Persian with RTL direction', () => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  expect(doc.documentElement.getAttribute('lang')).toBe('fa')
  expect(doc.documentElement.getAttribute('dir')).toBe('rtl')
})
