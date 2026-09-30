import { useCallback, useMemo, useState } from 'react'
import { BarChart3, BookOpen, CircleDot, Database, Filter, RefreshCw, Rows3, Search, ShieldCheck, Table2, TriangleAlert } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { api } from '../api'
import { useRemote } from '../hooks/useRemote'
import { categoricalFeatures, number, numericFeatures, pct, pretty } from '../data'
import type { DatasetSchema, Distribution, Groups, Relationship } from '../types'

type Mode = 'browse' | 'distributions' | 'relationships' | 'groups' | 'quality'
const modes: Array<{ id: Mode; label: string; icon: typeof Search }> = [
  { id: 'browse', label: 'Browse', icon: Table2 }, { id: 'distributions', label: 'Distributions', icon: BarChart3 }, { id: 'relationships', label: 'Relationships', icon: CircleDot }, { id: 'groups', label: 'Groups', icon: Rows3 }, { id: 'quality', label: 'Quality', icon: ShieldCheck },
]
const questions: Array<{ title: string; text: string; mode: Mode; values: string[] }> = [
  { title: 'How does credit score differ by outcome?', text: 'Compare the full score distribution for approved and not-approved rows.', mode: 'distributions', values: ['Credit_Score'] },
  { title: 'Do loan size and income move together?', text: 'Inspect a deterministic sample and the full-cohort correlation.', mode: 'relationships', values: ['Total_Income', 'Loan_Amount'] },
  { title: 'How do outcomes vary by loan purpose?', text: 'Compare rates with labeled denominators kept visible.', mode: 'groups', values: ['Loan_Purpose'] },
]

function Loading() { return <div className="loading-panel"><RefreshCw className="spin" /> Loading analysis…</div> }
function ErrorPanel({ message }: { message: string }) { return <div className="error-box" role="alert"><TriangleAlert /><div><strong>Analysis unavailable</strong><p>{message}</p></div></div> }

export default function Explore({ schema, schemaError }: { schema?: DatasetSchema; schemaError?: string }) {
  const [mode, setMode] = useState<Mode>('browse')
  const [feature, setFeature] = useState('Credit_Score')
  const [x, setX] = useState('Credit_Score')
  const [y, setY] = useState('DTI_Ratio')
  const [groupFeature, setGroupFeature] = useState('Loan_Purpose')
  const [filterFeature, setFilterFeature] = useState('')
  const [filterValue, setFilterValue] = useState('')
  const categorySchema = schema?.features.filter((item) => item.kind === 'categorical') ?? []
  const values = categorySchema.find((item) => item.feature === filterFeature)?.categories ?? []
  const chartMode = mode !== 'browse' && mode !== 'quality'
  const cohortText = chartMode && filterFeature && filterValue ? `${pretty(filterFeature)} = ${filterValue}` : 'All records'
  const loadAnalysis = useCallback((signal: AbortSignal) => {
    if (mode === 'distributions') return api.distribution(feature, filterFeature, filterValue, signal)
    if (mode === 'relationships') return api.relationship(x, y, filterFeature, filterValue, signal)
    if (mode === 'groups') return api.groups(groupFeature, filterFeature, filterValue, signal)
    return Promise.resolve(null)
  }, [mode, feature, x, y, groupFeature, filterFeature, filterValue])
  const requestKey = JSON.stringify([mode, feature, x, y, groupFeature, filterFeature, filterValue])
  const analysis = useRemote<Distribution | Relationship | Groups | null>(requestKey, loadAnalysis)
  const distribution = mode === 'distributions' ? analysis.data as Distribution | undefined : undefined
  const relationship = mode === 'relationships' ? analysis.data as Relationship | undefined : undefined
  const groups = mode === 'groups' ? analysis.data as Groups | undefined : undefined
  const loading = chartMode && analysis.loading
  const error = chartMode ? analysis.error : schemaError

  const selectQuestion = (question: typeof questions[number]) => {
    setMode(question.mode)
    if (question.mode === 'distributions') setFeature(question.values[0])
    if (question.mode === 'relationships') { setX(question.values[0]); setY(question.values[1]) }
    if (question.mode === 'groups') setGroupFeature(question.values[0])
  }
  const resetCohort = () => { setFilterFeature(''); setFilterValue('') }
  return <div className="explorer-page"><section className="page-intro explore-intro"><div><span className="kicker">Dataset explorer</span><h1>Explore the dataset</h1><p>Browse the columns and compare distributions, numeric relationships, category groups, and missing values.</p></div><div className="dataset-badge"><Database /><span><strong>{number(schema?.profile.rows)}</strong> rows · {schema?.features.length ?? '—'} documented fields</span></div></section>
    <section className="question-strip" aria-label="Guided analysis questions">{questions.map((question) => <button key={question.title} onClick={() => selectQuestion(question)}><BookOpen /><span><strong>{question.title}</strong><small>{question.text}</small></span></button>)}</section>
    <div className="explorer-workspace"><aside className="explorer-controls"><div><span className="control-label">Analysis mode</span>{modes.map(({ id, label, icon: Icon }) => <button className={mode === id ? 'active' : ''} onClick={() => setMode(id)} key={id}><Icon />{label}</button>)}</div><div className="cohort-control"><span className="control-label"><Filter size={14} /> Cohort filter</span><small>Applies to chart views.</small><label><span>Field</span><select disabled={!chartMode} value={filterFeature} onChange={(event) => { setFilterFeature(event.target.value); setFilterValue('') }}><option value="">No filter</option>{categorySchema.map((item) => <option value={item.feature} key={item.feature}>{item.display_name}</option>)}</select></label>{filterFeature && <label><span>Value</span><select disabled={!chartMode} value={filterValue} onChange={(event) => setFilterValue(event.target.value)}><option value="">Choose value</option>{values.map((value) => <option key={value}>{value}</option>)}</select></label>}<button className="reset-filter" onClick={resetCohort} disabled={!filterFeature}><RefreshCw /> Reset cohort</button></div></aside>
      <section className="analysis-canvas"><div className="canvas-head"><div><span className="kicker">{modes.find((item) => item.id === mode)?.label}</span><h2>{cohortText}</h2></div>{mode !== 'browse' && mode !== 'quality' && <span className="cohort-chip">{mode === 'distributions' ? number(distribution?.total) : mode === 'relationships' ? number(relationship?.cohort_rows) : number(groups?.total)} cohort rows</span>}</div>
        {chartMode && <div className="view-controls">
          {mode === 'distributions' && <label><span>Feature</span><select value={feature} onChange={(event) => setFeature(event.target.value)}>{(schema?.features ?? [...numericFeatures, ...categoricalFeatures].map((item) => ({ feature: item, display_name: pretty(item) }))).map((item) => <option key={item.feature} value={item.feature}>{item.display_name}</option>)}</select></label>}
          {mode === 'relationships' && <>{[['X axis', x, setX], ['Y axis', y, setY]].map(([label, value, change]) => <label key={String(label)}><span>{String(label)}</span><select value={String(value)} onChange={(event) => (change as (value: string) => void)(event.target.value)}>{numericFeatures.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select></label>)}</>}
          {mode === 'groups' && <label><span>Group by</span><select value={groupFeature} onChange={(event) => setGroupFeature(event.target.value)}>{categoricalFeatures.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select></label>}
        </div>}
        {error && <ErrorPanel message={error} />}{loading && <Loading />}
        {!loading && !error && mode === 'browse' && <Browse schema={schema} />}
        {!loading && !error && mode === 'distributions' && <Distributions data={distribution} />}
        {!loading && !error && mode === 'relationships' && <Relationships data={relationship} />}
        {!loading && !error && mode === 'groups' && <GroupView data={groups} />}
        {!loading && !error && mode === 'quality' && <Quality schema={schema} />}
      </section></div>
  </div>
}

function Browse({ schema }: { schema?: DatasetSchema }) {
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const loadPreview = useCallback((signal: AbortSignal) => api.preview(offset, 15, signal), [offset])
  const { data: preview, error: previewError, loading: previewLoading } = useRemote(String(offset), loadPreview)
  const fields = schema?.features.filter((item) => item.display_name.toLowerCase().includes(search.toLowerCase())) ?? []
  return <div className="analysis-stack"><div className="browse-head"><div><h3>Data dictionary</h3><p>Search field roles, coverage, and allowed values.</p></div><label className="search-field"><Search /><span className="sr-only">Search fields</span><input placeholder="Search fields" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div><div className="schema-grid">{fields.map((item) => <article key={item.feature}><div><strong>{item.display_name}</strong><code>{item.feature}</code></div><div className="tag-row"><span>{item.kind}</span><span className={item.used_by_model ? 'model-tag' : ''}>{item.used_by_model ? 'Model input' : item.derived ? 'Analysis only' : 'Audit only'}</span></div><p>{item.definition ?? (item.kind === 'categorical' ? `${item.categories?.length ?? 0} observed categories` : `Median ${number(item.summary?.median, 2)}`)}</p><small>{number(item.missing)} missing · {pct(item.missing_rate)} of rows</small></article>)}</div><div className="table-block"><div><h3>Dataset preview</h3><p>Identifiers are replaced with stable row labels in this view.</p></div>{previewError ? <ErrorPanel message={previewError} /> : previewLoading ? <Loading /> : preview ? <div className="table-scroll"><table><caption>Rows {preview.offset + 1}–{preview.offset + preview.rows.length} of {number(preview.total)}</caption><thead><tr>{preview.columns.map((column) => <th key={column}>{pretty(column)}</th>)}</tr></thead><tbody>{preview.rows.map((row) => <tr key={String(row.record)}>{preview.columns.map((column) => <td key={column}>{row[column] ?? <span className="missing-value">Missing</span>}</td>)}</tr>)}</tbody></table></div> : null}<div className="button-row"><button className="secondary" disabled={offset === 0 || previewLoading} onClick={() => setOffset((value) => Math.max(0, value - 15))}>Previous rows</button><button className="secondary" disabled={!preview || offset + 15 >= preview.total || previewLoading} onClick={() => setOffset((value) => value + 15)}>Next rows</button></div></div></div>
}

function Distributions({ data }: { data?: Distribution }) {
  if (!data) return <Loading />
  return <div className="analysis-stack"><div className="view-summary"><span>{number(data.valid)} valid</span><span>{number(data.missing)} missing</span></div><div className="chart-title"><h3>{data.display_name} distribution</h3><p>Bars split observed target outcomes within each bin or category.</p></div><div className="large-chart"><ResponsiveContainer width="100%" height={360}><BarChart data={data.series} margin={{ left: 8, right: 8, bottom: 58 }}><CartesianGrid vertical={false} stroke="#dce3ed" /><XAxis dataKey="label" angle={-35} textAnchor="end" interval={0} height={85} tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Legend /><Bar dataKey="not_approved" name="Not approved" stackId="outcome" fill="#2357d9" /><Bar dataKey="approved" name="Approved" stackId="outcome" fill="#ef705a" /><Bar dataKey="unknown" name="Unknown" stackId="outcome" fill="#9aa8bb" /></BarChart></ResponsiveContainer></div><div className="table-scroll"><table><caption>Distribution counts for {data.display_name}</caption><thead><tr><th>Bin or category</th><th>All</th><th>Approved</th><th>Not approved</th><th>Unknown</th></tr></thead><tbody>{data.series.map((row) => <tr key={row.label}><th>{row.label}</th><td>{number(row.all)}</td><td>{number(row.approved)}</td><td>{number(row.not_approved)}</td><td>{number(row.unknown)}</td></tr>)}</tbody></table></div></div>
}

function Relationships({ data }: { data?: Relationship }) {
  if (!data) return <Loading />
  const approved = data.points.filter((point) => point.outcome === 'Approved'); const rejected = data.points.filter((point) => point.outcome === 'Not approved'); const unknown = data.points.filter((point) => point.outcome === 'Unknown')
  return <div className="analysis-stack"><div className="chart-title"><h3>{data.y_label} vs {data.x_label}</h3><p>The chart shows a fixed sample. The correlation uses all {number(data.full_count)} complete pairs.</p></div><div className="large-chart"><ResponsiveContainer width="100%" height={400}><ScatterChart margin={{ bottom: 20, left: 10, right: 20 }}><CartesianGrid stroke="#dce3ed" /><XAxis type="number" dataKey="x" name={data.x_label} tick={{ fontSize: 10 }} /><YAxis type="number" dataKey="y" name={data.y_label} tick={{ fontSize: 10 }} /><ZAxis range={[24, 24]} /><Tooltip cursor={{ strokeDasharray: '3 3' }} /><Legend /><Scatter name="Not approved" data={rejected} fill="#2357d9" opacity={0.55} /><Scatter name="Approved" data={approved} fill="#ef705a" opacity={0.55} /><Scatter name="Unknown" data={unknown} fill="#9aa8bb" opacity={0.7} /></ScatterChart></ResponsiveContainer></div><dl className="relationship-stats"><div><dt>Cohort rows</dt><dd>{number(data.cohort_rows)}</dd></div><div><dt>Complete pairs</dt><dd>{number(data.full_count)}</dd></div><div><dt>Missing either axis</dt><dd>{number(data.missing_count)}</dd></div><div><dt>Pearson correlation</dt><dd>{data.correlation ?? '—'}</dd></div></dl></div>
}

function GroupView({ data }: { data?: Groups }) {
  if (!data) return <Loading />
  return <div className="analysis-stack"><div className="view-summary"><span>{data.groups.length} groups</span><span>{number(data.missing)} missing group values</span><span>Rate denominator: labeled rows</span></div><div className="chart-title"><h3>Approval rate by {data.display_name}</h3><p>Counts and unknown targets remain visible below the rate comparison.</p></div><div className="large-chart"><ResponsiveContainer width="100%" height={350}><BarChart data={data.groups} margin={{ left: 8, right: 8, bottom: 35 }}><CartesianGrid vertical={false} stroke="#dce3ed" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tickFormatter={(value) => `${Math.round(value * 100)}%`} domain={[0, 1]} /><Tooltip formatter={(value) => pct(Number(value))} /><Bar dataKey="approval_rate" name="Approval rate" fill="#ef705a" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="table-scroll"><table><caption>Group outcomes for {data.display_name}</caption><thead><tr><th>Group</th><th>Total</th><th>Labeled denominator</th><th>Approved</th><th>Not approved</th><th>Unknown</th><th>Approval rate</th></tr></thead><tbody>{data.groups.map((row) => <tr key={row.label}><th>{row.label}</th><td>{number(row.total)}</td><td>{number(row.labeled)}</td><td>{number(row.approved)}</td><td>{number(row.not_approved)}</td><td>{number(row.unknown)}</td><td>{pct(row.approval_rate)}</td></tr>)}</tbody></table></div></div>
}

function Quality({ schema }: { schema?: DatasetSchema }) {
  const features = useMemo(() => [...(schema?.features ?? [])].sort((a, b) => b.missing_rate - a.missing_rate), [schema])
  return <div className="analysis-stack"><div className="chart-title"><h3>Missing values and feature use</h3><p>This table shows missing values and whether each field is used by the model.</p></div><div className="quality-bars">{features.filter((item) => item.missing > 0).map((item) => <div key={item.feature}><span>{item.display_name}</span><div><i style={{ width: `${item.missing_rate * 100}%` }} /></div><strong>{pct(item.missing_rate)} · {number(item.missing)}</strong></div>)}</div><div className="table-scroll"><table><caption>Schema and missing values</caption><thead><tr><th>Feature</th><th>Type</th><th>Role</th><th>Missing</th><th>Missing rate</th><th>Observed range or categories</th></tr></thead><tbody>{features.map((item) => <tr key={item.feature}><th>{item.display_name}<code>{item.feature}</code></th><td>{item.kind}</td><td><span className={item.used_by_model ? 'role-pill model' : 'role-pill'}>{item.used_by_model ? 'Model input' : item.derived ? 'Analysis only' : 'Audit only'}</span></td><td>{number(item.missing)}</td><td>{pct(item.missing_rate)}</td><td>{item.kind === 'categorical' ? item.categories?.join(', ') : `${number(item.summary?.min, 2)} — ${number(item.summary?.max, 2)}`}</td></tr>)}</tbody></table></div></div>
}
