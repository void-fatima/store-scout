import { expect, it, vi } from 'vitest'
import { errorFixture, productDetailFixture } from '../test/fixtures/contracts'
import { createProductDetailClient } from './productDetail'

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
const detail = productDetailFixture
const call = (fetcher: typeof fetch, productId = detail.item.product_id) => createProductDetailClient({ fetcher, baseUrl: 'http://localhost:8017/' })(productId, detail.context, new AbortController().signal)

it('GETs a safely encoded product ID using shared API configuration without credentials', async () => {
  const productId = 'product/?# فارسی'
  const value = { ...detail, item: { ...detail.item, product_id: productId } }
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(value))
  expect(await call(fetcher, productId)).toEqual({ ok: true, value })
  expect(fetcher).toHaveBeenCalledWith(`http://localhost:8017/api/v1/catalog/products/${encodeURIComponent(productId)}`, expect.objectContaining({ method: 'GET', credentials: 'omit', headers: { Accept: 'application/json' } }))
})

it('validates flexible JSON and empty specs without losing false, zero, units or duplicates', async () => {
  for (const specs of [[], [{ section: 'display', value: 0, enabled: false, nested: [null, { unit: 'GB' }] }, { value: 0 }]]) {
    const value = { ...detail, item: { ...detail.item, specs } }
    expect(await call(vi.fn<typeof fetch>().mockResolvedValue(json(value)))).toEqual({ ok: true, value })
  }
})

it('rejects product, dataset ID/hash/import, contract and absent-context mismatches', async () => {
  const changed = (field: string, value: unknown) => ({ ...detail, context: { ...detail.context, dataset: { ...detail.context.dataset, [field]: value } } })
  for (const value of [
    { ...detail, item: { ...detail.item, product_id: 'other' } },
    changed('dataset_id', 'other'), changed('source_sha256', 'other'), changed('imported_at', '2026-10-02T00:00:00Z'),
    { ...detail, context: { ...detail.context, dataset: null } },
    { ...detail, context: { ...detail.context, contract_version: 'other' } },
  ]) expect(await call(vi.fn<typeof fetch>().mockResolvedValue(json(value)))).toMatchObject({ ok: false, failure: { error: { error: { code: 'product_snapshot_changed' } } } })
  const fetcher = vi.fn<typeof fetch>()
  expect(await createProductDetailClient({ fetcher })(detail.item.product_id, { ...detail.context, dataset: null }, new AbortController().signal)).toMatchObject({ ok: false })
  expect(fetcher).not.toHaveBeenCalled()
})

it('handles 404, canonical 503, malformed responses, network failures and cancellation', async () => {
  expect(await call(vi.fn<typeof fetch>().mockResolvedValue(new Response('missing', { status: 404 })))).toMatchObject({ ok: false, failure: { status: 404, error: { error: { code: 'product_not_found' } } } })
  expect(await call(vi.fn<typeof fetch>().mockResolvedValue(json(errorFixture, 503)))).toEqual({ ok: false, failure: { kind: 'api', status: 503, error: errorFixture } })
  for (const value of [{}, { ...detail, item: { ...detail.item, specs: null } }, { ...detail, item: { ...detail.item, specs: ['unsupported'] } }]) {
    expect(await call(vi.fn<typeof fetch>().mockResolvedValue(json(value)))).toMatchObject({ ok: false, failure: { kind: 'invalid_response' } })
  }
  expect(await call(vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>private</html>')))).toMatchObject({ ok: false, failure: { kind: 'invalid_response' } })
  expect(await call(vi.fn<typeof fetch>().mockRejectedValue(new Error('private')))).toMatchObject({ ok: false, failure: { kind: 'network' } })
  const controller = new AbortController()
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => { controller.abort(); return json(detail) })
  const client = createProductDetailClient({ fetcher })
  expect(await client(detail.item.product_id, detail.context, controller.signal)).toMatchObject({ ok: false, failure: { kind: 'cancelled' } })
  expect(await client(detail.item.product_id, detail.context, controller.signal)).toMatchObject({ ok: false, failure: { kind: 'cancelled' } })
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('rejects invalid configuration before transmitting', async () => {
  const fetcher = vi.fn<typeof fetch>()
  expect(await createProductDetailClient({ baseUrl: 'https://user:secret@localhost', fetcher })(detail.item.product_id, detail.context, new AbortController().signal)).toMatchObject({ ok: false, failure: { kind: 'configuration' } })
  expect(fetcher).not.toHaveBeenCalled()
})
