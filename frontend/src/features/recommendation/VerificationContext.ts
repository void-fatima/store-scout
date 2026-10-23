import { createContext } from 'react'
import type { ComparisonKey, FollowupPlan } from '../../contracts'

/** Exposes existing controller selection; this context owns no shopping state. */
export const VerificationContext = createContext<{ key: ComparisonKey; plan: FollowupPlan } | null | undefined>(undefined)
