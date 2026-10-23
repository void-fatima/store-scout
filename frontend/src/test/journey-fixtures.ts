import type { JourneyRecommendations, ShoppingRequest } from '../contracts'
import { journeyFixture } from './fixtures/contracts'
import { emptyDraft } from '../journey/criteria'

export const sampleDraft = () => ({ ...emptyDraft(), query: 'گوشی', budget: '۱۷۰۰۰۰۰۰٫۱۲۳۴۵۶۷۸۹',
  priceUnit: 'TOMAN' as const, latitude: '۳۵٫۷', longitude: '٥١٫٤' })

/** Only request identity/revision change; the canonical service evidence stays intact. */
export function associatedFixture(request: ShoppingRequest, source: JourneyRecommendations = journeyFixture) {
  const value = structuredClone(source)
  value.state.request_id = request.request_id
  value.state.revision = request.revision ?? 0
  return value
}
