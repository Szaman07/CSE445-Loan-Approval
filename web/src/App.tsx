import { lazy, Suspense, useEffect, useState } from 'react'
import { api } from './api'
import { Layout } from './components/Layout'
import { RouteFocus } from './components/RouteFocus'
import { pathFor, routeForPath } from './routes'
import type { DatasetSchema, DatasetSummary, ModelMetadata, RouteId } from './types'

const Overview = lazy(() => import('./pages/Overview'))
const Explore = lazy(() => import('./pages/Explore'))
const Simulator = lazy(() => import('./pages/Simulator'))
const Model = lazy(() => import('./pages/Model'))
const About = lazy(() => import('./pages/About'))

export default function App() {
  const [route, setRoute] = useState<RouteId>(() => routeForPath(window.location.pathname))
  const [apiReady, setApiReady] = useState<boolean | null>(null)
  const [summary, setSummary] = useState<DatasetSummary>()
  const [metadata, setMetadata] = useState<ModelMetadata>()
  const [schema, setSchema] = useState<DatasetSchema>()
  const [schemaError, setSchemaError] = useState<string>()

  useEffect(() => {
    let active = true
    api.health().then((value) => { if (active) setApiReady(value.model_ready) }, () => { if (active) setApiReady(false) })
    api.summary().then((value) => { if (active) setSummary(value) }, () => {})
    api.metadata().then((value) => { if (active) setMetadata(value) }, () => {})
    api.schema().then((value) => { if (active) setSchema(value) }, (error) => {
      if (active) setSchemaError(error instanceof Error ? error.message : 'Dataset schema unavailable.')
    })
    return () => { active = false }
  }, [])
  useEffect(() => {
    const onPopState = () => setRoute(routeForPath(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  useEffect(() => {
    document.title = `${route[0].toUpperCase()}${route.slice(1)} · CreditWise`
    window.scrollTo({ top: 0 })
  }, [route])
  const navigate = (next: RouteId) => {
    if (next === route) return
    window.history.pushState({}, '', pathFor(next)); setRoute(next)
  }
  return <Layout route={route} navigate={navigate} apiReady={apiReady}><Suspense fallback={<div className="route-loading">Loading view…</div>}><RouteFocus key={route}>
    {route === 'overview' && <Overview summary={summary} metadata={metadata} navigate={navigate} evidenceReady={Boolean(metadata)} />}
    {route === 'explore' && <Explore schema={schema} schemaError={schemaError} />}
    {route === 'simulator' && <Simulator modelReady={Boolean(apiReady)} />}
    {route === 'model' && <Model metadata={metadata} />}
    {route === 'about' && <About />}
  </RouteFocus></Suspense></Layout>
}
