import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import requests from '../contracts/generated/requests.schema.json'
import responses from '../contracts/generated/responses.schema.json'
import type { AlternativeAcceptance, ErrorResponse, JourneyRecommendations, ProductDetail, ShoppingRequest } from '../contracts'

// Use the generated canonical schemas, including nested verification/coverage.
// No coercion, default insertion or unknown-field removal at the HTTP boundary.
const ajv = new Ajv({ strict: false, coerceTypes: false, useDefaults: false })
addFormats(ajv)
export const isJourneyResponse = ajv.compile<JourneyRecommendations>({
  $defs: responses.$defs, $ref: '#/$defs/JourneyRecommendations',
})
export const isApiError = ajv.compile<ErrorResponse>({
  $defs: responses.$defs, $ref: '#/$defs/ErrorResponse',
})
export const isProductDetail = ajv.compile<ProductDetail>({
  $defs: responses.$defs, $ref: '#/$defs/ProductDetail',
})
export const isShoppingRequest = ajv.compile<ShoppingRequest>({
  $defs: requests.$defs, $ref: '#/$defs/ShoppingRequest',
})
export const isAlternativeAcceptance = ajv.compile<AlternativeAcceptance>({
  $defs: requests.$defs, $ref: '#/$defs/AlternativeAcceptance',
})
