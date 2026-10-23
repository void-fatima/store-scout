import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'

function Toggle() {
  const [selected, setSelected] = useState(false)
  return <button aria-pressed={selected} onClick={() => setSelected(!selected)}>انتخاب</button>
}

it('supports React rendering, DOM matchers and user keyboard interaction', async () => {
  const user = userEvent.setup()
  render(<Toggle />)
  await user.tab()
  expect(screen.getByRole('button')).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
})

it('cleans the rendered DOM between tests', () => {
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
