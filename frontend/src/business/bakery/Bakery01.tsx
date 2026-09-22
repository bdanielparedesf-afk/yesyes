import { buildWaLink, trackEvent } from '@/services/business';
import { clp, productImage, waMessage, type TemplateProps } from '../shared/templateUtils';
import WhatsAppButton from '../shared/WhatsAppButton';
import Socials from '../shared/Socials';

/** BAKERY_01 — Foco foto: héroe con la foto del producto estrella y grid fotográfico grande. */
export default function Bakery01({ business, products, gallery }: TemplateProps) {
  const slug = business?.slug;
  const hero = products?.find((p: any) => productImage(p)) || null;
  const photos = [
    ...(hero && productImage(hero) ? [{ id: hero.id, url: productImage(hero), alt: hero.name }] : []),
    ...gallery.map((g: any) => ({ id: g.id, url: g.url, alt: g.alt })),
  ];

  return (
    <div className="space-y-12">
      <section className="grid md:grid-cols-2 gap-6 items-center">
        <div className="aspect-square rounded-3xl overflow-hidden bg-amber-100">
          {photos[0] ? (
            <img src={photos[0].url} alt={photos[0].alt || business?.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-amber-400 text-6xl">🥐</div>
          )}
        </div>
        <div>
          <p className="uppercase tracking-[0.3em] text-xs text-amber-600">Panadería & Pastelería</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold mt-2 text-amber-950">{business?.name}</h1>
          {business?.description && <p className="mt-4 text-neutral-600 whitespace-pre-line line-clamp-6">{business.description}</p>}
          <div className="mt-4">
            <Socials socials={business?.socials} />
          </div>
          <a
            href={buildWaLink(business?.whatsapp, waMessage(business, 'quiero hacer un pedido'))}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
            className="mt-6 inline-block rounded-full bg-amber-600 text-white font-semibold px-7 py-3 hover:bg-amber-700"
          >
            Pedir por WhatsApp
          </a>
        </div>
      </section>

      {!!photos.length && (
        <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.slice(0, 9).map((img: any) => (
            <figure key={img.id} className="group relative aspect-[4/3] overflow-hidden rounded-2xl">
              <img src={img.url} alt={img.alt || 'Producto'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
            </figure>
          ))}
        </section>
      )}

      {!!products?.length && (
        <section>
          <h2 className="text-2xl font-bold text-amber-950 mb-4">Nuestro catálogo</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {products.map((p: any) => (
              <article key={p.id} className="bg-white rounded-2xl border overflow-hidden">
                {productImage(p) && <img src={productImage(p)} alt={p.name} className="w-full h-40 object-cover" loading="lazy" />}
                <div className="p-3">
                  <p className="font-semibold text-sm line-clamp-2">{p.name}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-bold text-amber-700">{clp(p.salePrice)}</span>
                    <a
                      href={buildWaLink(business?.whatsapp, `Hola, quiero pedir: ${p.name}`)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
                      className="text-xs font-semibold text-amber-700 underline underline-offset-4"
                    >
                      Pedir
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="bg-amber-50 rounded-2xl p-6 text-center">
        <p className="font-semibold text-amber-900">{business?.address}{business?.city ? ` · ${business.city}` : ''}</p>
        {business?.phone && <p className="text-sm text-amber-700 mt-1">Tel: {business.phone}</p>}
      </section>
      <WhatsAppButton phone={business?.whatsapp} message={waMessage(business, 'quiero hacer un pedido')} slug={slug} label="Pedir" />
    </div>
  );
}
