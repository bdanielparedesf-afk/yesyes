import { resolveTemplate, type TemplateProps } from './registry';
import { getCategoryComposition, isSpecializedCategory, resolveOrderedSections } from './categoryRegistry';
import { buildWaLink } from '@/services/business';

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

export default function BusinessPageRenderer(props: TemplateProps) {
  const composition = getCategoryComposition(props.business?.category);
  const configuredSections = props.business?.visual?.sections;
  const sections = resolveOrderedSections(configuredSections, composition.supportedCapabilities);
  if (isSpecializedCategory(props.business?.category)) {
    const defaults = composition.defaultOrder.map((id, index) => ({ id, order: (index + 1) * 10, enabled: composition.defaultEnabled.includes(id) }));
    return <CategoryComposition {...props} sections={Array.isArray(configuredSections) ? sections : defaults} cta={composition.cta} />;
  }
  const legacySections = Array.isArray(configuredSections) ? configuredSections : null;
  if (!legacySections) { const Template = resolveTemplate(props.business?.template?.code); return <Template {...props} />; }
  const enabled = new Set(legacySections.filter((s: any) => s?.enabled !== false).map((s: any) => s.id));
  const ordered = resolveOrderedSections(legacySections, Array.from(new Set([...enabled, 'HERO'])) as string[]);
  const Template = resolveTemplate(props.business?.template?.code);
  return <div data-business-sections={ordered.map((s) => s.id).join(',')}><Template {...props} services={enabled.has('SERVICES') ? props.services : []} products={enabled.has('PRODUCTS') || enabled.has('CATALOG') ? props.products : []} properties={enabled.has('PROPERTIES') ? props.properties : []} gallery={enabled.has('GALLERY') || enabled.has('PORTFOLIO') || enabled.has('BEFORE_AFTER') ? props.gallery : []} /></div>;
}
