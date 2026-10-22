import type { AlternativeAcceptance as BackendAcceptance } from './generated/requests'
import type {
  AlternativesResponse,
  ComparisonKey as BackendComparisonKey,
  ComparisonState,
  ErrorResponse,
  FollowupPlan,
} from './generated/responses'

export type ComparisonKey = Readonly<BackendComparisonKey>
/** Local consent event, not an HTTP acceptance request or persisted consent. */
export type AlternativeAcceptance = Readonly<BackendAcceptance>

/**
 * Controlled boundary from Journey's API_HANDOFF.md. The parent owns responses,
 * revisions and comparison. Preserve backend ordering and uncertainty notices.
 * onAcceptAlternative requires explicit acceptance of every disclosed change;
 * the parent validates current request/revision/dataset before a fresh search.
 */
export type RecommendationPanelProps = Readonly<{
  requestId: ComparisonState['request_id']
  revision: ComparisonState['revision']
  response: AlternativesResponse | null
  comparison: readonly ComparisonKey[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: ErrorResponse | null
  onComparisonChange: (keys: readonly ComparisonKey[]) => void
  onViewVerification: (key: ComparisonKey, plan: FollowupPlan) => void
  onRetry: (requestId: ComparisonState['request_id'], revision: ComparisonState['revision']) => void
  onAcceptAlternative: (acceptance: AlternativeAcceptance) => void
}>
