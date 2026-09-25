import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Menu, Phone, X } from 'lucide-react';
import { buildWaLink } from '@/services/business';
import { categoryLabel } from './businessLabels';
import { backgroundById } from './visual/backgrounds';
import { typographyById } from './visual/typography';
import { shadowFor } from './visual/shadows';
import { getIndustryComposition } from './industryComposition';

const links = (business: any) => [
  ['inicio', 'Inicio'], ['servicios', 'Servicios'], ['catalogo', 'Catálogo'], ['galeria', 'Galería'], ['horarios', 'Horarios'], ['contacto', 'Contacto'],
].filter(([id]) => id === 'inicio' || id === 'servicios' && business?.visual?.sections?.some((s: any) => s.id === 'SERVICES' && s.enabled !== false) || id === 'catalogo' && business?.visual?.sections?.some((s: any) => ['PRODUCTS', 'CATALOG', 'PROPERTIES'].includes(s.id) && s.enabled !== false) || id === 'galeria' && business?.visual?.sections?.some((s: any) => ['GALLERY', 'PORTFOLIO', 'BEFORE_AFTER'].includes(s.id) && s.enabled !== false) || id === 'horarios' && business?.hours || id === 'contacto');

export default function BusinessShell({ business, children, preview = false }: { business: any; children: ReactNode; preview?: boolean }) {
  const [open, setOpen] = useState(false); const menuButton = useRef<HTMLButtonElement>(null); const firstLink = useRef<HTMLAnchorElement>(null); const visual = business?.visual || {}; const bg = backgroundById(visual.background); const type = typographyById(visual.typography); const composition = getIndustryComposition(business?.template?.code, business?.category);
  useEffect(() => {
    if (!open) return;
    firstLink.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus(); } };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);
  const message = `Hola ${business?.name || ''}, quiero ${composition.cta.toLowerCase()}.`;
  const navLinks = links(business);
  return <div className="business-site min-h-screen text-[var(--biz-text)]" style={{ '--biz-primary': visual.primaryColor || '#1f2937', '--biz-secondary': visual.secondaryColor || '#64748b', '--biz-accent': visual.accentColor || '#b08d57', '--biz-bg': visual.backgroundColor || bg.css, '--biz-text': visual.textColor || '#1f2937', '--biz-radius': `${visual.borderRadius ?? 12}px`, '--biz-shadow': shadowFor(visual.shadow), '--biz-heading': type.heading, '--biz-body': type.body, background: visual.backgroundColor || bg.css } as React.CSSProperties}>
    <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3">Saltar al contenido</a>
    {preview && <div className="sticky top-0 z-[70] bg-amber-300 px-4 py-2 text-center text-sm font-bold text-amber-950">Vista previa</div>}
    <header className={`sticky top-0 z-50 border-b border-black/10 ${composition.navigation === 'dark-premium' ? 'bg-neutral-950/95 text-white' : composition.navigation === 'warm' ? 'bg-[#fffaf0]/95 text-stone-900' : composition.navigation === 'energetic' ? 'bg-white/95 text-slate-950' : 'bg-white/90 text-stone-900'} backdrop-blur-xl`}><div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3"><a href="#inicio" className="min-w-0 flex-1" aria-label={`Ir al inicio de ${business?.name}`}>{business?.logo ? <img src={business.logo} alt={`Logo de ${business.name}`} className="h-10 w-auto max-w-40 object-contain" /> : <span className="text-lg font-bold" style={{ fontFamily: 'var(--biz-heading)' }}>{business?.name}</span>}</a><nav className="hidden items-center gap-5 text-sm font-semibold lg:flex" aria-label="Navegación principal">{navLinks.map(([id, label]) => <a key={id} href={`#${id}`} className="transition hover:opacity-60">{label}</a>)}</nav><span className="hidden text-xs font-semibold opacity-60 xl:block">{categoryLabel(business?.category)}{business?.city ? ` · ${business.city}` : ''}</span>{business?.whatsapp && <a href={buildWaLink(business.whatsapp, message)} target="_blank" rel="noreferrer" className="hidden min-h-11 items-center rounded-[var(--biz-radius)] bg-[var(--biz-primary)] px-4 text-sm font-bold text-white sm:inline-flex">{composition.cta}</a>}<button ref={menuButton} type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="business-menu" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--biz-radius)] border lg:hidden">{open ? <X aria-hidden /> : <Menu aria-hidden />}</button></div>{open && <nav id="business-menu" aria-label="Navegación móvil" className={`border-t p-3 lg:hidden ${composition.navigation === 'dark-premium' ? 'border-white/10 bg-neutral-950' : 'bg-white'}`}>{navLinks.map(([id, label], index) => <a ref={index === 0 ? firstLink : undefined} key={id} href={`#${id}`} onClick={() => setOpen(false)} className="block min-h-11 rounded-xl px-3 py-3 font-semibold hover:bg-black/5">{label}</a>)}{business?.phone && <a href={`tel:${business.phone}`} className="mt-2 flex items-center gap-2 px-3"><Phone size={16} aria-hidden />Llamar</a>}{business?.whatsapp && <a href={buildWaLink(business.whatsapp, message)} className="mt-2 flex min-h-11 items-center rounded-[var(--biz-radius)] bg-[var(--biz-primary)] px-4 font-bold text-white">{composition.cta}</a>}</nav>}</header>
    <main id="contenido" className="overflow-hidden">{children}</main>
    <footer className={`${composition.navigation === 'dark-premium' ? 'bg-black' : composition.navigation === 'warm' ? 'bg-[#3a2418]' : 'bg-[var(--biz-primary)]'} text-white`}><div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2"><div><p className="text-xl font-bold">{business?.name}</p><p className="mt-2 text-sm opacity-75">{[business?.address, business?.city].filter(Boolean).join(', ')}</p></div><div className="sm:text-right"><p className="text-sm opacity-75">© {new Date().getFullYear()} {business?.name}</p><a href="/negocio" className="mt-3 inline-block text-sm font-semibold hover:underline">Crea tu página con YesYes</a></div></div></footer>
  </div>;
}
