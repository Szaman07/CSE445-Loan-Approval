import { useMemo, useState } from 'react'
import { ArrowRight, Check, RefreshCw, TriangleAlert } from 'lucide-react'
import { api } from '../api'
import { exampleApplicant, pct, pretty } from '../data'
import type { Applicant, Comparison } from '../types'

type NumericKey = Exclude<keyof Applicant, 'Employment_Status' | 'Loan_Purpose' | 'Property_Area' | 'Education_Level' | 'Employer_Category' | 'Age' | 'Marital_Status' | 'Gender'>
type SelectKey = 'Employment_Status' | 'Loan_Purpose' | 'Property_Area' | 'Education_Level' | 'Employer_Category'
const numericFields: Array<{ key: NumericKey; label: string; min: number; max: number; step?: number; nullable?: boolean }> = [
  { key: 'Applicant_Income', label: 'Applicant income', min: 0, max: 1000000 },
  { key: 'Coapplicant_Income', label: 'Coapplicant income', min: 0, max: 1000000, nullable: true },
  { key: 'Dependents', label: 'Dependents', min: 0, max: 20, nullable: true },
  { key: 'Credit_Score', label: 'Credit score', min: 300, max: 850 },
  { key: 'Existing_Loans', label: 'Existing loans', min: 0, max: 50, nullable: true },
  { key: 'DTI_Ratio', label: 'Debt-to-income ratio', min: 0, max: 1, step: 0.01 },
  { key: 'Savings', label: 'Savings', min: 0, max: 10000000, nullable: true },
  { key: 'Collateral_Value', label: 'Collateral value', min: 0, max: 100000000, nullable: true },
  { key: 'Loan_Amount', label: 'Loan amount', min: 1, max: 100000000 },
  { key: 'Loan_Term', label: 'Loan term', min: 1, max: 600, nullable: true },
]
const selectFields: Array<{ key: SelectKey; label: string; options: string[] }> = [
  { key: 'Employment_Status', label: 'Employment status', options: ['Salaried', 'Contract', 'Self-employed', 'Unemployed'] },
  { key: 'Loan_Purpose', label: 'Loan purpose', options: ['Business', 'Car', 'Education', 'Home', 'Personal'] },
  { key: 'Property_Area', label: 'Property area', options: ['Rural', 'Semiurban', 'Urban'] },
  { key: 'Education_Level', label: 'Education level', options: ['Graduate', 'Not Graduate'] },
  { key: 'Employer_Category', label: 'Employer category', options: ['Business', 'Government', 'MNC', 'Private', 'Unemployed'] },
]

function ScoreCard({ title, score, label, threshold }: { title: string; score: number; label: string; threshold: number }) {
  return <article className="score-card"><span>{title}</span><strong>{pct(score)}</strong><div className={`outcome-pill ${label === 'Approved' ? 'approved' : ''}`}>{label}</div><div className="score-track" aria-label={`${title} score ${pct(score)}, threshold ${pct(threshold)}`}><i style={{ width: `${score * 100}%` }} /><b style={{ left: `${threshold * 100}%` }} /></div><small>Threshold {pct(threshold)}</small></article>
}

export default function Simulator({ modelReady }: { modelReady: boolean }) {
  const [baseline, setBaseline] = useState<Applicant>({ ...exampleApplicant })
  const [scenario, setScenario] = useState<Applicant>({ ...exampleApplicant })
  const [result, setResult] = useState<Comparison>()
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const changes = useMemo(() => Object.keys(scenario).filter((key) => scenario[key as keyof Applicant] !== baseline[key as keyof Applicant] && !['Age', 'Marital_Status', 'Gender'].includes(key)), [baseline, scenario])
  const setNumeric = (key: NumericKey, raw: string, nullable = false) => { setScenario((current) => ({ ...current, [key]: raw === '' && nullable ? null : Number(raw) })); if (result) setDirty(true) }
  const setSelect = (key: SelectKey, value: string) => { setScenario((current) => ({ ...current, [key]: value })); if (result) setDirty(true) }
  const run = async () => {
    setLoading(true); setError('')
    try { setResult(await api.compare(baseline, scenario)); setDirty(false) } catch (requestError) { setResult(undefined); setError(requestError instanceof Error ? requestError.message : 'Comparison is unavailable.') } finally { setLoading(false) }
  }
  const reset = () => { setBaseline({ ...exampleApplicant }); setScenario({ ...exampleApplicant }); setResult(undefined); setDirty(false); setError('') }
  const promote = () => { setBaseline({ ...scenario }); setResult(undefined); setDirty(false); setError('') }
  return <div className="page-stack"><section className="page-intro simulator-intro"><div><span className="kicker">Baseline → scenario</span><h1>See what changes when an application changes.</h1><p>The model returns an uncalibrated score. This comparison shows movement and threshold crossing; it does not explain cause or recommend a lending decision.</p></div><button className="secondary" onClick={reset}><RefreshCw size={16} /> Reset both</button></section>
    <section className="simulator-layout"><form className="scenario-form" onSubmit={(event) => { event.preventDefault(); void run() }}><div className="form-head"><div><span className="kicker">Scenario inputs</span><h2>Change the example</h2></div><span className="change-count">{changes.length} changed</span></div><div className="form-grid">{numericFields.map((field) => <label key={field.key}><span>{field.label}{field.nullable && <small> optional</small>}</span><input required={!field.nullable} type="number" min={field.min} max={field.max} step={field.step ?? 1} value={scenario[field.key] ?? ''} onChange={(event) => setNumeric(field.key, event.target.value, field.nullable)} /></label>)}{selectFields.map((field) => <label key={field.key}><span>{field.label}</span><select value={scenario[field.key]} onChange={(event) => setSelect(field.key, event.target.value)}>{field.options.map((option) => <option key={option}>{option}</option>)}</select></label>)}</div><button className="primary run-button" disabled={loading || !modelReady}>{loading ? <RefreshCw className="spin" /> : <ArrowRight />}{loading ? 'Comparing…' : modelReady ? 'Compare scenario' : 'Model API unavailable'}</button></form>
      <aside className="comparison-result" aria-live="polite" aria-atomic="true"><span className="kicker">Comparison result</span>{error && <div className="error-box"><TriangleAlert /><div><strong>Could not compare</strong><p>{error}</p></div></div>}{!result && !error && <div className="result-empty"><div className="empty-orbit"><span /><span /></div><h2>Build a scenario</h2><p>Edit any of the 15 visible model inputs, then compare it with the fixed baseline.</p></div>}{result && <div className={dirty ? 'result-stale' : ''}>{dirty && <div className="stale-banner"><TriangleAlert /> Inputs changed. Run the comparison again to refresh these results.</div>}<div className="score-pair"><ScoreCard title="Baseline" {...result.baseline} score={result.baseline.model_score} label={result.baseline.predicted_label} /><ArrowRight /><ScoreCard title="Scenario" {...result.scenario} score={result.scenario.model_score} label={result.scenario.predicted_label} /></div><div className="delta-card"><span>Score movement</span><strong className={result.score_change >= 0 ? 'positive-delta' : 'negative-delta'}>{result.score_change >= 0 ? '+' : ''}{pct(result.score_change)}</strong><small>{result.threshold_crossed ? 'The scenario crossed the stored threshold.' : 'The scenario stayed on the same side of the threshold.'}</small></div><div className="changed-list"><h3>Changed fields</h3>{result.changed_fields.length ? result.changed_fields.map((field) => <span key={field}><Check />{pretty(field)}</span>) : <p>No input differs from baseline.</p>}</div><button className="text-action" onClick={promote}>Use scenario as new baseline <ArrowRight size={15} /></button></div>}</aside></section>
  </div>
}
