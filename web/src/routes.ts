import { Activity, BarChart3, FlaskConical, Info, Microscope } from 'lucide-react'
import type { RouteId } from './types'

export const routes: Array<{ id: RouteId; label: string; icon: typeof Activity; path: string }> = [
  { id: 'overview', label: 'Overview', icon: Activity, path: '/' },
  { id: 'explore', label: 'Explore', icon: BarChart3, path: '/explore' },
  { id: 'simulator', label: 'Simulator', icon: FlaskConical, path: '/simulator' },
  { id: 'model', label: 'Model', icon: Microscope, path: '/model' },
  { id: 'about', label: 'About', icon: Info, path: '/about' },
]
export const pathFor = (route: RouteId) => routes.find((item) => item.id === route)?.path ?? '/'
export const routeForPath = (path: string): RouteId => routes.find((item) => item.path === path.replace(/\/$/, '') || (item.path === '/' && path === '/'))?.id ?? 'overview'
