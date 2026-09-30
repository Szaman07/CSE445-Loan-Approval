import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api'
import type { Comparison, DatasetSchema, Distribution, Preview } from '../types'
import Explore from './Explore'
import Simulator from './Simulator'

const preview: Preview = { total: 30, offset: 0, limit: 15, columns: ['record'], rows: [{ record: 'Record 0001' }] }
const distribution: Distribution = { feature: 'Credit_Score', display_name: 'Credit Score', kind: 'numeric', total: 30, valid: 30, missing: 0, series: [] }
const schema: DatasetSchema = {
  profile: { rows: 30, columns: 20, labeled_rows: 30, missing_targets: 0, positive_rows: 15, negative_rows: 15 },
  features: [
    { feature: 'Credit_Score', display_name: 'Credit Score', kind: 'numeric', used_by_model: true, derived: false, definition: null, missing: 0, missing_rate: 0 },
    { feature: 'Property_Area', display_name: 'Property Area', kind: 'categorical', used_by_model: true, derived: false, definition: null, missing: 0, missing_rate: 0, categories: ['Urban', 'Rural'] },
  ],
}
const prediction = { model_score: .5, predicted_label: 'Approved', threshold: .447, model_version: '0.1.0', score_type: 'uncalibrated model score', input_notes: [] }
const comparison: Comparison = { baseline: prediction, scenario: { ...prediction, model_score: .6 }, score_change: .1, threshold_crossed: false, changed_fields: ['Credit_Score'] }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  vi.spyOn(api, 'preview').mockResolvedValue(preview)
  vi.spyOn(api, 'distribution').mockResolvedValue(distribution)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Dataset explorer regressions', () => {
  it('paginates rows and keeps preview failures out of other modes', async () => {
    const load = vi.mocked(api.preview)
    load.mockResolvedValueOnce(preview).mockRejectedValueOnce(new Error('Preview failed'))
    render(<Explore schema={schema} />)
    await screen.findByText('Record 0001')
    fireEvent.click(screen.getByRole('button', { name: 'Next rows' }))
    await screen.findByText('Preview failed')
    expect(load).toHaveBeenLastCalledWith(15, 15, expect.any(AbortSignal))
    fireEvent.click(screen.getByRole('button', { name: 'Quality' }))
    expect(await screen.findByRole('heading', { name: 'Missing values and feature use' })).toBeInTheDocument()
    expect(screen.queryByText('Preview failed')).not.toBeInTheDocument()
  })

  it('keeps chart controls available after a request fails', async () => {
    vi.mocked(api.distribution).mockRejectedValueOnce(new Error('Chart failed'))
    render(<Explore schema={schema} />)
    fireEvent.click(screen.getByRole('button', { name: 'Distributions' }))
    await screen.findByText('Chart failed')
    fireEvent.change(screen.getByLabelText('Feature'), { target: { value: 'Property_Area' } })
    await waitFor(() => expect(screen.queryByText('Chart failed')).not.toBeInTheDocument())
    expect(api.distribution).toHaveBeenLastCalledWith('Property_Area', '', '', expect.any(AbortSignal))
  })

  it('ignores a response that arrives after the feature changes', async () => {
    const pending = deferred<Distribution>()
    vi.mocked(api.distribution).mockReturnValueOnce(pending.promise).mockResolvedValueOnce({ ...distribution, display_name: 'Property Area' })
    render(<Explore schema={schema} />)
    fireEvent.click(screen.getByRole('button', { name: 'Distributions' }))
    fireEvent.change(screen.getByLabelText('Feature'), { target: { value: 'Property_Area' } })
    await screen.findByRole('heading', { name: 'Property Area distribution' })
    await act(async () => { pending.resolve(distribution); await pending.promise })
    expect(screen.queryByRole('heading', { name: 'Credit Score distribution' })).not.toBeInTheDocument()
  })
})

describe('Simulator request cancellation', () => {
  it.each(['reset', 'edit'])('ignores a pending result after %s', async (action) => {
    const pending = deferred<Comparison>()
    const compare = vi.spyOn(api, 'compare').mockReturnValue(pending.promise)
    render(<Simulator modelReady />)
    fireEvent.click(screen.getByRole('button', { name: 'Compare scenario' }))
    const signal = compare.mock.calls[0][2]!
    if (action === 'reset') fireEvent.click(screen.getByRole('button', { name: 'Reset both' }))
    else fireEvent.change(screen.getByLabelText('Credit score'), { target: { value: '740' } })
    expect(signal.aborted).toBe(true)
    await act(async () => { pending.resolve(comparison); await pending.promise })
    expect(screen.getByRole('heading', { name: 'No comparison yet' })).toBeInTheDocument()
    expect(screen.queryByText('+10.0 pp')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Compare scenario' })).toBeEnabled()
  })
})
