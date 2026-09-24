import { lazy, type ComponentType } from 'react';

export type TemplateProps = { business: any; services: any[]; products: any[]; properties: any[]; gallery: any[] };

function Generic({ business, services, products, properties, gallery }: TemplateProps) {
  return (
    <div className="space-y-10">
      {!!business?.cover && (
        <div className="-mx-4 -mt-6 h-64 sm:h-80 overflow-hidden bg-gradient-to-br from-neutral-200 to-neutral-300">
          <img src={business.cover} alt={business?.name} className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}
      <section>
        <h1 className="text-3xl font-extrabold">{business?.name}</h1>
        {business?.description && <p className="mt-2 text-neutral-600 whitespace-pre-line">{business.description}</p>}
      </section>
      {!!services?.length && (
        <section>
          <h2 className="text-xl font-bold mb-3">Servicios</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {services.map((s: any) => (
              <div key={s.id} className="bg-white rounded-xl border p-4">
                <p className="font-semibold">{s.name}</p>
                {s.description && <p className="text-sm text-neutral-600 mt-1">{s.description}</p>}
                {s.price != null && <p className="mt-2 font-bold">${Number(s.price).toLocaleString('es-CL')}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
      {!!products?.length && (
        <section>
          <h2 className="text-xl font-bold mb-3">Catálogo</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products.map((p: any) => (
              <div key={p.id} className="bg-white rounded-xl border overflow-hidden">
                {Array.isArray(p.images) && p.images[0] && <img src={p.images[0]} alt={p.name} className="w-full h-36 object-cover" loading="lazy" />}
                <div className="p-3">
                  <p className="text-sm font-semibold line-clamp-2">{p.name}</p>
                  <p className="font-bold mt-1">${Number(p.salePrice).toLocaleString('es-CL')}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {!!properties?.length && (
        <section>
          <h2 className="text-xl font-bold mb-3">Propiedades</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {properties.map((pr: any) => (
              <div key={pr.id} className="bg-white rounded-xl border overflow-hidden">
                {pr.images?.[0]?.url && <img src={pr.images[0].url} alt={pr.title} className="w-full h-44 object-cover" loading="lazy" />}
                <div className="p-4">
                  <p className="text-xs uppercase text-neutral-500">{pr.operation} · {pr.type}</p>
                  <p className="font-semibold">{pr.title}</p>
                  <p className="font-bold mt-1">${Number(pr.price).toLocaleString('es-CL')}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {!!gallery?.length && (
        <section>
          <h2 className="text-xl font-bold mb-3">Galería</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {gallery.map((g: any) => (
              <img key={g.id} src={g.url} alt={g.alt || ''} className="w-full h-36 object-cover rounded-xl" loading="lazy" />
            ))}
          </div>
        </section>
      )}
      <section className="bg-white rounded-xl border p-4">
        <h2 className="text-xl font-bold">Contacto</h2>
        {business?.address && <p className="text-sm mt-1">{business.address}{business?.city ? `, ${business.city}` : ''}</p>}
        {business?.phone && <p className="text-sm">Tel: {business.phone}</p>}
        {business?.email && <p className="text-sm">Email: {business.email}</p>}
      </section>
    </div>
  );
}


type AnyTemplate = ComponentType<TemplateProps>;

const HAIR_01 = lazy(() => import('./hair/Hair01'));
const HAIR_02 = lazy(() => import('./hair/Hair02'));
const HAIR_03 = lazy(() => import('./hair/Hair03'));
const BARBER_01 = lazy(() => import('./barber/Barber01'));
const BAKERY_01 = lazy(() => import('./bakery/Bakery01'));
const BAKERY_02 = lazy(() => import('./bakery/Bakery02'));
const BAKERY_03 = lazy(() => import('./bakery/Bakery03'));
const BAKERY_04 = lazy(() => import('./bakery/Bakery04'));
const FLOWERS_01 = lazy(() => import('./flowers/Flowers01'));
const FLOWERS_02 = lazy(() => import('./flowers/Flowers02'));
const FLOWERS_03 = lazy(() => import('./flowers/Flowers03'));
const FLOWERS_04 = lazy(() => import('./flowers/Flowers04'));
const REAL_ESTATE_01 = lazy(() => import('./realestate/RealEstate01'));
const REAL_ESTATE_02 = lazy(() => import('./realestate/RealEstate02'));
const REAL_ESTATE_03 = lazy(() => import('./realestate/RealEstate03'));
const REAL_ESTATE_04 = lazy(() => import('./realestate/RealEstate04'));

const comps: Record<string, AnyTemplate> = {
  HAIR_01, HAIR_02, HAIR_03,
  BARBER_01,
  BAKERY_01, BAKERY_02, BAKERY_03, BAKERY_04,
  FLOWERS_01, FLOWERS_02, FLOWERS_03, FLOWERS_04,
  REAL_ESTATE_01, REAL_ESTATE_02, REAL_ESTATE_03, REAL_ESTATE_04,
};

export function resolveTemplate(code?: string | null): AnyTemplate {
  if (code && comps[code]) return comps[code];
  return Generic;
}

export function hasRenderableSection(business: any, id: string): boolean {
  const sections = business?.visual?.sections;
  if (!Array.isArray(sections)) return true;
  const section = sections.find((s: any) => s?.id === id);
  return section ? section.enabled !== false : true;
}

export { Generic as GenericTemplate };
