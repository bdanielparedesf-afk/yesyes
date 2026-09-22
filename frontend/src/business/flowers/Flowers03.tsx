import { buildWaLink, trackEvent } from '@/services/business';
import { clp, productImage, waMessage, type TemplateProps } from '../shared/templateUtils';
import CTABar from '../shared/CTABar';

/** FLOWERS_03 — Delivery de flores: entrega el mismo día como propuesta principal. */
export default function Flowers03({ business, products }: TemplateProps) {
  const slug = business?.slug;
  const deliveryMsg = waMessage(business, 'quiero delivery de flores hoy');
  return (
    <div className="space-y-10">
      <section className="-mx-4 -mt-6 bg-pink-600 text-white px-4 py-12 text-center">
        <p className="uppercase tracking-[0.3em] text-xs text-pink-200">Entrega el mismo día</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold mt-2">Flores a tu puerta</h1>
        <p className="mt-3 text-pink-100 max-w-lg mx-auto">
          Pide antes de las 16:00 y {business?.city ? `entregamos hoy en ${business.city}` : 'entregamos hoy'}.
        </p>
        <a
          href={buildWaLink(business?.whatsapp, deliveryMsg)}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
          className="mt-6 inline-block rounded-full bg-white text-pink-700 font-bold px-8 py-3 hover:bg-pink-50"
        >
          Pedir entrega hoy
        </a>
        {business?.name && <p className="mt-4 text-sm text-pink-200">por {business.name}</p>}
      </section>

      <section className="grid sm:grid-cols-3 gap-4 text-center">
        {[
          { t: '🚚', h: 'Mismo día', d: 'Pedidos antes de las 16:00' },
          { t: '🌸', h: 'Frescura', d: 'Flores seleccionadas a mano' },
          { t: '💌', h: 'Mensaje gratis', d: 'Incluye tarjeta personalizada' },
        ].map((f) => (
          <div key={f.h} className="bg-white border rounded-2xl p-5">
            <span className="text-3xl">{f.t}</span>
            <p className="font-semibold mt-2">{f.h}</p>
            <p className="text-sm text-neutral-500">{f.d}</p>
          </div>
        ))}
      </section>

      {!!products?.length && (
        <section>
          <h2 className="text-xl font-bold mb-3">Ramos disponibles</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products.map((p: any) => (
              <article key={p.id} className="flex gap-3 bg-white border rounded-xl p-3 items-center">
                {productImage(p) && <img src={productImage(p)} alt={p.name} className="w-16 h-16 rounded-lg object-cover" loading="lazy" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold line-clamp-2">{p.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-bold text-sm text-pink-700">{clp(p.salePrice)}</span>
                    <a
                      href={buildWaLink(business?.whatsapp, `Hola, quiero pedir con delivery: ${p.name}`)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
                      className="text-xs font-semibold text-pink-700 underline underline-offset-4"
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

      {business?.address && (
        <section className="text-sm text-neutral-600 text-center">
          {business.address}
          {business?.city ? `, ${business.city}` : ''} {business?.phone ? `· ${business.phone}` : ''}
        </section>
      )}
      <div className="h-14" />
      <CTABar business={business} slug={slug} message={deliveryMsg} waLabel="Pedir delivery" />
    </div>
  );
}
