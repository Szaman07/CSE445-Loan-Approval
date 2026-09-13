import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Menu, X } from 'lucide-react'
import type { RouteId } from '../types'
import { routes } from '../routes'

export function Layout({ route, navigate, apiReady, children }: { route: RouteId; navigate: (route: RouteId) => void; apiReady: boolean | null; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus() } }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])
  const go = (id: RouteId) => { setOpen(false); navigate(id) }
  return <div className="site-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="site-header">
      <button className="brand" onClick={() => go('overview')} aria-label="CreditWise home"><span className="brand-mark">CW</span><span><strong>CreditWise</strong><small>CSE445 PROJECT</small></span></button>
      <nav className="desktop-nav" aria-label="Primary navigation">
        {routes.map(({ id, label }) => <button key={id} className={route === id ? 'active' : ''} aria-current={route === id ? 'page' : undefined} onClick={() => go(id)}>{label}</button>)}
      </nav>
      <div className={`service-status ${apiReady ? 'ready' : apiReady === false ? 'offline' : ''}`}><i />{apiReady ? 'Live model' : apiReady === false ? 'API offline' : 'Connecting'}</div>
      <button ref={menuButton} className="menu-button" aria-label="Open navigation" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(true)}><Menu /></button>
    </header>
    {open && <><button className="nav-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} /><div id="mobile-navigation" className="mobile-nav" role="dialog" aria-modal="true" aria-label="Navigation"><div className="mobile-nav-head"><strong>Navigate</strong><button aria-label="Close navigation" onClick={() => { setOpen(false); menuButton.current?.focus() }}><X /></button></div>{routes.map(({ id, label, icon: Icon }) => <button key={id} className={route === id ? 'active' : ''} onClick={() => go(id)}><Icon size={18} />{label}</button>)}</div></>}
    <main id="main-content" tabIndex={-1}>{children}</main>
    <footer><span>CSE445 loan approval project</span><span>Predicts observed labels, not repayment</span></footer>
  </div>
}
