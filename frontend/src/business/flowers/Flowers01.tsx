import { buildWaLink, trackEvent } from '@/services/business';
import { clp, productImage, waMessage, type TemplateProps } from '../shared/templateUtils';
import WhatsAppButton from '../shared/WhatsAppButton';
import Socials from '../shared/Socials';

const OCCASIONS = [
  { emoji: '❤️', label: 'Amor & aniversario', msg: 'busco un ramo para alguien especial' },
  { emoji: '🎂', label: 'Cumpleaños', msg: 'quiero un ramo de cumpleaños' },
  { emoji: '💒', label: 'Bodas', msg: 'necesito flores para una boda' },
  { emoji: '🕊️', label: 'Condolencias', msg: 'necesito un arreglo de condolencias' },
];

/** FLOWERS_01 — Ocasiones: filtros por evento como eje + catálogo. */
export default function Flowers01({ business, products, gallery }: TemplateProps) {
  const slug = business?.slug;
  return (
    <div className="space-y-12">
      <header className="text-center bg-green-50 -mx-4 px-4 py-10 rounded-b-3xl">
        <p className="uppercase tracking-[0.35em] text-xs text-green-700">Florería</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold mt-2 text-green-950">{business?.name}</h1>
        <div className="mt-3 flex justify-center">
          <Socials socials={business?.socials} />
        </div>
      </header>

      <section>
        <h2 className="text-xl font-bold mb-4">Flores para…</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {OCCASIONS.map((o) => (
            <a
              key={o.label}
              href={buildWaLink(business?.whatsapp, `Hola, ${o.msg}`)}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
              className="rounded-2xl border bg-white p-5 text-center hover:border-green-300 hover:shadow-md transition-all"
            >
              <span className="text-3xl">{o.emoji}</span>
              <p className="mt-2 text-sm font-semibold">{o.label}</p>
              <p className="text-xs text-green-700 mt-1">Pedir →</p>
            </a>
          ))}
        </div>
      </section>

      {!!products?.length && (
        <section>
          <h2 className="text-xl font-bold mb-4">Ramos & arreglos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p: any) => (
              <article key={p.id} className="bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-shadow">
                {productImage(p) && <img src={productImage(p)} alt={p.name} className="w-full h-44 object-cover" loading="lazy" />}
                <div className="p-3">
                  <p className="font-semibold text-sm line-clamp-2">{p.name}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-bold text-green-800">{clp(p.salePrice)}</span>
                    <a
                      href={buildWaLink(business?.whatsapp, `Hola, quiero pedir: ${p.name}`)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
                      className="text-xs font-semibold text-green-700 underline underline-offset-4"
                    >
                      Cotizar
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {!!gallery?.length && (
        <section>
          <h2 className="text-xl font-bold mb-3">Galería</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {gallery.map((g: any) => (
              <img key={g.id} src={g.url} alt={g.alt || 'Ramo'} className="w-full h-28 object-cover rounded-xl" loading="lazy" />
            ))}
          </div>
        </section>
      )}

      <WhatsAppButton phone={business?.whatsapp} message={waMessage(business, 'quiero pedir flores')} slug={slug} label="Pedir flores" />
    </div>
  );
}
