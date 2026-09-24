import { buildWaLink, trackEvent } from '@/services/business';
import { Clock3, MapPin, Navigation } from 'lucide-react';
import { clp, productImage, waMessage, type TemplateProps } from './shared/templateUtils';
import CTABar from './shared/CTABar';
import WhatsAppButton from './shared/WhatsAppButton';

const money = (item: any) => clp(item.price ?? item.salePrice);
export function Grid({ items, business, dark = false }: { items: any[]; business: any; dark?: boolean }) {
  if (!items.length) return null;
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <article key={item.id} className={`group border p-4 ${dark ? 'border-white/10 bg-white/5' : 'border-neutral-200 bg-white shadow-sm'}`}>{productImage(item) && <img src={productImage(item)} alt={item.name} loading="lazy" className="mb-4 aspect-[4/3] w-full object-cover" />}<p className="font-bold">{item.name}</p><p className="mt-1 line-clamp-2 text-sm opacity-70">{item.shortDescription || item.description || item.bio}</p><div className="mt-4 flex justify-between gap-2"><b>{money(item)}</b><a href={buildWaLink(business.whatsapp, `Hola, quiero información sobre: ${item.name}`)} target="_blank" rel="noreferrer" onClick={() => trackEvent(business.slug, 'WHATSAPP_CLICK')}>{item.cta || 'Consultar'}</a></div></article>)}</div>;
}
export function Hero({ business, photo, eyebrow, title, href, dark = false }: any) {
  return <section className="relative min-h-[70vh] overflow-hidden"><div className="absolute inset-0">{photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-neutral-900" />}<div className={`absolute inset-0 ${dark ? 'bg-black/65' : 'bg-gradient-to-r from-black/75 to-transparent'}`} /></div><div className="relative mx-auto flex min-h-[70vh] max-w-6xl items-end px-4 py-16 text-white"><div><p className="text-xs uppercase tracking-[.4em]">{eyebrow}</p><h1 className="mt-4 text-5xl font-black sm:text-7xl">{business.name}</h1><p className="mt-4 text-lg text-white/80">{title}</p><a href={href} className="mt-7 inline-block rounded-full bg-white px-7 py-3 font-black text-black">Descubrir</a></div></div></section>;
}
export function Gallery({ gallery }: { gallery: any[] }) { if (!gallery?.length) return null; return <section id="galeria" className="bg-neutral-100 py-20"><div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 md:grid-cols-4">{gallery.map((g: any) => <img key={g.id} src={g.url} alt={g.alt || 'Galería'} loading="lazy" className="aspect-square w-full object-cover" />)}</div></section>; }

const DAY_ORDER = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
function RestaurantInfo({ business }: { business: any }) {
  const rawHours = business?.hours && typeof business.hours === 'object' && !Array.isArray(business.hours) ? business.hours : {};
  const hours = Object.entries(rawHours)
    .filter(([, value]) => value != null && String(value).trim() !== '')
    .sort(([a], [b]) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b) || a.localeCompare(b));
  const address = [business?.address, business?.city, business?.region].filter(Boolean).join(', ');
  const mapHref = business?.mapsUrl || (business?.lat != null && business?.lng != null ? `https://www.google.com/maps?q=${business.lat},${business.lng}` : '');
  if (!hours.length && !address && !business?.phone && !mapHref) return null;
  return <section id="informacion" className="border-y border-stone-800 bg-stone-900">
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:py-20">
      {hours.length > 0 && <div>
        <p className="flex items-center gap-2 text-xs uppercase tracking-[.4em] text-amber-400"><Clock3 size={15} /> Horarios</p>
        <h2 className="mt-3 text-3xl font-black">Cuándo puedes visitarnos</h2>
        <dl className="mt-7 divide-y divide-stone-700 border-y border-stone-700">
          {hours.map(([day, value]) => <div key={day} className="flex items-center justify-between gap-4 py-3 text-sm"><dt className="font-semibold text-stone-100">{day}</dt><dd className="text-right text-stone-300">{String(value)}</dd></div>)}
        </dl>
      </div>}
      {(address || business?.phone || mapHref) && <div>
        <p className="flex items-center gap-2 text-xs uppercase tracking-[.4em] text-amber-400"><MapPin size={15} /> Ubicación</p>
        <h2 className="mt-3 text-3xl font-black">Encuéntranos</h2>
        {address && <p className="mt-7 max-w-md text-lg leading-8 text-stone-200">{address}</p>}
        {business?.phone && <a className="mt-3 block w-fit text-stone-300 underline underline-offset-4" href={`tel:${business.phone}`}>Teléfono: {business.phone}</a>}
        {mapHref && <a className="mt-7 inline-flex items-center gap-2 rounded-full border border-amber-400 px-6 py-3 font-bold text-amber-300 transition hover:bg-amber-400 hover:text-stone-950" href={mapHref} target="_blank" rel="noreferrer"><Navigation size={16} /> Cómo llegar</a>}
      </div>}
    </div>
  </section>;
}

export default function VitrineTemplates({ business, services, products, gallery }: TemplateProps) {
  const code = business?.template?.code;
  const photo = business?.cover || gallery?.[0]?.url || productImage(products?.[0]);
  const message = waMessage(business, services?.[0] ? `quiero ${services[0].name}` : 'quiero conocer más');
  if (code === 'FOOD_01') return <div id="inicio" className="-mx-4 -mt-6 bg-stone-950 text-white"><Hero business={business} photo={photo} eyebrow="Cocina de autor" title="Una experiencia que empieza en la mesa." href="#catalogo" dark /><section id="catalogo" className="mx-auto grid max-w-6xl gap-10 px-4 py-20 lg:grid-cols-[.7fr_1.3fr]"><div><p className="text-xs uppercase tracking-[.4em] text-amber-400">Nuestra propuesta</p><p className="mt-5 text-stone-300">{business.description}</p></div><div><p className="text-xs uppercase tracking-[.4em] text-amber-400">Menú</p><div className="mt-5"><Grid items={products || []} business={business} dark /></div></div></section><Gallery gallery={gallery || []} /><RestaurantInfo business={business} /><CTABar business={business} slug={business.slug} message={message} waLabel="Pedir ahora" /></div>;
  if (code === 'BOUTIQUE_01') return <div id="inicio" className="-mx-4 -mt-6 bg-[#f7f2ea]"><header className="mx-auto grid min-h-[80vh] max-w-6xl items-center gap-8 px-4 py-16 lg:grid-cols-2"><div><p className="text-xs uppercase tracking-[.4em]">Nueva colección</p><h1 className="mt-4 font-serif text-6xl sm:text-8xl">{business.name}</h1><p className="mt-5 text-stone-600">{business.description}</p><a href="#catalogo" className="mt-8 inline-block rounded-full bg-stone-950 px-7 py-3 text-white">Descubrir colección</a></div>{photo && <img src={photo} alt={business.name} className="aspect-[4/5] h-full w-full object-cover" />}</header><section id="catalogo" className="mx-auto max-w-6xl px-4 py-20"><p className="text-center text-xs uppercase tracking-[.4em]">Piezas esenciales</p><div className="mt-8"><Grid items={products || []} business={business} /></div></section><Gallery gallery={gallery || []} /><WhatsAppButton phone={business.whatsapp} message={message} slug={business.slug} label="Asesoría de estilo" /></div>;
  if (code === 'PHOTO_01') return <div id="inicio" className="bg-neutral-950 text-white"><Hero business={business} photo={photo} eyebrow="Estudio de fotografía" title="Historias que merecen ser vistas." href="#galeria" dark /><Gallery gallery={gallery || []} /><section className="mx-auto max-w-6xl py-20"><p className="text-xs uppercase tracking-[.4em] text-cyan-300">Servicios</p><div className="mt-6"><Grid items={services || []} business={business} dark /></div></section><CTABar business={business} slug={business.slug} message={message} waLabel="Agendar sesión" /></div>;
  if (code === 'BEAUTY_01') return <div id="inicio" className="-mx-4 -mt-6 bg-[#f6eee9] text-[#382a29]"><Hero business={business} photo={photo} eyebrow="Belleza & bienestar" title="Rituales pensados para ti." href="#servicios" /><section id="servicios" className="mx-auto max-w-6xl px-4 py-20"><p className="text-center text-xs uppercase tracking-[.4em] text-rose-700">Tratamientos</p><div className="mt-8 grid gap-4 md:grid-cols-3">{services?.map((s: any) => <article key={s.id} className="rounded-[2rem] bg-white p-6"><p className="text-xs uppercase tracking-widest text-rose-500">Experiencia</p><h2 className="mt-2 font-serif text-2xl">{s.name}</h2><p className="mt-2 text-sm text-stone-600">{s.description}</p><b className="mt-5 block">{s.price != null ? clp(s.price) : 'Consultar'}</b></article>)}</div></section><Gallery gallery={gallery || []} /><CTABar business={business} slug={business.slug} message={message} waLabel="Reservar" /></div>;
  if (code === 'DETAILING_01') return <div id="inicio" className="-mx-4 -mt-6 bg-[#0c1117] text-white"><Hero business={business} photo={photo} eyebrow="Estudio de cuidado vehicular" title="Tu vehículo, impecable." href="#servicios" dark /><section id="servicios" className="mx-auto grid max-w-6xl gap-8 px-4 py-20 lg:grid-cols-2"><div><p className="text-xs uppercase tracking-[.4em] text-cyan-300">Paquetes</p><div className="mt-5 space-y-3">{services?.map((s: any) => <article key={s.id} className="flex justify-between gap-4 border border-white/10 bg-white/5 p-5"><div><b>{s.name}</b><p className="text-sm text-slate-400">{s.description}</p></div><b className="text-cyan-300">{s.price != null ? clp(s.price) : 'Consultar'}</b></article>)}</div></div><div className="grid grid-cols-2 gap-2">{gallery?.map((g: any) => <img key={g.id} src={g.url} alt={g.alt || 'Resultado'} className="aspect-square h-full w-full object-cover" />)}</div></section><CTABar business={business} slug={business.slug} message={message} waLabel="Cotizar" /></div>;
  return <div id="inicio" className="-mx-4 -mt-6 bg-white"><Hero business={business} photo={photo} eyebrow="Servicios profesionales" title="Experiencia, claridad y resultados." href="#servicios" /><section id="servicios" className="mx-auto grid max-w-6xl gap-8 px-4 py-20 lg:grid-cols-[.7fr_1.3fr]"><div><p className="text-xs uppercase tracking-[.4em] text-cyan-700">Cómo te ayudamos</p><p className="mt-5 text-slate-600">{business.description}</p></div><Grid items={services || []} business={business} /></section><Gallery gallery={gallery || []} /><CTABar business={business} slug={business.slug} message={message} waLabel="Solicitar propuesta" /></div>;
}

