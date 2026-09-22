import { buildWaLink, trackEvent } from '@/services/business';
import { clp, productImage, waMessage, type TemplateProps } from '../shared/templateUtils';
import CTABar from '../shared/CTABar';

/** BAKERY_03 — Delivery: pedido a domicilio como eje principal, catálogo compacto. */
export default function Bakery03({ business, products }: TemplateProps) {
  const slug = business?.slug;
  const deliveryMsg = waMessage(business, 'hacer un pedido con delivery');
  return (
    <div className="space-y-10">
      <section className="-mx-4 -mt-6 bg-emerald-700 text-white px-4 py-12 text-center">
        <p className="uppercase tracking-[0.3em] text-xs text-emerald-200">Delivery hoy</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold mt-2">{business?.name}</h1>
        <p className="mt-3 text-emerald-100 max-w-xl mx-auto">
          Pide desde tu casa: pan, pastelería y más, entregados el mismo día en {business?.city || 'tu zona'}.
        </p>
        <a
          href={buildWaLink(business?.whatsapp, deliveryMsg)}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
          className="mt-6 inline-block rounded-full bg-white text-emerald-800 font-bold px-8 py-3 hover:bg-emerald-50"
        >
          Pedir delivery ahora
        </a>
        <p className="mt-3 text-sm text-emerald-200">
          {business?.address || ''} {business?.phone ? `· Tel ${business.phone}` : ''}
        </p>
      </section>

      {business?.description && <p className="max-w-2xl mx-auto text-center text-neutral-600 whitespace-pre-line">{business.description}</p>}

      <section>
        <h2 className="text-2xl font-bold mb-4">¿Qué se te antoja?</h2>
        {!products?.length && <p className="text-neutral-500">Catálogo en preparación — escríbenos para disponibilidad.</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {products.map((p: any) => (
            <article key={p.id} className="flex gap-3 bg-white rounded-xl border p-3 items-center">
              {productImage(p) && (
                <img src={productImage(p)} alt={p.name} className="w-20 h-20 rounded-lg object-cover shrink-0" loading="lazy" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold line-clamp-2">{p.name}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="font-bold text-emerald-700 text-sm">{clp(p.salePrice)}</span>
                  <a
                    href={buildWaLink(business?.whatsapp, `Hola, quiero pedir con delivery: ${p.name}`)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
                    className="text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-full px-3 py-1 hover:bg-emerald-100"
                  >
                    Pedir
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="h-14" />
      <CTABar business={business} slug={slug} message={deliveryMsg} waLabel="Pedir delivery" />
    </div>
  );
}
