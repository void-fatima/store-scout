import { useState } from 'react'
import type { ProductSummary } from '../../contracts'

function supportedImage(values: readonly string[] | undefined): string | null {
  for (const value of values ?? []) {
    try {
      const url = new URL(value, window.location.origin)
      if (url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === window.location.origin)) return url.href
    } catch { /* Invalid data is represented by the neutral visual. */ }
  }
  return null
}
export function ProductVisual({ product }: { product: ProductSummary }) {
  const source = supportedImage(product.image_urls)
  const [failed, setFailed] = useState<string | null>(null)
  return <div className="product-visual">
    {source && failed !== source
      ? <img src={source} alt={product.persian_title} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(source)} />
      : <div className="product-placeholder" role="img" aria-label="تصویر ثبت‌شدهٔ کالا در دسترس نیست">
        <svg width="100" height="112" viewBox="0 0 100 112" fill="none" aria-hidden="true">
          <path d="m50 12 35 20v48l-35 20-35-20V32Z" fill="currentColor" opacity=".09" />
          <path d="m50 12 35 20v48l-35 20-35-20V32Zm0 40L15 32m35 20 35-20M50 52v48M32 22l35 20v18" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        </svg><span>تصویر در دسترس نیست</span>
      </div>}
  </div>
}
