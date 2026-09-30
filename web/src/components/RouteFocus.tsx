import { useEffect } from 'react'
import type { ReactNode } from 'react'

export function RouteFocus({ children }: { children: ReactNode }) {
  useEffect(() => {
    const heading = document.querySelector<HTMLElement>('#main-content h1')
    heading?.setAttribute('tabindex', '-1')
    heading?.focus()
  }, [])
  return children
}
