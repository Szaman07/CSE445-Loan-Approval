import type { Applicant, Comparison, DatasetSchema, DatasetSummary, Distribution, Groups, ModelMetadata, Preview, Relationship } from './types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

function validationMessage(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((item) => {
    if (!item || typeof item !== 'object') return String(item)
    const entry = item as { loc?: Array<string | number>; msg?: string }
    const field = entry.loc?.filter((part) => part !== 'body').join(' → ')
    return `${field ? `${field}: ` : ''}${entry.msg ?? 'Invalid value'}`
  }).join(' · ')
  return 'Request failed.'
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const signal = init?.signal
    ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
    : AbortSignal.timeout(15000)
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, signal })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: 'Request failed.' }))
    throw new Error(validationMessage(payload.detail))
  }
  return response.json() as Promise<T>
}

function query(path: string, values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)) })
  const search = params.toString()
  return `${path}${search ? `?${search}` : ''}`
}

export const api = {
  health: () => request<{ status: string; model_ready: boolean; detail: string }>('/api/health'),
  summary: () => request<DatasetSummary>('/api/dataset/summary'),
  metadata: () => request<ModelMetadata>('/api/metadata'),
  schema: () => request<DatasetSchema>('/api/dataset/schema'),
  preview: (offset = 0, limit = 15, signal?: AbortSignal) => request<Preview>(query('/api/dataset/preview', { offset, limit }), { signal }),
  distribution: (feature: string, filterFeature?: string, filterValue?: string, signal?: AbortSignal) => request<Distribution>(query('/api/dataset/distribution', { feature, filter_feature: filterValue ? filterFeature : undefined, filter_value: filterValue }), { signal }),
  relationship: (x: string, y: string, filterFeature?: string, filterValue?: string, signal?: AbortSignal) => request<Relationship>(query('/api/dataset/relationship', { x, y, filter_feature: filterValue ? filterFeature : undefined, filter_value: filterValue }), { signal }),
  groups: (feature: string, filterFeature?: string, filterValue?: string, signal?: AbortSignal) => request<Groups>(query('/api/dataset/groups', { feature, filter_feature: filterValue ? filterFeature : undefined, filter_value: filterValue }), { signal }),
  compare: (baseline: Applicant, scenario: Applicant, signal?: AbortSignal) => request<Comparison>('/api/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseline, scenario }), signal }),
}
