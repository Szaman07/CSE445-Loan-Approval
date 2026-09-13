import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const metadata = {
  model_version: '0.1.0', created_at: '2026-09-12T18:12:50Z',
  dataset: { rows: 10000, columns: 20, labeled_rows: 9950, missing_targets: 50, positive_rows: 3890, negative_rows: 6060, sha256: '1764e49a721b390f22485576c894e1db' },
  split: { seed: 42, train_rows: 5970, validation_rows: 1990, test_rows: 1990 },
  winner: { spec: { name: 'logistic_l1_public_raw_c0.3', public_policy: true, engineered: false }, threshold: 0.447, validation: { f1: 0.7049 } },
  test: { f1: 0.6844, precision: 0.5619, recall: 0.8753, average_precision: 0.6865, confusion: { tn: 681, fp: 531, fn: 97, tp: 681 } },
  candidate_ranking: [], limitations: [],
}
const summary = { profile: metadata.dataset, labels: [{ label: 'Not approved', count: 6060 }, { label: 'Approved', count: 3890 }, { label: 'Unknown', count: 50 }], missingness: [], credit_by_outcome: [] }
const schema = { profile: metadata.dataset, features: [{ feature: 'Credit_Score', display_name: 'Credit Score', kind: 'numeric', used_by_model: true, derived: false, definition: null, missing: 0, missing_rate: 0, summary: { min: 300, median: 680, max: 850 } }] }
function jsonResponse(payload: unknown) { return Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } })) }

describe('CreditWise case study', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    vi.stubGlobal('scrollTo', vi.fn())
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/health')) return jsonResponse({ status: 'ok', model_ready: true, detail: 'ready' })
      if (url.endsWith('/api/dataset/summary')) return jsonResponse(summary)
      if (url.endsWith('/api/metadata')) return jsonResponse(metadata)
      if (url.endsWith('/api/dataset/schema')) return jsonResponse(schema)
      if (url.endsWith('/api/compare')) return jsonResponse({ baseline: { model_score: .686, predicted_label: 'Approved', threshold: .447, model_version: '0.1.0', score_type: 'uncalibrated model score', input_notes: [] }, scenario: { model_score: .72, predicted_label: 'Approved', threshold: .447, model_version: '0.1.0', score_type: 'uncalibrated model score', input_notes: [] }, score_change: .034, threshold_crossed: false, changed_fields: ['Credit_Score'] })
      if (url.includes('/api/dataset/preview')) return jsonResponse({ total: 10000, offset: 0, limit: 15, columns: ['record'], rows: [{ record: 'Record 0001' }] })
      return Promise.resolve(new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 }))
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('uses routes and completes a scenario comparison', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: /From messy loan data/i })).toBeInTheDocument()
    await screen.findByText('Live model')
    fireEvent.click(screen.getByRole('button', { name: 'Open simulator' }))
    expect(window.location.pathname).toBe('/simulator')
    expect(await screen.findByRole('heading', { name: /See what changes/i })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Credit score'), { target: { value: '730' } })
    fireEvent.click(screen.getByRole('button', { name: 'Compare scenario' }))
    await waitFor(() => expect(screen.getByText('+3.4%')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Credit score'), { target: { value: '740' } })
    expect(screen.getByText(/Inputs changed/)).toBeInTheDocument()
  })
})
