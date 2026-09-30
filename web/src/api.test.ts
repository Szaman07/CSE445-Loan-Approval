import { afterEach, expect, it, vi } from 'vitest'
import { api } from './api'

afterEach(() => vi.unstubAllGlobals())

it('omits an incomplete cohort and includes the completed filter', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', fetch)
  await api.distribution('Credit_Score', 'Property_Area', '')
  expect(String(fetch.mock.calls[0][0])).not.toContain('filter_feature')
  fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }))
  await api.distribution('Credit_Score', 'Property_Area', 'Urban')
  expect(String(fetch.mock.calls[1][0])).toContain('filter_feature=Property_Area')
  expect(String(fetch.mock.calls[1][0])).toContain('filter_value=Urban')
})

it('turns structured API validation errors into readable field messages', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: [{ loc: ['body', 'scenario', 'Loan_Term'], msg: 'Input should be a valid integer' }] }), { status: 422 })))
  await expect(api.health()).rejects.toThrow('scenario → Loan_Term: Input should be a valid integer')
})
