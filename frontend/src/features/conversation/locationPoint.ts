import type { IntentPatch } from '../../contracts/intent'
export type Coordinates = NonNullable<IntentPatch['coordinates']>
export type Point = Pick<Coordinates, 'latitude' | 'longitude'>
export function validPoint(point: Point | null | undefined): point is Point {
  return !!point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180
}
