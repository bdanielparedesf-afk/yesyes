import { buildWaLink, trackEvent } from '@/services/business';
import { clp, waMessage, type TemplateProps } from '../shared/templateUtils';
import HoursMap from '../shared/HoursMap';
import Socials from '../shared/Socials';
import WhatsAppButton from '../shared/WhatsAppButton';

/** HAIR_02 — Dividido: panel de información fijo a la izquierda + tarjetas de servicios a la derecha. */
export default function Hair02({ business, services, gallery }: TemplateProps) {
  const slug = business?.slug;
  return (
    <div className="space-y-10">
      <div className="grid lg:grid-cols-5 gap-6 items-start">
        <aside className="lg:col-span-2 lg:sticky lg:top-20 bg-white rounded-2xl border p-6 space-y-5">
          {business?.logo && <img src={business.logo} alt={business?.name} className="w-20 h-20 rounded-2xl object-cover" />}
          <div>
            <h1 className="text-2xl font-extrabold">{business?.name}</h1>
            {business?.city && <p className="text-sm text-neutral-500">{business.city}</p>}
          </div>
          {business?.description && <p className="text-sm text-neutral-600 whitespace-pre-line">{business.description}</p>}
          <Socials socials={business?.socials} />
          <HoursMap business={business} />
          <a
            href={buildWaLink(business?.whatsapp, waMessage(business, 'quiero reservar una cita'))}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
            className="block text-center rounded-xl bg-black text-white font-semibold py-3 hover:bg-neutral-800"
          >
            Reservar cita
          </a>
        </aside>

        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-xl font-bold">Servicios</h2>
          {!services?.length && <p className="text-neutral-500">Pronto publicaremos nuestros servicios.</p>}
          {services.map((s: any, i: number) => (
            <article key={s.id} className="flex gap-4 bg-white rounded-2xl border p-4 hover:shadow-md transition-shadow">
              <div className="w-24 h-24 shrink-0 rounded-xl bg-gradient-to-br from-teal-100 to-emerald-100 overflow-hidden flex items-center justify-center">
                {s.image ? (
                  <img src={s.image} alt={s.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-2xl font-black text-teal-400">{String(i + 1).padStart(2, '0')}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-3">
                  <p className="font-semibold truncate">{s.name}</p>
                  {s.price != null && <p className="font-bold text-teal-700 whitespace-nowrap">{clp(s.price)}</p>}
                </div>
                {s.description && <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{s.description}</p>}
                <div className="mt-2 flex items-center gap-3 text-xs">
                  {s.durationMin && <span className="rounded-full bg-neutral-100 px-2 py-0.5">{s.durationMin} min</span>}
                  <a
                    href={buildWaLink(business?.whatsapp, `Hola, me interesa: ${s.name}`)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
                    className="font-semibold text-teal-700 underline underline-offset-4"
                  >
                    Reservar →
                  </a>
                </div>
              </div>
            </article>
          ))}

          {!!gallery?.length && (
            <div className="pt-4">
              <h2 className="text-xl font-bold mb-3">Galería</h2>
              <div className="grid grid-cols-3 gap-2">
                {gallery.map((g: any) => (
                  <img key={g.id} src={g.url} alt={g.alt || 'Foto'} className="w-full h-28 object-cover rounded-lg" loading="lazy" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <WhatsAppButton phone={business?.whatsapp} message={waMessage(business, 'quiero reservar una cita')} slug={slug} />
    </div>
  );
}
