import type { ReactNode } from 'react';
import { BusinessButton, BusinessCard, BusinessContainer, BusinessHeading, BusinessImage, BusinessSection } from '../components';
import { ContactSection, LocationSection } from '../components/BusinessSections';
import { BusinessVideo } from './BusinessVideo';
import { buildWaLink } from '@/services/business';
import { categoryLabel, ctaLabel as industryCta, resolveBusinessCta, resolveCtaHref } from '../businessLabels';

/**
 * YESYES BUSINESS Ã‚Â· TEMPLATE ENGINE V2 Ã¢â‚¬â€ Bloques (Fase 3).
 *
 * Estos componentes son la IMPLEMENTACIÃ“N de cada id del BlockRegistry.
 * El renderer Ãºnico (`BusinessPageRenderer`) los compone; no existe un
 * segundo renderer.
 *
 * Cada bloque:
 *  - recibe la config resuelta del manifest + los datos del negocio;
 *  - devuelve `null` si no hay contenido (nunca un placeholder vacÃ­o);
 *  - declara el comportamiento responsive que el layout le asignÃ³.
 */

export interface BlockContext {
  business: any;
  services: any[];
  products: any[];
  properties: any[];
  gallery: any[];
  testimonials: any[];
  faqs: any[];
  promotions: any[];
  team: any[];
  bookingSlots: any[];
  media: Array<{ id: string; kind: string; url: string; posterUrl?: string | null; alt?: string | null; title?: string | null }>;
  /** Estrategia responsive del layout para este bloque. */
  mobile: string;
  preview?: boolean;
}

export type BlockProps = BlockContext & {
  instanceId: string;
  config: Record<string, any>;
  /** Ancla de secciÃ³n: la navegaciÃ³n apunta acÃ¡. */
  anchor: string;
};

const text = (config: Record<string, any>, key: string, fallback = ''): string => {
  const value = config?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
};

const flag = (config: Record<string, any>, key: string, fallback: boolean): boolean =>
  typeof config?.[key] === 'boolean' ? Boolean(config[key]) : fallback;

const number = (config: Record<string, any>, key: string, fallback: number): number => {
  const value = Number(config?.[key]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
};

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const price = (value: unknown): string => CLP.format(Number(value || 0));

/**
 * Clases Tailwind ESTÃTICAS por opciÃ³n. Nunca se interpolan nombres de clase
 * construidos en runtime: Tailwind no los detecta al purgar y el diseÃ±o se
 * romperÃ­a en producciÃ³n.
 */
const GALLERY_COLUMNS: Record<string, string> = {
  '2': 'md:grid-cols-2',
  '3': 'md:grid-cols-3',
  '4': 'md:grid-cols-4',
};
const PRODUCT_COLUMNS: Record<string, string> = {
  grid: 'grid-cols-2 md:grid-cols-4',
  list: 'grid-cols-1 md:grid-cols-2',
  featured: 'grid-cols-1 md:grid-cols-3',
};
const SERVICE_COLUMNS: Record<string, string> = {
  '2': 'grid-cols-1 md:grid-cols-2',
  '3': 'grid-cols-1 md:grid-cols-3',
  '4': 'grid-cols-2 md:grid-cols-4',
};

/** Enlace de WhatsApp con el mensaje del bloque. */
function waHref(business: any, message: string): string {
  return buildWaLink(business?.whatsapp, message);
}

/** Portada con imagen y llamada a la acciÃ³n. */
function Hero({ business, config, anchor }: BlockProps) {
  const headline = text(config, 'headline', business?.name || '');
  const subheadline = text(config, 'subheadline', business?.description || '');
  const cover = text(config, 'image', business?.cover || '');
  // El texto del botÃ³n sale de la fuente ÃšNICA de CTA: lo que el usuario
  // configurÃ³ gana siempre. Antes se hardcodeaba por rubro.
  const ctaLabel = resolveBusinessCta(business, { blockLabel: config?.ctaLabel, fallback: industryCta(business?.category) });
  const ctaHref = resolveCtaHref(business, config?.action);
  if (!headline) return null;
  return (
    <BusinessSection id={anchor} className="bg-neutral-900 text-white">
      <BusinessContainer>
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            {business?.category && <p className="mb-2 text-xs font-bold uppercase tracking-[.24em] opacity-70">{categoryLabel(business.category)}</p>}
            <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">{headline}</h1>
            {subheadline && <p className="mt-4 max-w-xl text-lg opacity-80">{subheadline}</p>}
            {ctaHref && (
              <BusinessButton href={ctaHref} className="mt-7">
                {ctaLabel}
              </BusinessButton>
            )}
          </div>
          {cover && <BusinessImage src={cover} alt={headline} eager className="aspect-[4/3] w-full rounded-3xl object-cover" />}
        </div>
      </BusinessContainer>
    </BusinessSection>
  );
}

/** Portada con video de fondo, poster obligatorio y fallback en mobile. */
function HeroVideo({ business, config, anchor, media, mobile }: BlockProps) {
  const headline = text(config, 'headline', business?.name || '');
  if (!headline) return null;
  const reference = text(config, 'video');
  const video = media.find((item) => item.kind === 'video' && item.url === reference) || media.find((item) => item.kind === 'video');
  const poster = text(config, 'poster', video?.posterUrl || business?.cover || '');
  return (
    <BusinessSection id={anchor} className="relative bg-neutral-950 text-white">
      <div className="absolute inset-0">
        <BusinessVideo
          src={video?.url}
          poster={poster}
          alt={headline}
          autoplay={flag(config, 'autoplay', true)}
          muted={flag(config, 'muted', true)}
          loop={flag(config, 'loop', true)}
          controls={flag(config, 'controls', false)}
          posterOnlyOnMobile={mobile === 'focus-media'}
        />
      </div>
      <BusinessContainer className="relative">
        <h1 className="max-w-2xl text-4xl font-extrabold leading-tight drop-shadow sm:text-5xl">{headline}</h1>
        {text(config, 'subheadline') && <p className="mt-4 max-w-xl text-lg opacity-85">{text(config, 'subheadline')}</p>}
      </BusinessContainer>
    </BusinessSection>
  );
}

/** Texto libre: historia, polÃ­tica, informaciÃ³n. */
function TextBlock({ business, config, anchor }: BlockProps) {
  const body = text(config, 'body', business?.description || '');
  if (!body) return null;
  return (
    <BusinessSection id={anchor}>
      <BusinessContainer>
        <BusinessHeading title={text(config, 'title', 'Sobre nosotros')} text={body} />
      </BusinessContainer>
    </BusinessSection>
  );
}

/** Una imagen a tamaÃ±o completo. */
function ImageBlock({ business, config, anchor }: BlockProps) {
  const src = text(config, 'image', business?.cover || '');
  if (!src) return null;
  return (
    <BusinessSection id={anchor}>
      <BusinessContainer>
        <BusinessImage src={src} alt={text(config, 'caption', business?.name || 'Imagen del negocio')} className="w-full rounded-3xl object-cover" />
        {text(config, 'caption') && <p className="mt-3 text-sm opacity-70">{text(config, 'caption')}</p>}
      </BusinessContainer>
    </BusinessSection>
  );
}

/** GalerÃ­a de imÃ¡genes del trabajo o del local. */
function ImageGallery({ business, gallery, config, anchor }: BlockProps) {
  if (!gallery?.length) return null;
  return (
    <BusinessSection id={anchor} className="bg-stone-50">
      <BusinessContainer>
        {text(config, 'title') && <BusinessHeading title={text(config, 'title')} />}
        <div className={`grid grid-cols-2 gap-3 ${GALLERY_COLUMNS[text(config, 'columns', '3')] || GALLERY_COLUMNS['3']}`}>
          {gallery.map((item: any, index: number) => (
            <BusinessImage key={item.id || index} src={item.url} alt={item.alt || `Trabajo de ${business?.name || ''}`} className="aspect-[4/3] w-full rounded-2xl object-cover" />
          ))}
        </div>
      </BusinessContainer>
    </BusinessSection>
  );
}

/** Video en lÃ­nea con poster y controles opcionales. */
function Video({ business, config, anchor, media, mobile }: BlockProps) {
  const reference = text(config, 'video');
  const video = media.find((item) => item.kind === 'video' && item.url === reference) || media.find((item) => item.kind === 'video');
  if (!video) return null;
  return (
    <BusinessSection id={anchor}>
      <BusinessContainer>
        {text(config, 'title') && <BusinessHeading title={text(config, 'title')} />}
        <div className="overflow-hidden rounded-3xl">
          <BusinessVideo
            src={video.url}
            poster={text(config, 'poster', video.posterUrl || '') || business?.cover || ''}
            alt={video.title || video.alt || `Video de ${business?.name || 'el negocio'}`}
            autoplay={flag(config, 'autoplay', false)}
            controls={flag(config, 'controls', true)}
            className="aspect-video w-full"
            posterOnlyOnMobile={mobile === 'focus-media'}
          />
        </div>
      </BusinessContainer>
    </BusinessSection>
  );
}

/** GalerÃ­a de videos. Sin medios de video cae a la galerÃ­a de imÃ¡genes. */
function VideoGallery(props: BlockProps) {
  const { business, gallery, config, anchor, media, mobile } = props;
  const videos = (media || []).filter((item) => item.kind === 'video');
  if (!videos.length) return gallery?.length ? <ImageGallery {...props} /> : null;
  return (
    <BusinessSection id={anchor} className="bg-stone-50">
      <BusinessContainer>
        {text(config, 'title') && <BusinessHeading title={text(config, 'title')} />}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {videos.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-2xl">
              <BusinessVideo
                src={item.url}
                poster={item.posterUrl || business?.cover || ''}
                alt={item.title || item.alt || `Video de ${business?.name || 'el negocio'}`}
                controls
                className="aspect-video w-full"
                posterOnlyOnMobile={mobile === 'focus-media'}
              />
            </div>
          ))}
        </div>
      </BusinessContainer>
    </BusinessSection>
  );
}

/** BotÃ³n de acciÃ³n directa. Solo apunta a destinos reales. */
function Button({ business, config, anchor }: BlockProps) {
  const label = text(config, 'label');
  const action = text(config, 'action', 'whatsapp');
  if (!label) return null;
  const href =
    action === 'whatsapp' ? waHref(business, `Hola ${business?.name || ''}.`)
    : action === 'call' && business?.phone ? `tel:${business.phone}`
    : action === 'email' && business?.email ? `mailto:${business.email}`
    : text(config, 'href');
  if (!href) return null;
  return (
    <BusinessSection id={anchor} className="py-10">
      <BusinessContainer>
        <BusinessButton href={href}>{label}</BusinessButton>
      </BusinessContainer>
    </BusinessSection>
  );
}

/** Llamado a la acciÃ³n con una acciÃ³n principal. */
function CTA({ business, config, anchor }: BlockProps) {
  const action = text(config, 'action', 'whatsapp');
  const title = text(config, 'title', 'Â¿Te gustarÃ­a resolverlo hoy?');
  const body = text(config, 'body');
  // Misma fuente Ãºnica que el Hero: el CTA configurado por el usuario gana.
  const label = resolveBusinessCta(business, { blockLabel: config?.label, fallback: industryCta(business?.category) });
  const href = resolveCtaHref(business, action);
  if (!href) return null;
  return (
    <BusinessSection id={anchor} className="bg-neutral-100">
      <BusinessContainer>
        <BusinessHeading title={title} text={body} align="center" />
        <div className="flex justify-center">
          <BusinessButton href={href}>{label}</BusinessButton>
        </div>
      </BusinessContainer>
    </BusinessSection>
  );
}

/** CatÃ¡logo del negocio. */
function Products({ products, config, anchor }: BlockProps) {
  if (!products.length) return null;
  const limit = number(config, 'limit', 8);
  const layout = text(config, 'layout', 'grid');
  const showPrices = flag(config, 'showPrices', true);
  const items = products.slice(0, limit);
  return (
    <BusinessSection id={anchor}>
      <BusinessContainer>
        <BusinessHeading title={text(config, 'title', 'Nuestros productos')} />
        <div className={`grid gap-4 ${PRODUCT_COLUMNS[layout] || PRODUCT_COLUMNS.grid}`}>
          {items.map((item: any) => (
            <BusinessCard key={item.id} className="overflow-hidden p-0">
              {item.image && <BusinessImage src={item.image} alt={item.name} className="aspect-[4/3] w-full object-cover" />}
              <div className="p-4">
                <p className="font-semibold">{item.name}</p>
                {showPrices && <p className="mt-1 font-bold">{price(item.price)}</p>}
              </div>
            </BusinessCard>
          ))}
        </div>
      </BusinessContainer>
    </BusinessSection>
  );
}

/** Un producto destacado en grande. */
function ProductFeatured({ business, products, config, anchor }: BlockProps) {
  const id = text(config, 'productId');
  const item = products.find((entry: any) => entry.id === id) || products.find((entry: any) => entry.featured) || products[0];
  if (!item) return null;
  return (
    <BusinessSection id={anchor} className="bg-stone-50">
      <BusinessContainer>
        <div className="grid items-center gap-8 md:grid-cols-2">
          {item.image && <BusinessImage src={item.image} alt={item.name} className="aspect-[4/3] w-full rounded-3xl object-cover" />}
          <div>
            <BusinessHeading title={text(config, 'title', item.name)} text={item.shortDescription || item.description} />
            <p className="text-2xl font-extrabold">{price(item.price)}</p>
            {business?.whatsapp && <BusinessButton href={waHref(business, `Hola ${business.name}, me interesa ${item.name}.`)} className="mt-5">Consultar</BusinessButton>}
          </div>
        </div>
      </BusinessContainer>
    </BusinessSection>
  );
}

/** Promociones vigentes. */
function Promotions({ promotions, config, anchor }: BlockProps) {
  if (!promotions.length) return null;
  const limit = number(config, 'limit', 6);
  return (
    <BusinessSection id={anchor} className="bg-amber-50">
      <BusinessContainer>
        <BusinessHeading title={text(config, 'title', 'Promociones')} />
        <div className="grid gap-4 md:grid-cols-3">
          {promotions.slice(0, limit).map((item: any) => (
            <BusinessCard key={item.id}>
              <p className="font-bold">{item.title}</p>
              {item.description && <p className="mt-2 text-sm opacity-75">{item.description}</p>}
            </BusinessCard>
          ))}
        </div>
      </BusinessContainer>
    </BusinessSection>
  );
}

/** Listado de propiedades. */
function Properties({ properties, config, anchor }: BlockProps) {
  if (!properties.length) return null;
  const limit = number(config, 'limit', 6);
  return (
    <BusinessSection id={anchor}>
      <BusinessContainer>
        <BusinessHeading title={text(config, 'title', 'Propiedades')} />
        <div className="grid gap-4 md:grid-cols-3">
          {properties.slice(0, limit).map((item: any) => (
            <BusinessCard key={item.id} className="p-0">
              {item.images?.[0]?.url && <BusinessImage src={item.images[0].url} alt={item.title} className="aspect-[4/3] w-full object-cover" />}
              <div className="p-4">
                <p className="text-xs uppercase opacity-60">{item.operation} Ã‚Â· {item.type}</p>
                <p className="mt-1 font-semibold">{item.title}</p>
                <p className="mt-1 font-bold">{price(item.price)}</p>
              </div>
            </BusinessCard>
          ))}
        </div>
      </BusinessContainer>
    </BusinessSection>
  );
}

/** Una propiedad destacada. */
function PropertyFeatured({ business, properties, config, anchor }: BlockProps) {
  const id = text(config, 'propertyId');
  const item = properties.find((entry: any) => entry.id === id) || properties.find((entry: any) => entry.featured) || properties[0];
  if (!item) return null;
  return (
    <BusinessSection id={anchor} className="bg-stone-50">
      <BusinessContainer>
        <div className="grid items-center gap-8 md:grid-cols-2">
          {item.images?.[0]?.url && <BusinessImage src={item.images[0].url} alt={item.title} className="aspect-[4/3] w-full rounded-3xl object-cover" />}
          <div>
            <BusinessHeading title={item.title} text={[item.city, item.address].filter(Boolean).join(', ')} />
            <p className="text-2xl font-extrabold">{price(item.price)}</p>
            <ul className="mt-3 flex flex-wrap gap-3 text-sm opacity-75">
              {item.bedrooms != null && <li>{item.bedrooms} dormitorios</li>}
              {item.bathrooms != null && <li>{item.bathrooms} baÃ±os</li>}
              {item.areaTotal != null && <li>{item.areaTotal} mÃ‚Â²</li>}
            </ul>
            {business?.whatsapp && <BusinessButton href={waHref(business, `Hola ${business.name}, quiero informaciÃ³n de ${item.title}.`)} className="mt-5">Consultar</BusinessButton>}
          </div>
        </div>
      </BusinessContainer>
    </BusinessSection>
  );
}

/** Servicios del negocio, con precios si los tiene. */
function Services({ services, config, anchor }: BlockProps) {
  if (!services.length) return null;
  const limit = number(config, 'limit', 12);
  const showPrices = flag(config, 'showPrices', true);
  return (
    <BusinessSection id={anchor}>
      <BusinessContainer>
        <BusinessHeading title={text(config, 'title', 'Servicios')} />
        <div className={`grid gap-4 ${SERVICE_COLUMNS[text(config, 'columns', '3')] || SERVICE_COLUMNS['3']}`}>
          {services.slice(0, limit).map((item: any) => (
            <BusinessCard key={item.id}>
              {item.image && <BusinessImage src={item.image} alt={item.name} className="mb-3 aspect-[4/3] w-full rounded-xl object-cover" />}
              <p className="font-semibold">{item.name}</p>
              {item.description && <p className="mt-1 text-sm opacity-75">{item.description}</p>}
              {showPrices && item.price != null && <p className="mt-2 font-bold">{price(item.price)}</p>}
            </BusinessCard>
          ))}
        </div>
      </BusinessContainer>
    </BusinessSection>
  );
}

/**
 * Agenda. El envÃ­o real lo hace el endpoint pÃºblico de reservas (POST
 * /:slug/bookings). Si no hay horarios configurados el bloque NO aparece:
 * es preferible no mostrarlo a mostrar un botÃ³n que no hace nada.
 */
function Booking({ business, bookingSlots, config, anchor }: BlockProps) {
  if (!bookingSlots.length) return null;
  const days = ['Domingo', 'Lunes', 'Martes', 'MiÃ©rcoles', 'Jueves', 'Viernes', 'SÃ¡bado'];
  return (
    <BusinessSection id={anchor} className="bg-neutral-50">
      <BusinessContainer>
        <BusinessHeading title={text(config, 'title', 'Reserva tu hora')} text={text(config, 'body')} />
        <div className="grid gap-6 md:grid-cols-2">
          <ul className="divide-y">
            {bookingSlots.map((slot: any) => (
              <li key={slot.id} className="flex justify-between gap-4 py-2 text-sm">
                <span>{days[slot.weekday] || 'DÃ­a'}</span>
                <span className="font-semibold">{slot.startTime}Ã¢â‚¬â€œ{slot.endTime}</span>
              </li>
            ))}
          </ul>
          {business?.whatsapp && <BusinessButton href={waHref(business, `Hola ${business.name}, quiero reservar.`)}>Reservar ahora</BusinessButton>}
        </div>
      </BusinessContainer>
    </BusinessSection>
  );
}

/** Testimonios de clientes. */
function Testimonials({ testimonials, config, anchor }: BlockProps) {
  if (!testimonials.length) return null;
  const limit = number(config, 'limit', 6);
  return (
    <BusinessSection id={anchor} className="bg-stone-50">
      <BusinessContainer>
        <BusinessHeading title={text(config, 'title', 'Lo que dicen')} />
        <div className="grid gap-4 md:grid-cols-3">
          {testimonials.slice(0, limit).map((item: any) => (
            <BusinessCard key={item.id}>
              <p className="opacity-80">Ã¢â‚¬Å“{item.content}Ã¢â‚¬Â</p>
              <p className="mt-3 text-sm font-semibold">{item.name}</p>
            </BusinessCard>
          ))}
        </div>
      </BusinessContainer>
    </BusinessSection>
  );
}

/** Equipo. */
function Team({ team, config, anchor }: BlockProps) {
  if (!team.length) return null;
  return (
    <BusinessSection id={anchor}>
      <BusinessContainer>
        <BusinessHeading title={text(config, 'title', 'Nuestro equipo')} />
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          {team.map((member: any) => (
            <div key={member.id}>
              {member.photo && <BusinessImage src={member.photo} alt={member.name} className="aspect-square w-full rounded-2xl object-cover" />}
              <p className="mt-2 font-semibold">{member.name}</p>
              {member.role && <p className="text-sm opacity-70">{member.role}</p>}
            </div>
          ))}
        </div>
      </BusinessContainer>
    </BusinessSection>
  );
}

/** Preguntas frecuentes, colapsables en mobile. */
function FAQ({ faqs, config, anchor }: BlockProps) {
  if (!faqs.length) return null;
  return (
    <BusinessSection id={anchor} className="bg-stone-50">
      <BusinessContainer>
        <BusinessHeading title={text(config, 'title', 'Preguntas frecuentes')} />
        <div className="mx-auto max-w-3xl space-y-3">
          {faqs.map((item: any) => (
            <details key={item.id} className="rounded-2xl border bg-white p-4">
              <summary className="cursor-pointer font-semibold">{item.question}</summary>
              <p className="mt-2 opacity-80">{item.answer}</p>
            </details>
          ))}
        </div>
      </BusinessContainer>
    </BusinessSection>
  );
}

/** Datos de contacto. Reutiliza la secciÃ³n real ya probada (mismo formulario). */
function Contact({ business, preview }: BlockProps) {
  return <ContactSection business={business} preview={preview} />;
}

/** BotÃ³n de WhatsApp. */
function WhatsApp({ business, config, anchor }: BlockProps) {
  if (!business?.whatsapp) return null;
  return (
    <BusinessSection id={anchor} className="py-10">
      <BusinessContainer>
        <BusinessButton href={waHref(business, `Hola ${business.name}, quiero mÃ¡s informaciÃ³n.`)}>
          {text(config, 'label', 'EscrÃ­benos por WhatsApp')}
        </BusinessButton>
      </BusinessContainer>
    </BusinessSection>
  );
}

/** UbicaciÃ³n: direcciÃ³n y enlace al mapa. */
function Map({ business }: BlockProps) {
  const address = [business?.address, business?.city, business?.region].filter(Boolean).join(', ');
  const href = business?.mapsUrl || (business?.lat != null && business?.lng != null ? `https://www.google.com/maps?q=${business.lat},${business.lng}` : '');
  if (!address && !href) return null;
  return <LocationSection business={business} />;
}

/** Redes sociales. */
function SocialLinks({ business, anchor }: BlockProps) {
  const socials = Object.entries(business?.socials || {}).filter(([, value]) => String(value || '').trim());
  if (!socials.length) return null;
  return (
    <BusinessSection id={anchor} className="py-10">
      <BusinessContainer>
        <div className="flex flex-wrap justify-center gap-3">
          {socials.map(([name, url]) => (
            <a key={name} href={String(url).startsWith('http') ? String(url) : `https://${url}`} target="_blank" rel="noreferrer" className="rounded-full border px-4 py-2 text-sm font-semibold capitalize">
              {name}
            </a>
          ))}
        </div>
      </BusinessContainer>
    </BusinessSection>
  );
}

/** Formulario que crea un lead real (POST /:slug/leads). */
function LeadForm({ business, anchor, preview }: BlockProps) {
  if (preview) {
    return (
      <BusinessSection id={anchor}>
        <BusinessContainer>
          <BusinessCard>
            <p className="font-semibold">Formulario disponible al publicar</p>
            <p className="mt-2 text-sm opacity-70">La vista previa no envÃ­a solicitudes.</p>
          </BusinessCard>
        </BusinessContainer>
      </BusinessSection>
    );
  }
  return <ContactSection business={business} />;
}

/** Pie de pÃ¡gina con datos del negocio. */
function Footer({ business, config, anchor }: BlockProps) {
  return (
    <footer id={anchor} className="border-t bg-white py-10 text-sm">
      <BusinessContainer>
        <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div>
            <p className="font-bold">{business?.name}</p>
            {[business?.address, business?.city].filter(Boolean).length > 0 && (
              <p className="opacity-70">{[business?.address, business?.city].filter(Boolean).join(', ')}</p>
            )}
          </div>
          <p className="opacity-60">{text(config, 'legalNote', 'YesYes')}</p>
        </div>
      </BusinessContainer>
    </footer>
  );
}

/**
 * MAPA ÃšNICO id â†’ renderer. Es la implementaciÃ³n del BlockRegistry.
 * Si un id del BlockRegistry no aparece aquÃ­, el bloque NO tiene renderer y
 * el test de paridad falla: es la guarda contra funcionalidad falsa y contra
 *Ã¤Â¸Â¤Ã¥Ââ€” con el mismo nombre en archivos distintos.
 */
export const BLOCK_RENDERERS: Record<string, (props: BlockProps) => ReactNode> = {
  Hero, HeroVideo, Text: TextBlock, Image: ImageBlock, ImageGallery,
  Video, VideoGallery, Button, CTA, Products, ProductFeatured, Promotions,
  Properties, PropertyFeatured, Services, Booking, Testimonials, Team, FAQ,
  Contact, WhatsApp, Map, SocialLinks, LeadForm, Footer,
};

/** Ã‚Â¿Este bloque tiene renderer real? */
export function hasRenderer(blockId: string): boolean {
  return Object.prototype.hasOwnProperty.call(BLOCK_RENDERERS, blockId);
}


