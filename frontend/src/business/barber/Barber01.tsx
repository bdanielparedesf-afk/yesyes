import { getIndustryComposition } from '../industryComposition';
import { thematicAssets } from '../assets';
import { buildWaLink, trackEvent } from '@/services/business';
import { clp, waMessage, type TemplateProps } from '../shared/templateUtils';
import CTABar from '../shared/CTABar';
import Socials from '../shared/Socials';

const DAY_LABELS: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves',
  viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
  Lun: 'Lunes', Mar: 'Martes', Mie: 'Miércoles', Jue: 'Jueves', Vie: 'Viernes', Sab: 'Sábado', Dom: 'Domingo',
};

/** BARBER_01 — Precios y horarios: tablero oscuro tipo barbershop con lista de precios. */
export default function Barber01({ business, services, gallery }: TemplateProps) {
  const slug = business?.slug;
  const composition = getIndustryComposition(business?.template?.code, business?.category);
  const hero = business?.cover || thematicAssets(composition.category)[0];
  const waHref = buildWaLink(business?.whatsapp, `Hola ${business?.name || ''}, quiero ${composition.cta.toLowerCase()}.`);
  const hours = business?.hours && typeof business.hours === 'object' ? (business.hours as Record<string, unknown>) : null;
  const hoursRows = hours
    ? Object.entries(hours).map(([k, v]) => [DAY_LABELS[k] || DAY_LABELS[k.charAt(0).toUpperCase() + k.slice(1)] || k, String(v)] as const)
    : [];

  return (
    <div className="-mx-4 -mt-6 bg-neutral-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-14">
        <header className="relative -mx-4 -mt-6 min-h-[68vh] overflow-hidden px-4 pb-12 sm:flex sm:items-end">
          <img src={hero?.src} alt={hero?.alt || `Barbería ${business?.name}`} className="absolute inset-0 h-full w-full object-cover grayscale" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />
          <div className="relative mx-auto w-full max-w-5xl border-b border-amber-600/40 pb-10 text-center">
            <p className="uppercase tracking-[0.5em] text-xs text-amber-500">Barbería</p>
            <h1 className="mt-3 text-5xl font-black uppercase sm:text-7xl">{business?.name}</h1>
            {business?.city && <p className="mt-3 text-neutral-300">{business.city}</p>}
            <a href={waHref} target="_blank" rel="noreferrer" onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')} className="mt-6 inline-block rounded-sm bg-amber-500 px-8 py-3 font-bold uppercase tracking-wide text-black focus-visible:outline focus-visible:ring-2">{composition.cta}</a>
          </div>
        </header>

        <div className="grid md:grid-cols-3 gap-10">
          <section className="md:col-span-2">
            <h2 className="text-2xl font-black uppercase text-amber-500 mb-5">Lista de precios</h2>
            {!services?.length && <p className="text-neutral-400">Precios disponibles pronto.</p>}
            <ul className="space-y-4">
              {services.map((s: any) => (
                <li key={s.id} className="border-b border-neutral-800 pb-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-lg font-semibold uppercase">{s.name}</span>
                    <span className="text-xl font-black text-amber-500 whitespace-nowrap">
                      {s.price != null ? clp(s.price) : 'Consultar'}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-4">
                    <p className="text-sm text-neutral-400 line-clamp-1">{s.description || (s.durationMin ? `${s.durationMin} min` : '')}</p>
                    <a
                      href={buildWaLink(business?.whatsapp, `Hola, quiero el servicio: ${s.name}`)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
                      className="text-sm font-semibold text-amber-500 underline underline-offset-4 whitespace-nowrap"
                    >
                      Reservar
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <aside className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 h-fit">
            <h2 className="text-lg font-black uppercase text-amber-500 mb-4">Horarios</h2>
            {hoursRows.length ? (
              <dl className="text-sm divide-y divide-neutral-800">
                {hoursRows.map(([day, value]) => (
                  <div key={day} className="flex justify-between py-2 gap-3">
                    <dt className="text-neutral-300">{day}</dt>
                    <dd className="text-neutral-500 text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-neutral-400">Consulta horarios por WhatsApp.</p>
            )}
            {business?.address && (
              <p className="mt-4 text-sm text-neutral-400">
                {business.address}
                {business?.city ? `, ${business.city}` : ''}
              </p>
            )}
            <div className="mt-4">
              <Socials socials={business?.socials} />
            </div>
            {business?.mapsUrl && (
              <a href={business.mapsUrl} target="_blank" rel="noreferrer" className="block mt-4 text-sm text-amber-500 underline">
                Cómo llegar
              </a>
            )}
          </aside>
        </div>

        {!!gallery?.length && (
          <section>
            <h2 className="text-2xl font-black uppercase text-amber-500 mb-4">Cortes recientes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {gallery.map((g: any) => (
                <img key={g.id} src={g.url} alt={g.alt || 'Corte'} className="w-full h-36 object-cover rounded-sm grayscale hover:grayscale-0 transition-all" loading="lazy" />
              ))}
            </div>
          </section>
        )}
        <div className="h-12" />
      </div>
      <CTABar business={business} slug={slug} message={waMessage(business, 'quiero agendar una cita')} />
    </div>
  );
}
