import { getIndustryComposition } from '../industryComposition';
import { thematicAssets } from '../assets';
import { buildWaLink, trackEvent } from '@/services/business';
import { clp, productImage, waMessage, type TemplateProps } from '../shared/templateUtils';
import CTABar from '../shared/CTABar';
import HoursMap from '../shared/HoursMap';
import Socials from '../shared/Socials';

/** HAIR_01 — Hero grande: portada a pantalla completa con overlay + servicios en tarjetas. */
export default function Hair01({ business, services, products, gallery }: TemplateProps) {
  const slug = business?.slug;
  const composition = getIndustryComposition(business?.template?.code, business?.category);
  const hero = business?.cover || thematicAssets(composition.category)[0];
  const waHref = buildWaLink(business?.whatsapp, `Hola ${business?.name || ''}, quiero ${composition.cta.toLowerCase()}.`);
  return (
    <div className="space-y-12">
      <section className="relative -mx-4 -mt-6 h-[70vh] min-h-[420px] overflow-hidden bg-neutral-900">
        <img src={hero?.src} alt={hero?.alt || `Peluquería ${business?.name}`} className="absolute inset-0 w-full h-full object-cover object-[center_35%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="relative h-full flex flex-col justify-end max-w-5xl mx-auto px-4 pb-10 text-white">
          <p className="uppercase tracking-[0.3em] text-xs text-white/80">Estilo & Color</p>
          <h1 className="text-4xl sm:text-6xl font-extrabold mt-2">{business?.name}</h1>
          {business?.city && <p className="mt-2 text-white/85">{business.city}</p>}
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
            className="mt-5 self-start rounded-full bg-white text-black font-semibold px-7 py-3 hover:bg-fuchsia-100"
          >
            {composition.cta}
          </a>
        </div>
      </section>

      {business?.description && (
        <section className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold">Sobre nosotros</h2>
          <p className="mt-3 text-neutral-600 whitespace-pre-line">{business.description}</p>
          <div className="mt-4 flex justify-center">
            <Socials socials={business?.socials} />
          </div>
        </section>
      )}

      {!!services?.length && (
        <section>
          <h2 className="text-2xl font-bold mb-5">Servicios</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((s: any) => (
              <div key={s.id} className="group bg-white rounded-2xl border overflow-hidden hover:shadow-lg transition-shadow">
                {s.image && <img src={s.image} alt={s.name} className="w-full h-40 object-cover" loading="lazy" />}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{s.name}</p>
                    {s.price != null && <p className="font-bold text-fuchsia-700 whitespace-nowrap">{clp(s.price)}</p>}
                  </div>
                  {s.description && <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{s.description}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    {s.durationMin ? <span className="text-xs bg-fuchsia-50 text-fuchsia-700 rounded-full px-2 py-1">{s.durationMin} min</span> : <span />}
                    <a
                      href={buildWaLink(business?.whatsapp, `Hola, quiero reservar: ${s.name}`)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
                      className="text-sm font-semibold text-fuchsia-700 underline underline-offset-4"
                    >
                      Reservar
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!!products?.length && (
        <section>
          <h2 className="text-2xl font-bold mb-4">Productos destacados</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {products.slice(0, 8).map((p: any) => (
              <div key={p.id} className="bg-white rounded-xl border overflow-hidden">
                {productImage(p) && <img src={productImage(p)} alt={p.name} className="w-full h-32 object-cover" loading="lazy" />}
                <div className="p-2.5">
                  <p className="text-xs font-semibold line-clamp-2">{p.name}</p>
                  <p className="text-sm font-bold mt-1">{clp(p.salePrice)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!!gallery?.length && (
        <section>
          <h2 className="text-2xl font-bold mb-4">Nuestro trabajo</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {gallery.map((g: any) => (
              <img key={g.id} src={g.url} alt={g.alt || 'Trabajo'} className="w-full h-36 object-cover rounded-lg" loading="lazy" />
            ))}
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl border p-6">
        <HoursMap business={business} />
      </section>
      <div className="h-14" />
      <CTABar business={business} slug={slug} message={waMessage(business, 'quiero agendar una hora')} />
    </div>
  );
}
