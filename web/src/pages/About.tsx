import { BarChart3, FlaskConical, GitBranch, Table2 } from 'lucide-react'

export default function About() {
  return <div className="page-stack">
    <section className="page-intro"><div><span className="kicker">About</span><h1>CSE445 loan approval project</h1><p>This project was completed over a few weeks using a dataset provided by our instructor. We explored the data, tested classification models, and built a small web interface for the final model and analysis.</p></div></section>
    <section className="about-principles">
      <article><Table2 /><h2>Dataset</h2><p>10,000 loan application rows with numeric and categorical features.</p></article>
      <article><BarChart3 /><h2>Analysis</h2><p>Distributions, relationships, category comparisons, and missing-value checks.</p></article>
      <article><GitBranch /><h2>Model</h2><p>Train, validation, and test splits with threshold selection on validation data.</p></article>
      <article><FlaskConical /><h2>Dashboard</h2><p>A React frontend and FastAPI backend for browsing results and comparing examples.</p></article>
    </section>
    <section className="case-study"><div><span className="kicker">Steps</span><h2>What we did</h2></div><ol><li><strong>Explore the data</strong><span>Checked columns, missing values, target balance, and feature relationships.</span></li><li><strong>Prepare the data</strong><span>Added preprocessing for numeric and categorical fields inside the model pipeline.</span></li><li><strong>Train models</strong><span>Compared logistic regression configurations using cross-validation.</span></li><li><strong>Build the dashboard</strong><span>Added dataset views, model results, and a simple score comparison tool.</span></li></ol></section>
    <section className="scope-note"><h2>Notes</h2><p>The dataset source does not document the currency or income period. The model predicts the approval label in this dataset and was built only for the course project.</p></section>
  </div>
}
