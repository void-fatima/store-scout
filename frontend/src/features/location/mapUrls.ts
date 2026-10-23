import type { Shop } from '../../contracts'

// OSM's standard map uses Web Mercator; geographic poles are valid coordinates
// but cannot be represented by that projection. Never move the recorded marker.
export const mercatorLimit = 85.05112878

export function recordedPosition(shop: Pick<Shop, 'lat' | 'lon'>) {
  const { lat, lon } = shop
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)
    || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  const external = new URL('https://www.openstreetmap.org/')
  external.search = new URLSearchParams({ mlat: String(lat), mlon: String(lon) }).toString()
  external.hash = `map=16/${lat}/${lon}`
  let embed: string | null = null
  if (Math.abs(lat) <= mercatorLimit) {
    const url = new URL('https://www.openstreetmap.org/export/embed.html')
    url.search = new URLSearchParams({
      bbox: [Math.max(-180, lon - 0.01), Math.max(-mercatorLimit, lat - 0.006),
        Math.min(180, lon + 0.01), Math.min(mercatorLimit, lat + 0.006)].join(','),
      layer: 'mapnik', marker: `${lat},${lon}`,
    }).toString()
    embed = url.href
  }
  return { lat, lon, external: external.href, embed }
}
