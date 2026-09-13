import { useEffect, useMemo, useState } from 'react'
import { BarChart3, BookOpen, CircleDot, Database, Filter, RefreshCw, Rows3, Search, ShieldCheck, Table2, TriangleAlert } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { api } from '../api'
import { categoricalFeatures, number, numericFeatures, pct, pretty } from '../data'
import type { DatasetSchema, Distribution, Groups, Preview, Relationship } from '../types'

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
function ErrorPanel({ message }: { message: string }) { return <div className="error-box"><TriangleAlert /><div><strong>Analysis unavailable</strong><p>{message}</p></div></div> }

export default function Explore({ schema }: { schema?: DatasetSchema }) {
  const [mode, setMode] = useState<Mode>('browse')
  const [feature, setFeature] = useState('Credit_Score')
  const [x, setX] = useState('Credit_Score')
  const [y, setY] = useState('DTI_Ratio')
  const [groupFeature, setGroupFeature] = useState('Loan_Purpose')
  const [filterFeature, setFilterFeature] = useState('')
  const [filterValue, setFilterValue] = useState('')
  const [preview, setPreview] = useState<Preview>()
  const [distribution, setDistribution] = useState<Distribution>()
  const [relationship, setRelationship] = useState<Relationship>()
  const [groups, setGroups] = useState<Groups>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const categorySchema = schema?.features.filter((item) => item.kind === 'categorical') ?? []
  const values = categorySchema.find((item) => item.feature === filterFeature)?.categories ?? []
  const cohortText = filterFeature && filterValue ? `${pretty(filterFeature)} = ${filterValue}` : 'All records'

  useEffect(() => { api.preview().then(setPreview).catch((reason) => setError(reason instanceof Error ? reason.message : 'Preview unavailable.')) }, [])
  useEffect(() => {
    if (!['distributions', 'relationships', 'groups'].includes(mode)) return
    let active = true
    const filterField = filterFeature || undefined
    const filterSelected = filterValue || undefined
    void Promise.resolve().then(() => { if (active) { setLoading(true); setError('') } })
    const request = mode === 'distributions' ? api.distribution(feature, filterField, filterSelected).then((data) => active && setDistribution(data)) : mode === 'relationships' ? api.relationship(x, y, filterField, filterSelected).then((data) => active && setRelationship(data)) : api.groups(groupFeature, filterField, filterSelected).then((data) => active && setGroups(data))
    request.catch((reason) => active && setError(reason instanceof Error ? reason.message : 'Analysis unavailable.')).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [mode, feature, x, y, groupFeature, filterFeature, filterValue])

  const selectQuestion = (question: typeof questions[number]) => {
    setMode(question.mode)
    if (question.mode === 'distributions') setFeature(question.values[0])
    if (question.mode === 'relationships') { setX(question.values[0]); setY(question.values[1]) }
    if (question.mode === 'groups') setGroupFeature(question.values[0])
  }
  const resetCohort = () => { setFilterFeature(''); setFilterValue('') }
  return <div className="explorer-page"><section className="page-intro explore-intro"><div><span className="kicker">Interactive dataset explorer</span><h1>Ask focused questions of the source data.</h1><p>Move from rows to distributions, relationships, group comparisons, and quality checks. Every view reports its cohort and denominator.</p></div><div className="dataset-badge"><Database /><span><strong>{number(schema?.profile.rows)}</strong> rows · {schema?.features.length ?? '—'} documented fields</span></div></section>
    <section className="question-strip" aria-label="Guided analysis questions">{questions.map((question) => <button key={question.title} onClick={() => selectQuestion(question)}><BookOpen /><span><strong>{question.title}</strong><small>{question.text}</small></span></button>)}</section>
    <div className="explorer-workspace"><aside className="explorer-controls"><div><span className="control-label">Analysis mode</span>{modes.map(({ id, label, icon: Icon }) => <button className={mode === id ? 'active' : ''} onClick={() => setMode(id)} key={id}><Icon />{label}</button>)}</div><div className="cohort-control"><span className="control-label"><Filter size={14} /> Cohort filter</span><label><span>Field</span><select value={filterFeature} onChange={(event) => { setFilterFeature(event.target.value); setFilterValue('') }}><option value="">No filter</option>{categorySchema.map((item) => <option value={item.feature} key={item.feature}>{item.display_name}</option>)}</select></label>{filterFeature && <label><span>Value</span><select value={filterValue} onChange={(event) => setFilterValue(event.target.value)}><option value="">Choose value</option>{values.map((value) => <option key={value}>{value}</option>)}</select></label>}<button className="reset-filter" onClick={resetCohort} disabled={!filterFeature}><RefreshCw /> Reset cohort</button></div></aside>
      <section className="analysis-canvas"><div className="canvas-head"><div><span className="kicker">{modes.find((item) => item.id === mode)?.label}</span><h2>{cohortText}</h2></div>{mode !== 'browse' && mode !== 'quality' && <span className="cohort-chip">{mode === 'distributions' ? number(distribution?.total) : mode === 'relationships' ? number(relationship?.cohort_rows) : number(groups?.total)} cohort rows</span>}</div>
        {error && <ErrorPanel message={error} />}{loading && <Loading />}
        {!loading && !error && mode === 'browse' && <Browse preview={preview} schema={schema} />}
        {!loading && !error && mode === 'distributions' && <Distributions data={distribution} feature={feature} setFeature={setFeature} schema={schema} />}
        {!loading && !error && mode === 'relationships' && <Relationships data={relationship} x={x} y={y} setX={setX} setY={setY} />}
        {!loading && !error && mode === 'groups' && <GroupView data={groups} feature={groupFeature} setFeature={setGroupFeature} />}
        {!loading && !error && mode === 'quality' && <Quality schema={schema} />}
      </section></div>
  </div>
}

function Browse({ preview, schema }: { preview?: Preview; schema?: DatasetSchema }) {
  const [search, setSearch] = useState('')
  const fields = schema?.features.filter((item) => item.display_name.toLowerCase().includes(search.toLowerCase())) ?? []
  return <div className="analysis-stack"><div className="browse-head"><div><h3>Data dictionary</h3><p>Search field roles, coverage, and allowed values.</p></div><label className="search-field"><Search /><span className="sr-only">Search fields</span><input placeholder="Search fields" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div><div className="schema-grid">{fields.map((item) => <article key={item.feature}><div><strong>{item.display_name}</strong><code>{item.feature}</code></div><div className="tag-row"><span>{item.kind}</span><span className={item.used_by_model ? 'model-tag' : ''}>{item.used_by_model ? 'Model input' : item.derived ? 'Analysis only' : 'Audit only'}</span></div><p>{item.definition ?? (item.kind === 'categorical' ? `${item.categories?.length ?? 0} observed categories` : `Median ${number(item.summary?.median, 2)}`)}</p><small>{number(item.missing)} missing · {pct(item.missing_rate)} of rows</small></article>)}</div><div className="table-block"><div><h3>Dataset preview</h3><p>Identifiers are replaced with stable row labels in this view.</p></div>{preview ? <div className="table-scroll"><table><caption>First {preview.rows.length} records in the source dataset</caption><thead><tr>{preview.columns.map((column) => <th key={column}>{pretty(column)}</th>)}</tr></thead><tbody>{preview.rows.map((row) => <tr key={String(row.record)}>{preview.columns.map((column) => <td key={column}>{row[column] ?? <span className="missing-value">Missing</span>}</td>)}</tr>)}</tbody></table></div> : <Loading />}</div></div>
}

function Distributions({ data, feature, setFeature, schema }: { data?: Distribution; feature: string; setFeature: (value: string) => void; schema?: DatasetSchema }) {
  if (!data) return <Loading />
  const available = schema?.features ?? []
  return <div className="analysis-stack"><div className="view-controls"><label><span>Feature</span><select value={feature} onChange={(event) => setFeature(event.target.value)}>{available.map((item) => <option key={item.feature} value={item.feature}>{item.display_name}{item.derived ? ' · derived' : ''}</option>)}</select></label><div className="view-summary"><span>{number(data.valid)} valid</span><span>{number(data.missing)} missing</span></div></div><div className="chart-title"><h3>{data.display_name} distribution</h3><p>Bars split observed target outcomes within each bin or category.</p></div><div className="large-chart"><ResponsiveContainer width="100%" height={360}><BarChart data={data.series} margin={{ left: 8, right: 8, bottom: 58 }}><CartesianGrid vertical={false} stroke="#dce3ed" /><XAxis dataKey="label" angle={-35} textAnchor="end" interval={0} height={85} tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Legend /><Bar dataKey="not_approved" name="Not approved" stackId="outcome" fill="#2357d9" /><Bar dataKey="approved" name="Approved" stackId="outcome" fill="#ef705a" /><Bar dataKey="unknown" name="Unknown" stackId="outcome" fill="#9aa8bb" /></BarChart></ResponsiveContainer></div><div className="table-scroll"><table><caption>Distribution counts for {data.display_name}</caption><thead><tr><th>Bin or category</th><th>All</th><th>Approved</th><th>Not approved</th><th>Unknown</th></tr></thead><tbody>{data.series.map((row) => <tr key={row.label}><th>{row.label}</th><td>{number(row.all)}</td><td>{number(row.approved)}</td><td>{number(row.not_approved)}</td><td>{number(row.unknown)}</td></tr>)}</tbody></table></div></div>
}

function Relationships({ data, x, y, setX, setY }: { data?: Relationship; x: string; y: string; setX: (value: string) => void; setY: (value: string) => void }) {
  if (!data) return <Loading />
  const approved = data.points.filter((point) => point.outcome === 'Approved'); const rejected = data.points.filter((point) => point.outcome === 'Not approved'); const unknown = data.points.filter((point) => point.outcome === 'Unknown')
  return <div className="analysis-stack"><div className="view-controls axis-controls"><label><span>X axis</span><select value={x} onChange={(event) => setX(event.target.value)}>{numericFeatures.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select></label><label><span>Y axis</span><select value={y} onChange={(event) => setY(event.target.value)}>{numericFeatures.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select></label><div className="view-summary"><span>r = {data.correlation ?? '—'}</span><span>{number(data.shown_count)} shown / {number(data.full_count)} valid</span></div></div><div className="chart-title"><h3>{data.y_label} vs {data.x_label}</h3><p>A deterministic sample keeps the browser responsive; the correlation uses all {number(data.full_count)} complete pairs.</p></div><div className="large-chart"><ResponsiveContainer width="100%" height={400}><ScatterChart margin={{ bottom: 20, left: 10, right: 20 }}><CartesianGrid stroke="#dce3ed" /><XAxis type="number" dataKey="x" name={data.x_label} tick={{ fontSize: 10 }} /><YAxis type="number" dataKey="y" name={data.y_label} tick={{ fontSize: 10 }} /><ZAxis range={[24, 24]} /><Tooltip cursor={{ strokeDasharray: '3 3' }} /><Legend /><Scatter name="Not approved" data={rejected} fill="#2357d9" opacity={0.55} /><Scatter name="Approved" data={approved} fill="#ef705a" opacity={0.55} /><Scatter name="Unknown" data={unknown} fill="#9aa8bb" opacity={0.7} /></ScatterChart></ResponsiveContainer></div><dl className="relationship-stats"><div><dt>Cohort rows</dt><dd>{number(data.cohort_rows)}</dd></div><div><dt>Complete pairs</dt><dd>{number(data.full_count)}</dd></div><div><dt>Missing either axis</dt><dd>{number(data.missing_count)}</dd></div><div><dt>Pearson correlation</dt><dd>{data.correlation ?? '—'}</dd></div></dl></div>
}

function GroupView({ data, feature, setFeature }: { data?: Groups; feature: string; setFeature: (value: string) => void }) {
  if (!data) return <Loading />
  return <div className="analysis-stack"><div className="view-controls"><label><span>Group by</span><select value={feature} onChange={(event) => setFeature(event.target.value)}>{categoricalFeatures.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select></label><div className="view-summary"><span>{data.groups.length} groups</span><span>Rate denominator: labeled rows</span></div></div><div className="chart-title"><h3>Approval rate by {data.display_name}</h3><p>Counts and unknown targets remain visible below the rate comparison.</p></div><div className="large-chart"><ResponsiveContainer width="100%" height={350}><BarChart data={data.groups} margin={{ left: 8, right: 8, bottom: 35 }}><CartesianGrid vertical={false} stroke="#dce3ed" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tickFormatter={(value) => `${Math.round(value * 100)}%`} domain={[0, 1]} /><Tooltip formatter={(value) => pct(Number(value))} /><Bar dataKey="approval_rate" name="Approval rate" fill="#ef705a" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="table-scroll"><table><caption>Group outcomes for {data.display_name}</caption><thead><tr><th>Group</th><th>Total</th><th>Labeled denominator</th><th>Approved</th><th>Not approved</th><th>Unknown</th><th>Approval rate</th></tr></thead><tbody>{data.groups.map((row) => <tr key={row.label}><th>{row.label}</th><td>{number(row.total)}</td><td>{number(row.labeled)}</td><td>{number(row.approved)}</td><td>{number(row.not_approved)}</td><td>{number(row.unknown)}</td><td>{pct(row.approval_rate)}</td></tr>)}</tbody></table></div></div>
}

function Quality({ schema }: { schema?: DatasetSchema }) {
  const features = useMemo(() => [...(schema?.features ?? [])].sort((a, b) => b.missing_rate - a.missing_rate), [schema])
  return <div className="analysis-stack"><div className="chart-title"><h3>Coverage and feature policy</h3><p>Missing rates are shown as true percentages. Model-use badges separate deployed inputs from audit and derived fields.</p></div><div className="quality-bars">{features.filter((item) => item.missing > 0).map((item) => <div key={item.feature}><span>{item.display_name}</span><div><i style={{ width: `${item.missing_rate * 100}%` }} /></div><strong>{pct(item.missing_rate)} · {number(item.missing)}</strong></div>)}</div><div className="table-scroll"><table><caption>Complete schema and missingness audit</caption><thead><tr><th>Feature</th><th>Type</th><th>Role</th><th>Missing</th><th>Missing rate</th><th>Observed range or categories</th></tr></thead><tbody>{features.map((item) => <tr key={item.feature}><th>{item.display_name}<code>{item.feature}</code></th><td>{item.kind}</td><td><span className={item.used_by_model ? 'role-pill model' : 'role-pill'}>{item.used_by_model ? 'Model input' : item.derived ? 'Analysis only' : 'Audit only'}</span></td><td>{number(item.missing)}</td><td>{pct(item.missing_rate)}</td><td>{item.kind === 'categorical' ? item.categories?.join(', ') : `${number(item.summary?.min, 2)} — ${number(item.summary?.max, 2)}`}</td></tr>)}</tbody></table></div></div>
}
