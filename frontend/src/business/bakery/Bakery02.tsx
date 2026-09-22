import { buildWaLink, trackEvent } from '@/services/business';
import { clp, productImage, waMessage, type TemplateProps } from '../shared/templateUtils';
import CTABar from '../shared/CTABar';
import HoursMap from '../shared/HoursMap';

/** BAKERY_02 — Vitrina: estanterías horizontales con desplazamiento (shelves). */
export default function Bakery02({ business, products, gallery }: TemplateProps) {
  const slug = business?.slug;
  const shelves: { title: string; items: any[] }[] = [];
  const featured = products.filter((p: any) => p.featured || p.tags?.includes?.('destacado'));
  const rest = products.filter((p: any) => !featured.includes(p));
  if (featured.length) shelves.push({ title: 'Destacados de la semana', items: featured });
  if (rest.length) shelves.push({ title: 'Del horno a tu mesa', items: rest });
  if (gallery.length) shelves.push({ title: 'Nuestra vitrina', items: gallery.map((g: any) => ({ id: g.id, name: g.alt || 'Foto', url: g.url })) });

  return (
    <div className="space-y-10">
      <header className="text-center bg-orange-50 -mx-4 px-4 py-10 rounded-b-3xl">
        <p className="uppercase tracking-[0.35em] text-xs text-orange-600">Panadería artesanal</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold mt-2 text-orange-950">{business?.name}</h1>
        {business?.city && <p className="mt-2 text-orange-700/70">{business.city}</p>}
      </header>

      {business?.description && <p className="max-w-2xl mx-auto text-center text-neutral-600 whitespace-pre-line">{business.description}</p>}

      {shelves.map((shelf) => (
        <section key={shelf.title}>
          <h2 className="text-xl font-bold mb-4 text-orange-950">{shelf.title}</h2>
          <div className="flex gap-4 overflow-x-auto pb-3 snap-x -mx-4 px-4 [scrollbar-width:thin]">
            {shelf.items.map((item: any) => {
              const img = item.url || productImage(item);
              const isGallery = Boolean(item.url) && !item.images;
              return (
                <article key={item.id} className="snap-start shrink-0 w-48 bg-white rounded-2xl border overflow-hidden">
                  {img && <img src={img} alt={item.name} className="w-full h-40 object-cover" loading="lazy" />}
                  <div className="p-3">
                    <p className="text-sm font-semibold line-clamp-2">{item.name}</p>
                    {!isGallery && (
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-bold text-orange-700">{clp(item.salePrice)}</span>
                        <a
                          href={buildWaLink(business?.whatsapp, `Hola, quiero pedir: ${item.name}`)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
                          className="text-xs font-semibold text-orange-700 underline underline-offset-4"
                        >
                          Pedir
                        </a>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      {!shelves.length && <p className="text-neutral-500 text-center py-8">Pronto tendremos productos disponibles.</p>}

      <section className="bg-white rounded-2xl border p-6">
        <HoursMap business={business} />
      </section>
      <div className="h-14" />
      <CTABar business={business} slug={slug} message={waMessage(business, 'quiero hacer un pedido')} waLabel="Pedir por WhatsApp" />
    </div>
  );
}
