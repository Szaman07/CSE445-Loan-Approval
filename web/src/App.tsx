import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { Layout } from './components/Layout'
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
  const mainHeading = useRef<HTMLElement | null>(null)

  useEffect(() => {
    Promise.allSettled([api.health(), api.summary(), api.metadata(), api.schema()]).then(([health, summaryResult, metadataResult, schemaResult]) => {
      setApiReady(health.status === 'fulfilled' && health.value.model_ready)
      if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value)
      if (metadataResult.status === 'fulfilled') setMetadata(metadataResult.value)
      if (schemaResult.status === 'fulfilled') setSchema(schemaResult.value)
    })
  }, [])
  useEffect(() => {
    const onPopState = () => setRoute(routeForPath(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  useEffect(() => {
    document.title = `${route[0].toUpperCase()}${route.slice(1)} · CreditWise`
    window.scrollTo({ top: 0 })
    window.setTimeout(() => {
      const heading = document.querySelector<HTMLElement>('#main-content h1')
      heading?.setAttribute('tabindex', '-1'); heading?.focus(); mainHeading.current = heading
    }, 0)
  }, [route])
  const navigate = (next: RouteId) => {
    if (next === route) return
    window.history.pushState({}, '', pathFor(next)); setRoute(next)
  }
  return <Layout route={route} navigate={navigate} apiReady={apiReady}><Suspense fallback={<div className="route-loading">Loading view…</div>}>
    {route === 'overview' && <Overview summary={summary} metadata={metadata} navigate={navigate} evidenceReady={Boolean(metadata)} />}
    {route === 'explore' && <Explore schema={schema} />}
    {route === 'simulator' && <Simulator modelReady={Boolean(apiReady)} />}
    {route === 'model' && <Model metadata={metadata} />}
    {route === 'about' && <About />}
  </Suspense></Layout>
}
