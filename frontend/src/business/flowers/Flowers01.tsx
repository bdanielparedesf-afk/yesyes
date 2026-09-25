import { getIndustryComposition } from '../industryComposition';
import { thematicAssets } from '../assets';
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
  const composition = getIndustryComposition(business?.template?.code, business?.category);
  const hero = business?.cover || thematicAssets(composition.category)[0];
  const waHref = buildWaLink(business?.whatsapp, `Hola ${business?.name || ''}, quiero ${composition.cta.toLowerCase()}.`);
  return (
    <div className="space-y-12">
      <header className="relative -mx-4 overflow-hidden px-4 pb-16 pt-14 text-white sm:min-h-[68vh] sm:pb-20">
        <img src={hero?.src} alt={hero?.alt || `Arreglo floral de ${business?.name}`} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent" />
        <div className="relative mx-auto max-w-5xl">
          <p className="uppercase tracking-[0.35em] text-xs text-white/75">Floristería editorial</p>
          <h1 className="mt-3 max-w-3xl font-serif text-5xl font-normal leading-[.95] sm:text-7xl">{business?.name}</h1>
          <p className="mt-5 max-w-xl text-lg text-white/85">{business?.description}</p>
          <a href={waHref} target="_blank" rel="noreferrer" onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')} className="mt-7 inline-block rounded-full bg-white px-7 py-3 font-bold text-stone-900 focus-visible:outline focus-visible:ring-2">{composition.cta}</a>
          <div className="mt-5"><Socials socials={business?.socials} /></div>
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
