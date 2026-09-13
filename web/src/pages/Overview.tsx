import { ArrowRight, Database, FlaskConical, Gauge, Search, ShieldCheck } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { number, pct } from '../data'
import type { DatasetSummary, ModelMetadata, RouteId } from '../types'

export default function Overview({ summary, metadata, navigate, evidenceReady }: { summary?: DatasetSummary; metadata?: ModelMetadata; navigate: (route: RouteId) => void; evidenceReady: boolean }) {
  const labels = summary?.labels ?? []
  return <div className="page-stack">
    <section className="overview-hero">
      <div className="hero-copy">
        <span className="kicker">CSE445 course project</span>
        <h1>Loan approval dataset analysis</h1>
        <p>We explored the dataset provided for the course, trained several classification models, and built this dashboard to present the data and results.</p>
        <div className="button-row"><button className="primary" onClick={() => navigate('explore')}>Explore the data <ArrowRight size={17} /></button><button className="secondary" onClick={() => navigate('simulator')}>Open simulator</button></div>
      </div>
      <aside className="hero-evidence" aria-label="Project evidence summary">
        <div><Database /><span><strong>{number(summary?.profile.rows ?? 10000)}</strong> source rows</span></div>
        <div><Gauge /><span><strong>{evidenceReady ? metadata?.test.f1.toFixed(3) : 'Unavailable'}</strong> current test F1</span></div>
        <div><ShieldCheck /><span><strong>15</strong> public model inputs</span></div>
        <small>{evidenceReady ? `Artifact ${metadata?.model_version} · evaluation loaded from the current trained bundle` : 'The site remains readable, but live model evidence needs the API.'}</small>
      </aside>
    </section>

    <section className="purpose-grid" aria-label="Project workflow">
      {[['01', 'Dataset', 'Browse columns, distributions, relationships, groups, and missing values.', Search, 'explore' as RouteId], ['02', 'Simulator', 'Change an example profile and compare its model score with the original.', FlaskConical, 'simulator' as RouteId], ['03', 'Results', 'View the test metrics, confusion matrix, data split, and model inputs.', Gauge, 'model' as RouteId]].map(([index, title, copy, Icon, route]) => <article key={String(title)}><span>{String(index)}</span><Icon /><h2>{String(title)}</h2><p>{String(copy)}</p><button onClick={() => navigate(route as RouteId)}>View {String(title).toLowerCase()} <ArrowRight size={15} /></button></article>)}
    </section>

    <section className="split-section">
      <div><span className="kicker">Dataset snapshot</span><h2>Dataset summary</h2><p>The dataset contains 10,000 rows. Fifty rows do not have a target label and were excluded from model training.</p><dl className="mini-stats"><div><dt>Labeled</dt><dd>{number(summary?.profile.labeled_rows)}</dd></div><div><dt>Approved</dt><dd>{pct(summary ? summary.profile.positive_rows / summary.profile.labeled_rows : undefined)}</dd></div><div><dt>Unknown target</dt><dd>{number(summary?.profile.missing_targets)}</dd></div></dl></div>
      <div className="chart-panel"><h3>Observed outcomes</h3>{labels.length ? <ResponsiveContainer width="100%" height={250}><BarChart data={labels}><CartesianGrid vertical={false} stroke="#dce3ed" /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="count" radius={[6, 6, 0, 0]}>{['#2357d9', '#ef705a', '#9aa8bb'].map((color) => <Cell key={color} fill={color} />)}</Bar></BarChart></ResponsiveContainer> : <div className="empty-inline">Dataset summary unavailable while the API is offline.</div>}<table className="compact-table"><caption>Observed target counts</caption><tbody>{labels.map((item) => <tr key={item.label}><th>{item.label}</th><td>{number(item.count)}</td></tr>)}</tbody></table></div>
    </section>
  </div>
}
