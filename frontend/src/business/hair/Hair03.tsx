import { buildWaLink, trackEvent } from '@/services/business';
import { clp, waMessage, type TemplateProps } from '../shared/templateUtils';
import HoursMap from '../shared/HoursMap';
import Socials from '../shared/Socials';
import WhatsAppButton from '../shared/WhatsAppButton';

/** HAIR_03 — Editorial: bandas alternadas imagen/texto + lista numerada de servicios. */
export default function Hair03({ business, services, gallery }: TemplateProps) {
  const slug = business?.slug;
  const bands = gallery.length ? gallery.slice(0, 4) : business?.cover ? [{ id: 'cover', url: business.cover, alt: business.name }] : [];
  return (
    <div className="space-y-14 font-[Georgia,serif] text-stone-800">
      <section className="text-center max-w-2xl mx-auto">
        <p className="uppercase tracking-[0.4em] text-[11px] text-stone-400">Salón</p>
        <h1 className="text-5xl sm:text-6xl font-bold mt-3">{business?.name}</h1>
        {business?.city && <p className="mt-3 italic text-stone-500">{business.city}</p>}
        <div className="mt-4 flex justify-center">
          <Socials socials={business?.socials} />
        </div>
      </section>

      {!!business?.description && (
        <section className="max-w-3xl mx-auto text-center text-lg leading-relaxed text-stone-600">
          {business.description}
        </section>
      )}

      {bands.map((img: any, i: number) => (
        <section key={img.id || i} className="grid sm:grid-cols-2 gap-8 items-center">
          <img
            src={img.url}
            alt={img.alt || business?.name}
            className={`w-full h-72 sm:h-96 object-cover ${i % 2 ? 'sm:order-2' : ''}`}
            loading="lazy"
          />
          <div className={i % 2 ? 'sm:order-1' : ''}>
            <p className="text-5xl font-bold text-stone-300">{String(i + 1).padStart(2, '0')}</p>
            <h2 className="text-3xl font-semibold mt-2">{i % 2 ? 'Ambiente & detalle' : 'Nuestro trabajo'}</h2>
            <p className="mt-3 text-stone-600 leading-relaxed">
              Cada visita es única: revisa nuestras fotos y reserva el servicio que buscas directo por WhatsApp.
            </p>
          </div>
        </section>
      ))}

      {!!services?.length && (
        <section className="max-w-3xl mx-auto w-full">
          <h2 className="text-3xl font-semibold border-b border-stone-300 pb-2">Servicios</h2>
          <ul className="mt-4 divide-y divide-stone-200">
            {services.map((s: any) => (
              <li key={s.id} className="py-4 flex items-baseline gap-3">
                <span className="font-medium">{s.name}</span>
                {s.durationMin && <span className="text-xs text-stone-400">{s.durationMin} min</span>}
                <span className="flex-1 border-b border-dotted border-stone-300 translate-y-[-4px]" />
                <span className="font-semibold">{s.price != null ? clp(s.price) : 'Consultar'}</span>
                <a
                  href={buildWaLink(business?.whatsapp, `Hola, me interesa el servicio: ${s.name}`)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
                  className="text-sm underline underline-offset-4 text-stone-500 hover:text-black"
                >
                  Reservar
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="max-w-3xl mx-auto w-full border-t border-stone-300 pt-8">
        <HoursMap business={business} />
      </section>
      <div className="h-12" />
      <WhatsAppButton phone={business?.whatsapp} message={waMessage(business, 'quiero agendar una hora')} slug={slug} label="Reservar" />
    </div>
  );
}
