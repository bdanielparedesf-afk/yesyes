import { useState } from 'react';
import { Menu, Phone, X } from 'lucide-react';
import { buildWaLink } from '@/services/business';

const sectionLinks = (business: any) => [
  ['Inicio', 'inicio'], ['Servicios', 'servicios'], ['Catálogo', 'catalogo'],
  ['Galería', 'galeria'], ['Nosotros', 'contacto'],
].filter(([, id]) => id === 'inicio' || id === 'servicios' && business?.visual?.sections?.some((s: any) => s.id === 'SERVICES' && s.enabled !== false) || id === 'catalogo' && business?.visual?.sections?.some((s: any) => ['PRODUCTS', 'CATALOG'].includes(s.id) && s.enabled !== false) || id === 'galeria' && business?.visual?.sections?.some((s: any) => ['GALLERY', 'PORTFOLIO'].includes(s.id) && s.enabled !== false) || id === 'contacto');

export default function BusinessLayout({ business, children }: { business: any; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const links = sectionLinks(business);
  return <div className="min-h-screen bg-neutral-50 text-neutral-900" style={{ '--biz-primary': business?.visual?.primaryColor || '#111827', '--biz-radius': `${business?.visual?.borderRadius || 12}px` } as React.CSSProperties}>
    <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">Saltar al contenido</a>
    <header className="sticky top-0 z-40 border-b bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        {business?.logo ? <img src={business.logo} alt={`Logo de ${business.name}`} className="h-10 w-10 rounded-full object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-neutral-950 font-black text-white" aria-hidden>{(business?.name || 'N').charAt(0)}</span>}
        <a href="#inicio" className="min-w-0 flex-1"><p className="truncate font-bold leading-tight">{business?.name}</p>{business?.city && <p className="text-xs text-neutral-500">{business.city}</p>}</a>
        <nav className="hidden items-center gap-5 md:flex" aria-label="Navegación principal">{links.map(([label, id]) => <a key={id} href={`#${id}`} className="text-sm font-semibold text-neutral-600 hover:text-neutral-950">{label}</a>)}{business?.phone && <a href={`tel:${business.phone}`} aria-label="Llamar al negocio" className="rounded-full border p-2"><Phone size={17} aria-hidden /></a>}{business?.whatsapp && <a href={buildWaLink(business.whatsapp, `Hola ${business.name}, quiero información.`)} target="_blank" rel="noreferrer" className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-bold text-white">WhatsApp</a>}</nav>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="business-mobile-nav" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} className="rounded-lg border p-2 md:hidden">{open ? <X aria-hidden /> : <Menu aria-hidden />}</button>
      </div>
      {open && <nav id="business-mobile-nav" aria-label="Navegación móvil" className="border-t bg-white px-4 py-3 md:hidden">{links.map(([label, id]) => <a key={id} onClick={() => setOpen(false)} href={`#${id}`} className="block rounded-lg px-3 py-2 font-semibold hover:bg-neutral-100">{label}</a>)}{business?.whatsapp && <a href={buildWaLink(business.whatsapp, `Hola ${business.name}, quiero información.`)} target="_blank" rel="noreferrer" className="mt-2 block rounded-lg bg-neutral-950 px-3 py-2 text-center font-bold text-white">Contactar por WhatsApp</a>}</nav>}
    </header>
    <main id="contenido" className="mx-auto max-w-6xl space-y-10 px-4 py-6">{children}</main>
    <footer className="mt-10 border-t bg-neutral-950 text-neutral-300"><div className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:grid-cols-2"><div><p className="font-bold text-white">{business?.name}</p>{business?.address && <p className="mt-2 text-sm">{business.address}{business?.city ? `, ${business.city}` : ''}</p>}{business?.phone && <a className="mt-1 block text-sm" href={`tel:${business.phone}`}>{business.phone}</a>}</div><div className="sm:text-right"><a href="/negocio" className="text-sm text-white hover:underline">Crear tu propia página con YesYes</a><p className="mt-2 text-xs text-neutral-500">© {new Date().getFullYear()} {business?.name}</p></div></div></footer>
  </div>;
}
