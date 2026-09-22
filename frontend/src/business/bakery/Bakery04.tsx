import { buildWaLink, trackEvent } from '@/services/business';
import { clp, productImage, waMessage, type TemplateProps } from '../shared/templateUtils';
import WhatsAppButton from '../shared/WhatsAppButton';
import HoursMap from '../shared/HoursMap';

const OCCASIONS = [
  { emoji: '🎂', label: 'Cumpleaños', msg: 'quiero pedir un pastel de cumpleaños' },
  { emoji: '💍', label: 'Bodas & fiestas', msg: 'necesito catering para una fiesta' },
  { emoji: '🏢', label: 'Eventos empresa', msg: 'quiero cotizar para un evento de empresa' },
  { emoji: '🎁', label: 'Regalos', msg: 'busco una caja de regalo' },
];

/** BAKERY_04 — Ocasiones: entry points por tipo de celebración + catálogo. */
export default function Bakery04({ business, products, gallery }: TemplateProps) {
  const slug = business?.slug;
  return (
    <div className="space-y-12">
      <header className="text-center">
        <h1 className="text-4xl font-extrabold text-rose-950">{business?.name}</h1>
        <p className="mt-2 text-rose-500">Pasteles y postres para cada ocasión</p>
      </header>

      <section>
        <h2 className="text-lg font-bold mb-4">¿Para qué lo necesitas?</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {OCCASIONS.map((o) => (
            <a
              key={o.label}
              href={buildWaLink(business?.whatsapp, `Hola, ${o.msg}`)}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
              className="bg-white border rounded-2xl p-5 text-center hover:border-rose-300 hover:shadow-md transition-all"
            >
              <span className="text-3xl">{o.emoji}</span>
              <p className="mt-2 text-sm font-semibold">{o.label}</p>
              <p className="text-xs text-rose-500 mt-1">Cotizar →</p>
            </a>
          ))}
        </div>
      </section>

      {business?.description && (
        <section className="bg-rose-50 rounded-2xl p-6 text-neutral-700 whitespace-pre-line">{business.description}</section>
      )}

      {!!gallery?.length && (
        <section>
          <h2 className="text-lg font-bold mb-3">Inspiración</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {gallery.map((g: any) => (
              <img key={g.id} src={g.url} alt={g.alt || 'Creación'} className="w-full h-32 object-cover rounded-xl" loading="lazy" />
            ))}
          </div>
        </section>
      )}

      {!!products?.length && (
        <section>
          <h2 className="text-lg font-bold mb-3">Catálogo</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {products.map((p: any) => (
              <article key={p.id} className="bg-white border rounded-xl overflow-hidden">
                {productImage(p) && <img src={productImage(p)} alt={p.name} className="w-full h-32 object-cover" loading="lazy" />}
                <div className="p-3">
                  <p className="text-sm font-semibold line-clamp-2">{p.name}</p>
                  <p className="font-bold text-rose-700 mt-1 text-sm">{clp(p.salePrice)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl border p-6">
        <HoursMap business={business} />
      </section>
      <WhatsAppButton phone={business?.whatsapp} message={waMessage(business, 'quiero cotizar un pastel')} slug={slug} label="Cotizar" />
    </div>
  );
}
