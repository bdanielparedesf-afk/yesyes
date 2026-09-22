import { buildWaLink, trackEvent } from '@/services/business';
import { clp, waMessage, type TemplateProps } from '../shared/templateUtils';
import WhatsAppButton from '../shared/WhatsAppButton';
import Socials from '../shared/Socials';

/** FLOWERS_04 — Minimal editorial: tipografía fina, líneas delicadas, listado sobrio. */
export default function Flowers04({ business, products, gallery }: TemplateProps) {
  const slug = business?.slug;
  return (
    <div className="space-y-14 text-neutral-800">
      <header className="text-center border-b border-neutral-200 pb-10">
        <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-400">Flores</p>
        <h1 className="text-4xl sm:text-5xl font-light tracking-wide mt-3">{business?.name}</h1>
        {business?.city && <p className="mt-2 text-sm text-neutral-400">{business.city}</p>}
        <div className="mt-4 flex justify-center">
          <Socials socials={business?.socials} />
        </div>
      </header>

      {business?.description && (
        <p className="max-w-xl mx-auto text-center leading-relaxed text-neutral-500">{business.description}</p>
      )}

      {!!gallery?.length && (
        <section className="max-w-3xl mx-auto">
          <img src={gallery[0].url} alt={gallery[0].alt || business?.name} className="w-full h-[420px] object-cover" loading="lazy" />
          {!!gallery[1] && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              {gallery.slice(1, 3).map((g: any) => (
                <img key={g.id} src={g.url} alt={g.alt || ''} className="w-full h-52 object-cover" loading="lazy" />
              ))}
            </div>
          )}
        </section>
      )}

      {!!products?.length && (
        <section className="max-w-3xl mx-auto w-full">
          <h2 className="text-center text-sm uppercase tracking-[0.35em] text-neutral-400 mb-6">Catálogo</h2>
          <ul className="divide-y divide-neutral-200">
            {products.map((p: any) => (
              <li key={p.id} className="py-5 flex items-center justify-between gap-6">
                <div>
                  <p className="font-medium">{p.name}</p>
                  {p.description && <p className="text-sm text-neutral-400 line-clamp-1 mt-0.5">{p.description}</p>}
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  <span className="font-light">{clp(p.salePrice)}</span>
                  <a
                    href={buildWaLink(business?.whatsapp, `Hola, me interesa: ${p.name}`)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
                    className="text-xs uppercase tracking-widest underline underline-offset-4 text-neutral-500 hover:text-black"
                  >
                    Consultar
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {business?.address && (
        <footer className="text-center text-sm text-neutral-500">
          <p>{business.address}{business?.city ? `, ${business.city}` : ''}</p>
          {business?.phone && <p className="mt-1">+56 9 … · WhatsApp disponible</p>}
        </footer>
      )}
      <WhatsAppButton phone={business?.whatsapp} message={waMessage(business, 'quiero pedir flores')} slug={slug} label="Consultar" />
    </div>
  );
}
