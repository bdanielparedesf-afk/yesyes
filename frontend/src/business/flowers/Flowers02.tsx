import { buildWaLink, trackEvent } from '@/services/business';
import { clp, productImage, waMessage, type TemplateProps } from '../shared/templateUtils';
import WhatsAppButton from '../shared/WhatsAppButton';

/** FLOWERS_02 — Mosaico: la galería manda (columnas tipo masonry) + productos de apoyo. */
export default function Flowers02({ business, products, gallery }: TemplateProps) {
  const slug = business?.slug;
  const tiles = [
    ...gallery.map((g: any) => ({ id: g.id, url: g.url, alt: g.alt })),
    ...products
      .filter((p: any) => productImage(p))
      .slice(0, 6)
      .map((p: any) => ({ id: p.id, url: productImage(p), alt: p.name })),
  ];
  const heights = ['h-56', 'h-72', 'h-48', 'h-64', 'h-52', 'h-80'];

  return (
    <div className="space-y-10">
      <header className="flex items-end justify-between gap-4 border-b border-neutral-200 pb-6">
        <div>
          <p className="uppercase tracking-[0.3em] text-[11px] text-neutral-400">Florería</p>
          <h1 className="text-4xl font-bold">{business?.name}</h1>
          {business?.description && <p className="mt-2 text-neutral-500 line-clamp-2 max-w-xl">{business.description}</p>}
        </div>
        {business?.logo && <img src={business.logo} alt={business?.name} className="w-16 h-16 rounded-full object-cover" />}
      </header>

      {tiles.length ? (
        <section className="columns-2 sm:columns-3 gap-3 [column-fill:_balance]">
          {tiles.map((tile, i) => (
            <figure key={tile.id} className="mb-3 break-inside-avoid group relative overflow-hidden rounded-2xl">
              <img
                src={tile.url}
                alt={tile.alt || business?.name}
                className={`w-full ${heights[i % heights.length]} object-cover group-hover:scale-105 transition-transform duration-300`}
                loading="lazy"
              />
            </figure>
          ))}
        </section>
      ) : (
        <p className="text-neutral-500 text-center py-10">Pronto publicaremos nuestra galería.</p>
      )}

      {!!products?.length && (
        <section>
          <h2 className="text-xl font-bold mb-3">Disponible hoy</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {products.map((p: any) => (
              <a
                key={p.id}
                href={buildWaLink(business?.whatsapp, `Hola, me interesa: ${p.name}`)}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
                className="bg-white border rounded-xl p-3 hover:border-emerald-300 transition-colors"
              >
                <p className="text-sm font-semibold line-clamp-2">{p.name}</p>
                <p className="font-bold text-emerald-700 mt-1 text-sm">{clp(p.salePrice)}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      <WhatsAppButton phone={business?.whatsapp} message={waMessage(business, 'quiero pedir flores')} slug={slug} label="Pedir" />
    </div>
  );
}
