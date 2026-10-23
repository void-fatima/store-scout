import { useContext } from 'react'
import type { ResponseEntry } from '../../journey/operations'
import { sameValue } from '../../journey/operations'
import { VerificationContext } from './VerificationContext'

export function hasOwningPlan(entry: ResponseEntry): boolean {
  return !!entry.plan && entry.plan.product_id === entry.key.product_id && entry.plan.offer_id === entry.key.offer_id
    && entry.plan.shop_id === entry.result.shop_id && entry.result.product_id === entry.key.product_id
    && entry.result.candidate.product.product_id === entry.key.product_id && entry.result.candidate.offer_id === entry.key.offer_id
    && entry.result.candidate.shop.shop_id === entry.result.shop_id
}

/** Read the existing controller selection; this hook owns no verification state. */
export function useOwningVerification(entry: ResponseEntry) {
  const selection = useContext(VerificationContext)
  if (!hasOwningPlan(entry)) return null
  return selection === undefined ? entry.plan
    : selection && sameValue(selection.key, entry.key) && selection.plan === entry.plan ? selection.plan : null
}
