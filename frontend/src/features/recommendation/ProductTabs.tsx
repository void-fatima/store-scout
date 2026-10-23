import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import type { ProductTab } from './presentation'

const productTabs: readonly { id: ProductTab; label: string }[] = [
  { id: 'specs', label: 'مشخصات کالا' }, { id: 'fit', label: 'تناسب با نیاز من' },
]

export function ProductTabs({ selected, prefix, onSelect }: { selected: ProductTab; prefix: string; onSelect: (tab: ProductTab) => void }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const previous = useRef(selected)
  useEffect(() => {
    if (previous.current !== selected) buttons.current[productTabs.findIndex(tab => tab.id === selected)]?.focus()
    previous.current = selected
  }, [selected])
  function keyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? productTabs.length - 1
      : event.key === 'ArrowLeft' ? (index + 1) % productTabs.length
        : event.key === 'ArrowRight' ? (index + productTabs.length - 1) % productTabs.length : null
    if (target === null) return
    event.preventDefault()
    buttons.current[target]?.focus()
    const tab = productTabs[target]
    if (tab) onSelect(tab.id)
  }
  return <div className="product-tabs" role="tablist" aria-label="بخش‌های جزئیات کالا" aria-orientation="horizontal">
    {productTabs.map((tab, index) => <button type="button" key={tab.id} role="tab" id={`${prefix}-${tab.id}-tab`}
      aria-controls={`${prefix}-${tab.id}-panel`} aria-selected={selected === tab.id} tabIndex={selected === tab.id ? 0 : -1}
      ref={node => { buttons.current[index] = node }} onClick={() => onSelect(tab.id)} onKeyDown={event => keyDown(event, index)}>{tab.label}</button>)}
  </div>
}
