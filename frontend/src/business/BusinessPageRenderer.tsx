import { getNormalizedTemplateCode, hasDedicatedTemplate, resolveTemplate, type TemplateProps } from './registry';
import { getCategoryComposition, isSpecializedCategory, resolveOrderedSections } from './categoryRegistry';
import { buildWaLink } from '@/services/business';

function isDedicatedCode(value?: string | null): boolean {
  return hasDedicatedTemplate(value);
}

function sectionTitle(id: string): string {
  const labels: Record<string, string> = { HERO: 'Inicio', ABOUT: 'Nosotros', SERVICES: 'Servicios', PRICING: 'Precios', PRODUCTS: 'Productos', CATALOG: 'Catálogo', GALLERY: 'Galería', PORTFOLIO: 'Portafolio', BEFORE_AFTER: 'Antes y después', PROMOTIONS: 'Promociones', DELIVERY: 'Delivery', PICKUP: 'Retiro', MAP: 'Ubicación', CONTACT: 'Contacto' };
  return labels[id] || id.replace(/_/g, ' ');
}

function CategoryComposition({ business, services, products, gallery, properties, sections, cta }: TemplateProps & { sections: Array<{ id: string; enabled: boolean; order: number }>; cta: string }) {
  const content: Record<string, any[]> = { SERVICES: services || [], PRODUCTS: products || [], CATALOG: products || [], GALLERY: gallery || [], PORTFOLIO: gallery || [], BEFORE_AFTER: gallery || [], PROPERTIES: properties || [] };
  return <div className="space-y-10" data-business-sections={sections.map((s) => s.id).join(',')}>
    {sections.filter((s) => s.enabled).map((section) => {
      const items = content[section.id] || [];
      if (section.id === 'HERO') return <section key={section.id} className="rounded-3xl bg-neutral-900 text-white p-8 sm:p-14"><p className="text-sm uppercase tracking-widest opacity-70">{business?.category}</p><h1 className="text-4xl font-extrabold mt-2">{business?.name}</h1>{business?.description && <p className="mt-3 max-w-2xl opacity-80">{business.description}</p>}<a className="inline-block mt-6 rounded-full bg-white text-black px-6 py-3 font-semibold" href={buildWaLink(business?.whatsapp, `Hola ${business?.name || ''}, quiero ${cta.toLowerCase()}.`)}>{cta}</a></section>;
      if (section.id === 'CONTACT') return <section key={section.id} className="rounded-2xl border bg-white p-6"><h2 className="font-bold text-xl">{sectionTitle(section.id)}</h2><p className="text-sm mt-2">{business?.address}{business?.city ? `, ${business.city}` : ''}</p>{business?.phone && <p className="text-sm">Tel: {business.phone}</p>}</section>;
      if (section.id === 'CTA') return <section key={section.id} className="text-center rounded-2xl bg-neutral-100 p-6"><p className="font-semibold mb-3">¿Te gustaría comenzar?</p><a className="rounded-full bg-black text-white px-6 py-3" href={buildWaLink(business?.whatsapp, `Hola ${business?.name || ''}, quiero ${cta.toLowerCase()}.`)}>{cta}</a></section>;
      if (['DELIVERY','PICKUP','MAP','PROMOTIONS','PRICING','BOOKING','SOCIALS'].includes(section.id)) return <section key={section.id} className="rounded-2xl border bg-white p-6"><h2 className="font-bold text-xl">{sectionTitle(section.id)}</h2><p className="text-sm text-neutral-600 mt-2">Construye tu solicitud con {cta.toLowerCase()}.</p></section>;
      if (!items.length) return null;
      return <section key={section.id}><h2 className="text-xl font-bold mb-3">{sectionTitle(section.id)}</h2><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{items.map((item: any) => <div key={item.id} className="rounded-xl border bg-white p-3"><p className="font-semibold text-sm">{item.name || item.title || item.url}</p>{item.price != null && <p className="font-bold mt-1">${Number(item.price).toLocaleString('es-CL')}</p>}</div>)}</div></section>;
    })}
  </div>;
}
function EditorialModules({ business, testimonials, team, promotions, faqs, bookingSlots, enabled }: TemplateProps & { enabled: Set<string> }) {
  return <div className="space-y-14">
    {enabled.has('PROMOTIONS') && !!promotions?.length && <section className="rounded-3xl bg-amber-50 p-7 sm:p-10"><p className="text-xs font-bold uppercase tracking-[.25em] text-amber-700">Promociones</p><div className="mt-5 grid gap-4 md:grid-cols-2">{promotions.map((item) => <article key={item.id} className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">{item.title}</h2>{item.description && <p className="mt-2 text-neutral-600">{item.description}</p>}</article>)}</div></section>}
    {enabled.has('TEAM') && !!team?.length && <section id="equipo"><h2 className="text-center text-3xl font-bold">Nuestro equipo</h2><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{team.map((item) => <article key={item.id} className="rounded-2xl border bg-white p-5 text-center">{item.photo ? <img src={item.photo} alt={item.name} loading="lazy" className="mx-auto h-24 w-24 rounded-full object-cover" /> : <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-neutral-100 text-2xl font-bold" aria-hidden>{item.name?.charAt(0)}</div>}<h3 className="mt-4 font-bold">{item.name}</h3>{item.role && <p className="text-sm text-neutral-500">{item.role}</p>}{item.bio && <p className="mt-2 text-sm">{item.bio}</p>}</article>)}</div></section>}
    {enabled.has('TESTIMONIALS') && !!testimonials?.length && <section className="bg-neutral-950 py-16 text-white"><h2 className="text-center text-3xl font-bold">Lo que dicen nuestros clientes</h2><div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{testimonials.map((item) => <figure key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-6"><div aria-label={`${item.rating || 5} de 5 estrellas`} className="text-amber-400">{'★'.repeat(item.rating || 5)}</div><blockquote className="mt-3 text-neutral-200">“{item.content}”</blockquote><figcaption className="mt-4 font-bold">{item.name}{item.role ? ` · ${item.role}` : ''}</figcaption></figure>)}</div></section>}
    {enabled.has('FAQ') && !!faqs?.length && <section><h2 className="text-center text-3xl font-bold">Preguntas frecuentes</h2><div className="mx-auto mt-6 max-w-3xl space-y-3">{faqs.map((item) => <details key={item.id} className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-bold">{item.question}</summary><p className="mt-3 text-neutral-600">{item.answer}</p></details>)}</div></section>}
    {enabled.has('BOOKING') && !!bookingSlots?.length && <section className="rounded-3xl border bg-white p-7"><h2 className="text-2xl font-bold">Horarios de reserva</h2><dl className="mt-5 grid gap-2 sm:grid-cols-2">{bookingSlots.map((slot) => <div key={slot.id} className="flex justify-between border-b py-2"><dt>{['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][slot.weekday]}</dt><dd>{slot.startTime}–{slot.endTime}</dd></div>)}</dl><a href={buildWaLink(business?.whatsapp, `Hola ${business?.name}, quiero reservar.`)} target="_blank" rel="noreferrer" className="mt-6 inline-block rounded-full bg-neutral-950 px-6 py-3 font-bold text-white">Reservar ahora</a></section>}
  </div>;
}



export default function BusinessPageRenderer(props: TemplateProps) {
  const composition = getCategoryComposition(props.business?.category);
  const configuredSections = props.business?.visual?.sections;
  const sections = resolveOrderedSections(configuredSections, composition.supportedCapabilities);
  const templateCode = props.business?.template?.code;
  const normalizedTemplateCode = getNormalizedTemplateCode(templateCode);
  const Template = resolveTemplate(normalizedTemplateCode);
  const dedicated = isDedicatedCode(templateCode);
  const resolvedTemplate = normalizedTemplateCode === 'FLOWERS_01' ? 'Flowers01' : normalizedTemplateCode === 'FOOD_01' ? 'Restaurant01' : normalizedTemplateCode || 'Generic';
  const rendererData = { 'data-business-template': templateCode || 'generic', 'data-business-template-normalized': normalizedTemplateCode || 'generic', 'data-business-resolved-template': resolvedTemplate, 'data-business-dedicated': String(dedicated) };
  if (hasDedicatedTemplate(templateCode)) {
    const saved = Array.isArray(configuredSections) ? configuredSections : [];
    const enabled = new Set(saved.length ? saved.filter((s: any) => s.enabled !== false).map((s: any) => s.id) : ['HERO','SERVICES','PRODUCTS','CATALOG','GALLERY','PORTFOLIO','BEFORE_AFTER','PROPERTIES','TESTIMONIALS','TEAM','PROMOTIONS','FAQ','BOOKING','CONTACT','CTA']);
    return <div {...rendererData} data-business-renderer="dedicated" data-business-sections={[...enabled].join(',')}><Template {...props} services={enabled.has('SERVICES') ? props.services : []} products={enabled.has('PRODUCTS') || enabled.has('CATALOG') ? props.products : []} properties={enabled.has('PROPERTIES') ? props.properties : []} gallery={enabled.has('GALLERY') || enabled.has('PORTFOLIO') || enabled.has('BEFORE_AFTER') ? props.gallery : []} /><EditorialModules {...props} enabled={enabled} /></div>;
  }
  if (isSpecializedCategory(props.business?.category)) {
    const defaults = composition.defaultOrder.map((id, index) => ({ id, order: (index + 1) * 10, enabled: composition.defaultEnabled.includes(id) }));
    return <CategoryComposition {...props} sections={Array.isArray(configuredSections) ? sections : defaults} cta={composition.cta} />;
  }
  const legacySections = Array.isArray(configuredSections) ? configuredSections : null;
  if (!legacySections) { return <div {...rendererData}><Template {...props} /></div>; }
  const enabled = new Set(legacySections.filter((s: any) => s?.enabled !== false).map((s: any) => s.id));
  const ordered = resolveOrderedSections(legacySections, Array.from(new Set([...enabled, 'HERO'])) as string[]);
  return <div {...rendererData} data-business-sections={ordered.map((s) => s.id).join(',')}><Template {...props} services={enabled.has('SERVICES') ? props.services : []} products={enabled.has('PRODUCTS') || enabled.has('CATALOG') ? props.products : []} properties={enabled.has('PROPERTIES') ? props.properties : []} gallery={enabled.has('GALLERY') || enabled.has('PORTFOLIO') || enabled.has('BEFORE_AFTER') ? props.gallery : []} /></div>;
}
