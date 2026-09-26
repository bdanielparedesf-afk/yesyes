import type { ReactNode } from 'react';
import { BusinessButton, BusinessCard, BusinessContainer, BusinessHeading, BusinessImage, BusinessSection } from '../components';
import { ContactSection, LocationSection } from '../components/BusinessSections';
import { BusinessVideo } from './BusinessVideo';
import { resolveMediaReference } from './media-ref';
import { buildWaLink } from '@/services/business';
import { categoryLabel, ctaLabel as industryCta, resolveBusinessCta, resolveCtaHref } from '../businessLabels';

/**
 * YESYES BUSINESS Ã‚· TEMPLATE ENGINE V2 Ã¢â‚¬â€ Bloques (Fase 3).
 *
 * Estos componentes son la IMPLEMENTACIÃ“N de cada id del BlockRegistry.
 * El renderer único (`BusinessPageRenderer`) los compone; no existe un
 * segundo renderer.
 *
 * Cada bloque:
 *  - recibe la config resuelta del manifest + los datos del negocio;
 *  - devuelve `null` si no hay contenido (nunca un placeholder vacío);
 *  - declara el comportamiento responsive que el layout le asignó.
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
  /** Ancla de sección: la navegación apunta acá. */
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

/**
 * FASE 6 — Resuelve un campo `media-ref` a una URL usable por el `<img>`/`<video>`.
 *
 * El manifest guarda `media:<id>`, asi que NUNCA hay que pasar el valor crudo a
 * un `src`: se veria un "media:abc" roto en la pagina. Se resuelve contra la
 * lista real de medios y, si no hay, se cae al respaldo del bloque.
 *
 * La URL plana legacy se respeta a proposito: hay borradores y manifests
 * antiguos que la guardan, y romperlos seria peor que soportarlos.
 */
const mediaUrl = (
  config: Record<string, any>,
  key: string,
  media: BlockContext['media'] | undefined,
  kind: 'image' | 'video',
  fallback = '',
): string => {
  const resolved = resolveMediaReference(config?.[key], media, { kind });
  if (resolved) return resolved.url;
  const raw = text(config, key);
  return /^https?:\/\//i.test(raw) ? raw : fallback;
};

/**
 * FASE A — LA VARIANTE ES REAL O NO EXISTE.
 *
 * El `VariantRegistry` (backend) escribe el override de la variante en
 * `config.presentation`. Este helper es el ÚNICO punto por donde un renderer
 * puede conocer la variante elegida, y obliga a que cada bloque la CONSUMA de
 * verdad: si una variante no cambia la composición, no se renderiza distinto.
 *
 * Se acepta `presentation` (contrato oficial del VariantRegistry) y, por
 * compatibilidad con manifests ya guardados, tambien `layout` (que usaba el
 * renderer antes de esta fase). `variant` se acepta como alias de solo lectura.
 *
 * La lista `allowed` es la declaracion de lo que el bloque compone de
 * verdad: una variante fuera de la lista cae al valor por defecto en vez de
 * fingir un diseño.
 */
const presentationOf = (
  config: Record<string, any>,
  allowed: readonly string[],
  fallback: string,
): string => {
  const raw = config?.presentation ?? config?.variant ?? config?.layout;
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return allowed.includes(value) ? value : fallback;
};

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const price = (value: unknown): string => CLP.format(Number(value || 0));

/**
 * Clases Tailwind ESTÁTICAS por opción. Nunca se interpolan nombres de clase
 * construidos en runtime: Tailwind no los detecta al purgar y el diseño se
 * rompería en producción.
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

const HERO_PRESENTATIONS = ['split', 'fullscreen', 'centered', 'editorial', 'cinematic'] as const;

/** Elementos de texto compartidos por las variantes del Hero. */
function HeroCopy({ headline, subheadline, ctaLabel, ctaHref, eyebrow }: {
  headline: string; subheadline: string; ctaLabel: string; ctaHref: string; eyebrow: string;
}) {
  return (
    <>
      {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[.24em] opacity-70">{eyebrow}</p>}
      <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">{headline}</h1>
      {subheadline && <p className="mt-4 max-w-xl text-lg opacity-80">{subheadline}</p>}
      {ctaHref && <BusinessButton href={ctaHref} className="mt-7">{ctaLabel}</BusinessButton>}
    </>
  );
}

/** Portada con imagen y llamada a la acción. FASE A: 5 variantes reales. */
function Hero({ business, config, anchor, media }: BlockProps) {
  const headline = text(config, 'headline', business?.name || '');
  const subheadline = text(config, 'subheadline', business?.description || '');
  const cover = mediaUrl(config, 'image', media, 'image', business?.cover || '');
  // El texto del botón sale de la fuente ÃšNICA de CTA: lo que el usuario
  // configuró gana siempre. Antes se hardcodeaba por rubro.
  const ctaLabel = resolveBusinessCta(business, { blockLabel: config?.ctaLabel, fallback: industryCta(business?.category) });
  const ctaHref = resolveCtaHref(business, config?.action);
  const eyebrow = business?.category ? categoryLabel(business.category) : '';
  if (!headline) return null;
  const presentation = presentationOf(config, HERO_PRESENTATIONS, 'split');
  const copy = { headline, subheadline, ctaLabel, ctaHref, eyebrow };
  const Cta = ctaHref ? <BusinessButton href={ctaHref} className="mt-7">{ctaLabel}</BusinessButton> : null;

  // `split`: texto a un lado, imagen al otro. Dos columnas; sin imagen el
  // texto ocupa el ancho completo.
  if (presentation === 'split') {
    return (
      <BusinessSection id={anchor} className="bg-neutral-900 text-white">
        <BusinessContainer>
          <div className={cover ? 'grid items-center gap-8 md:grid-cols-2' : 'max-w-2xl'}>
            <div><HeroCopy {...copy} /></div>
            {cover && <BusinessImage src={cover} alt={headline} eager className="aspect-[4/3] w-full rounded-3xl object-cover" />}
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `fullscreen`: la imagen pasa de elemento de grilla a CAPA DE FONDO y el
  // texto se apoya encima, al pie. La altura la define la imagen, no el texto.
  if (presentation === 'fullscreen') {
    return (
      <BusinessSection id={anchor} className="relative min-h-[70vh] bg-neutral-900 text-white">
        {cover && <BusinessImage src={cover} alt={headline} eager className="absolute inset-0 h-full w-full rounded-none object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/30" />
        <BusinessContainer className="relative flex min-h-[70vh] flex-col justify-end py-16">
          {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[.24em] opacity-80">{eyebrow}</p>}
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">{headline}</h1>
          {subheadline && <p className="mt-4 max-w-xl text-lg opacity-85">{subheadline}</p>}
          {Cta}
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `centered`: sin imagen lateral, todo centrado sobre fondo claro y titulo
  // de escala contenida. Se diferencia de `split` en composicion y jerarquia.
  if (presentation === 'centered') {
    return (
      <BusinessSection id={anchor} className="bg-white text-stone-900">
        <BusinessContainer>
          <div className="mx-auto max-w-3xl text-center">
            {eyebrow && <p className="mb-3 text-xs font-bold uppercase tracking-[.24em] opacity-60">{eyebrow}</p>}
            <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">{headline}</h1>
            {subheadline && <p className="mx-auto mt-4 max-w-xl text-lg opacity-75">{subheadline}</p>}
            {cover && <BusinessImage src={cover} alt={headline} eager className="mx-auto mt-8 aspect-[16/9] w-full rounded-3xl object-cover" />}
            {ctaHref && <div className="mt-7 flex justify-center"><BusinessButton href={ctaHref}>{ctaLabel}</BusinessButton></div>}
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `editorial`: titular a sangre con interlínea compacta y cuerpo en columna
  // angosta con capitular; la imagen se vuelve una franja vertical al costado.
  if (presentation === 'editorial') {
    return (
      <BusinessSection id={anchor} className="border-b bg-stone-50 text-stone-900">
        <BusinessContainer>
          <div className="grid gap-8 py-6 md:grid-cols-12">
            <div className="md:col-span-8">
              {eyebrow && <p className="mb-3 text-xs font-bold uppercase tracking-[.24em] opacity-55">{eyebrow}</p>}
              <h1 className="text-5xl font-black leading-[.95] tracking-tight sm:text-7xl">{headline}</h1>
              {subheadline && <p className="mt-6 max-w-md text-lg leading-relaxed opacity-75 first-letter:float-left first-letter:mr-2 first-letter:text-5xl first-letter:font-black first-letter:leading-none">{subheadline}</p>}
              {ctaHref && <BusinessButton href={ctaHref} className="mt-8">{ctaLabel}</BusinessButton>}
            </div>
            {cover && <div className="md:col-span-4"><BusinessImage src={cover} alt={headline} eager className="aspect-[3/4] w-full rounded-2xl object-cover" /></div>}
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `cinematic`: velo oscuro permanente y titular centrado con tracking amplio.
  // A diferencia de `fullscreen` NO usa degradado: el alto lo define el texto y
  // la imagen queda atenuada al fondo.
  if (presentation === 'cinematic') {
    return (
      <BusinessSection id={anchor} className="relative bg-neutral-950 text-white">
        {cover && <BusinessImage src={cover} alt={headline} eager className="absolute inset-0 h-full w-full rounded-none object-cover opacity-45" />}
        <BusinessContainer className="relative py-24 text-center">
          {eyebrow && <p className="mb-4 text-xs font-bold uppercase tracking-[.4em] opacity-70">{eyebrow}</p>}
          <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">{headline}</h1>
          {subheadline && <p className="mx-auto mt-5 max-w-2xl text-lg opacity-80">{subheadline}</p>}
          {ctaHref && <div className="mt-8 flex justify-center"><BusinessButton href={ctaHref}>{ctaLabel}</BusinessButton></div>}
        </BusinessContainer>
      </BusinessSection>
    );
  }

  return null;
}

const HERO_VIDEO_PRESENTATIONS = ['cinematic', 'fullscreen', 'split'] as const;

/** Portada con video de fondo, poster obligatorio y fallback en mobile. FASE A: 3 variantes. */
function HeroVideo({ business, config, anchor, media, mobile }: BlockProps) {
  const headline = text(config, 'headline', business?.name || '');
  if (!headline) return null;
  // Id estable primero. Si el bloque no declara video, se toma el primero del
  // negocio: es lo que necesitan los manifests legacy, que no traen
  // `config.video`. Con medio configurado, la referencia manda siempre.
  const video = resolveMediaReference(config?.video, media, { kind: 'video' })
    || (media || []).find((item) => String(item.kind).toLowerCase() === 'video')
    || null;
  const posterMedia = resolveMediaReference(config?.poster, media, { kind: 'image' });
  const poster = posterMedia?.url || video?.posterUrl || business?.cover || '';
  const subheadline = text(config, 'subheadline');
  const ctaLabel = resolveBusinessCta(business, { blockLabel: config?.ctaLabel, fallback: industryCta(business?.category) });
  const ctaHref = resolveCtaHref(business, config?.action);
  const presentation = presentationOf(config, HERO_VIDEO_PRESENTATIONS, 'cinematic');

  const Player = ({ className = '' }: { className?: string }) => (
    <BusinessVideo
      src={video?.url}
      poster={poster}
      alt={headline}
      autoplay={flag(config, 'autoplay', true)}
      muted={flag(config, 'muted', true)}
      loop={flag(config, 'loop', true)}
      controls={flag(config, 'controls', false)}
      posterOnlyOnMobile={mobile === 'focus-media'}
      className={className}
    />
  );

  // `split`: el video ocupa media pagina y el texto la otra media. Es la unica
  // variante donde el video NO es de fondo: convive con el texto.
  if (presentation === 'split') {
    return (
      <BusinessSection id={anchor} className="bg-neutral-950 text-white">
        <BusinessContainer>
          <div className="grid items-center gap-8 py-10 md:grid-cols-2">
            <div>
              <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{headline}</h1>
              {subheadline && <p className="mt-3 opacity-80">{subheadline}</p>}
              {ctaHref && <BusinessButton href={ctaHref} className="mt-6">{ctaLabel}</BusinessButton>}
            </div>
            <div className="overflow-hidden rounded-3xl">
              <Player className="aspect-video w-full" />
            </div>
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `fullscreen`: el video define la altura de la seccion y el texto va al pie.
  if (presentation === 'fullscreen') {
    return (
      <BusinessSection id={anchor} className="relative min-h-[80vh] bg-neutral-950 text-white">
        <div className="absolute inset-0">
          <Player className="h-full w-full" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        <BusinessContainer className="relative flex min-h-[80vh] flex-col justify-end py-16">
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight drop-shadow sm:text-6xl">{headline}</h1>
          {subheadline && <p className="mt-4 max-w-xl text-lg opacity-85">{subheadline}</p>}
          {ctaHref && <BusinessButton href={ctaHref} className="mt-7">{ctaLabel}</BusinessButton>}
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `cinematic`: el texto se apoya sobre el video con sombra, y la altura la
  // marca el contenido, no el video.
  return (
    <BusinessSection id={anchor} className="relative bg-neutral-950 text-white">
      <div className="absolute inset-0">
        <Player className="h-full w-full" />
      </div>
      <BusinessContainer className="relative py-20">
        <h1 className="max-w-2xl text-4xl font-extrabold leading-tight drop-shadow sm:text-5xl">{headline}</h1>
        {subheadline && <p className="mt-4 max-w-xl text-lg opacity-85">{subheadline}</p>}
        {ctaHref && <BusinessButton href={ctaHref} className="mt-7">{ctaLabel}</BusinessButton>}
      </BusinessContainer>
    </BusinessSection>
  );
}

/** Texto libre: historia, política, información. */
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

/** Una imagen a tamaño completo. */
function ImageBlock({ business, config, anchor, media }: BlockProps) {
  const src = mediaUrl(config, 'image', media, 'image', business?.cover || '');
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

const GALLERY_PRESENTATIONS = ['grid', 'masonry', 'editorial', 'fullscreen', 'carousel'] as const;

/** Galería de imágenes del trabajo o del local. FASE A: 5 variantes reales. */
function ImageGallery({ business, gallery, config, anchor }: BlockProps) {
  if (!gallery?.length) return null;
  const title = text(config, 'title');
  const presentation = presentationOf(config, GALLERY_PRESENTATIONS, 'grid');
  const columns = text(config, 'columns', '3');
  const alt = (item: any) => item.alt || `Trabajo de ${business?.name || ''}`;
  const Heading = () => (title ? <BusinessHeading title={title} /> : null);

  // `grid`: grilla uniforme, todas las imagenes con la misma proporcion.
  if (presentation === 'grid') {
    return (
      <BusinessSection id={anchor} className="bg-stone-50">
        <BusinessContainer>
          <Heading />
          <div className={`grid grid-cols-2 gap-3 ${GALLERY_COLUMNS[columns] || GALLERY_COLUMNS['3']}`}>
            {gallery.map((item: any, index: number) => (
              <BusinessImage key={item.id || index} src={item.url} alt={alt(item)} className="aspect-[4/3] w-full rounded-2xl object-cover" />
            ))}
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `masonry`: columnas CSS cuya altura la define la propia imagen, de modo que
  // no se recortan ni se deforman. Es la diferencia real frente a `grid`.
  if (presentation === 'masonry') {
    return (
      <BusinessSection id={anchor} className="bg-stone-50">
        <BusinessContainer>
          <Heading />
          <div className="columns-2 gap-3 md:columns-3 [&>*]:mb-3">
            {gallery.map((item: any, index: number) => (
              <BusinessImage key={item.id || index} src={item.url} alt={alt(item)} className="w-full rounded-2xl object-cover" />
            ))}
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `editorial`: la imagen principal a sangre y el resto en tira pequena bajo
  // el titulo. Jerarquia de lectura opuesta a `grid`.
  if (presentation === 'editorial') {
    const [lead, ...rest] = gallery;
    return (
      <BusinessSection id={anchor}>
        <BusinessContainer>
          {title && <h2 className="mb-6 text-3xl font-bold leading-tight sm:text-4xl">{title}</h2>}
          <BusinessImage src={lead?.url} alt={alt(lead)} eager className="aspect-[21/9] w-full rounded-3xl object-cover" />
          {rest.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-3 md:grid-cols-6">
              {rest.map((item: any, index: number) => (
                <BusinessImage key={item.id || index} src={item.url} alt={alt(item)} className="aspect-square w-full rounded-xl object-cover" />
              ))}
            </div>
          )}
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `fullscreen`: cada imagen ocupa la pantalla completa, una tras otra.
  if (presentation === 'fullscreen') {
    return (
      <BusinessSection id={anchor} className="bg-black">
        {title && <BusinessContainer><h2 className="py-10 text-3xl font-bold text-white sm:text-4xl">{title}</h2></BusinessContainer>}
        {gallery.map((item: any, index: number) => (
          <BusinessImage key={item.id || index} src={item.url} alt={alt(item)} eager={index === 0} className="h-[85vh] w-full object-cover" />
        ))}
      </BusinessSection>
    );
  }

  // `carousel`: tira horizontal desplazable con scroll-snap. Cada imagen
  // mantiene su proporcion y no se deforma al redimensionar la ventana.
  if (presentation === 'carousel') {
    return (
      <BusinessSection id={anchor} className="overflow-hidden bg-stone-50">
        <BusinessContainer><Heading /></BusinessContainer>
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:px-6">
          {gallery.map((item: any, index: number) => (
            <div key={item.id || index} className="w-[85vw] shrink-0 snap-center sm:w-[60vw] lg:w-[45vw]">
              <BusinessImage src={item.url} alt={alt(item)} eager={index === 0} className="aspect-[4/3] w-full rounded-3xl object-cover" />
            </div>
          ))}
        </div>
      </BusinessSection>
    );
  }

  return null;
}

const VIDEO_PRESENTATIONS = ['fullscreen', 'split', 'gallery'] as const;

/** Video en línea con poster y controles opcionales. FASE A: 3 variantes reales. */
function Video({ business, config, anchor, media, mobile }: BlockProps) {
  const videos = (media || []).filter((item) => String(item.kind).toLowerCase() === 'video');
  // Por id estable primero; la URL plana legacy queda como respaldo.
  const video = resolveMediaReference(config?.video, media, { kind: 'video' }) || videos[0];
  if (!video) return null;
  const title = text(config, 'title');
  const body = text(config, 'body');
  const posterMedia = resolveMediaReference(config?.poster, media, { kind: 'image' });
  const poster = posterMedia?.url || video.posterUrl || business?.cover || '';
  const alt = video.title || video.alt || `Video de ${business?.name || 'el negocio'}`;
  const presentation = presentationOf(config, VIDEO_PRESENTATIONS, 'fullscreen');

  // `fullscreen`: el video ocupa el ancho completo y el texto queda encima o
  // debajo segun haya titulo. Es la variante de mayor impacto.
  if (presentation === 'fullscreen') {
    return (
      <BusinessSection id={anchor} className="p-0">
        {title && <BusinessContainer><h2 className="py-8 text-3xl font-extrabold sm:text-4xl">{title}</h2></BusinessContainer>}
        <BusinessVideo
          src={video.url}
          poster={poster}
          alt={alt}
          autoplay={flag(config, 'autoplay', false)}
          controls={flag(config, 'controls', true)}
          className="aspect-video w-full"
          posterOnlyOnMobile={mobile === 'focus-media'}
        />
        {body && <BusinessContainer><p className="py-6 opacity-75">{body}</p></BusinessContainer>}
      </BusinessSection>
    );
  }

  // `split`: el video a un lado y el texto al otro, como una entrevista.
  if (presentation === 'split') {
    return (
      <BusinessSection id={anchor} className="bg-stone-50">
        <BusinessContainer>
          <div className="grid items-center gap-6 md:grid-cols-2">
            <div>
              {title && <h2 className="text-2xl font-extrabold leading-tight sm:text-3xl">{title}</h2>}
              {body && <p className="mt-3 opacity-75">{body}</p>}
            </div>
            <div className="overflow-hidden rounded-3xl">
              <BusinessVideo
                src={video.url}
                poster={poster}
                alt={alt}
                autoplay={flag(config, 'autoplay', false)}
                controls={flag(config, 'controls', true)}
                className="aspect-video w-full"
                posterOnlyOnMobile={mobile === 'focus-media'}
              />
            </div>
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `gallery`: el video principal y, si hay mas, el resto en tira lateral.
  if (presentation === 'gallery') {
    const [lead, ...rest] = videos;
    return (
      <BusinessSection id={anchor}>
        <BusinessContainer>
          {title && <BusinessHeading title={title} text={body} />}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="overflow-hidden rounded-3xl">
                <BusinessVideo
                  src={lead.url}
                  poster={lead.posterUrl || poster}
                  alt={lead.title || lead.alt || alt}
                  autoplay={flag(config, 'autoplay', false)}
                  controls={flag(config, 'controls', true)}
                  className="aspect-video w-full"
                  posterOnlyOnMobile={mobile === 'focus-media'}
                />
              </div>
            </div>
            {rest.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
                {rest.map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-2xl">
                    <BusinessVideo
                      src={item.url}
                      poster={item.posterUrl || poster}
                      alt={item.title || item.alt || alt}
                      controls
                      className="aspect-video w-full"
                      posterOnlyOnMobile={mobile === 'focus-media'}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  return null;
}

/** Galería de videos. Sin medios de video cae a la galería de imágenes. */
function VideoGallery(props: BlockProps) {
  const { business, gallery, config, anchor, media, mobile } = props;
  const videos = (media || []).filter((item) => String(item.kind).toLowerCase() === 'video');
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

/** Botón de acción directa. Solo apunta a destinos reales. */
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

/** Llamado a la acción con una acción principal. */
const CTA_PRESENTATIONS = ['banner', 'split', 'fullscreen', 'minimal', 'editorial'] as const;

/** Llamado a la acción con una acción principal. FASE A: 5 variantes reales. */
function CTA({ business, config, anchor, media }: BlockProps) {
  const action = text(config, 'action', 'whatsapp');
  // El texto por defecto va en UTF-8 real: el valor anterior estava corrupto y
  // se veia como ¿Te gustaría... en la pagina publicada.
  const title = text(config, 'title', '¿Te gustaría resolverlo hoy?');
  const body = text(config, 'body');
  // Misma fuente ÃšNICA que el Hero: el CTA configurado por el usuario gana.
  const label = resolveBusinessCta(business, { blockLabel: config?.label, fallback: industryCta(business?.category) });
  const href = resolveCtaHref(business, action);
  if (!href) return null;
  // El fallback DEBE coincidir con `defaultVariant` del VariantRegistry: si
  // divergen, una variante desconocida se veria distinta a la que el editor
  // muestra como seleccionada.
  const presentation = presentationOf(config, CTA_PRESENTATIONS, 'fullscreen');

  // `banner`: franja centrada sobre fondo claro, la variante por defecto.
  if (presentation === 'banner') {
    return (
      <BusinessSection id={anchor} className="bg-neutral-100">
        <BusinessContainer>
          <BusinessHeading title={title} text={body} align="center" />
          <div className="flex justify-center"><BusinessButton href={href}>{label}</BusinessButton></div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `split`: el texto ocupa la mitad y el boton se alinea al otro lado. Si hay
  // imagen de portada, funciona como apoyo visual del bloque.
  if (presentation === 'split') {
    const cover = mediaUrl(config, 'image', media, 'image', business?.cover || '');
    return (
      <BusinessSection id={anchor} className="border-y">
        <BusinessContainer>
          <div className="grid items-center gap-6 py-8 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-extrabold leading-tight sm:text-3xl">{title}</h2>
              {body && <p className="mt-3 opacity-75">{body}</p>}
            </div>
            <div className="md:text-right">
              <BusinessButton href={href} className={cover ? '' : 'md:float-right'}>{label}</BusinessButton>
              {cover && <BusinessImage src={cover} alt="" className="mt-4 aspect-[16/9] w-full rounded-2xl object-cover md:mt-0" />}
            </div>
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `fullscreen`: banda oscura a todo el ancho con titular grande y el boton
  // como unico acento de color sobre la superficie.
  if (presentation === 'fullscreen') {
    return (
      <BusinessSection id={anchor} className="bg-neutral-950 text-white">
        <BusinessContainer>
          <div className="py-10 text-center">
            <h2 className="mx-auto max-w-3xl text-3xl font-black leading-tight sm:text-5xl">{title}</h2>
            {body && <p className="mx-auto mt-4 max-w-xl opacity-75">{body}</p>}
            <div className="mt-8 flex justify-center"><BusinessButton href={href}>{label}</BusinessButton></div>
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `minimal`: una sola linea con el boton al costado, sin fondo de color, para
  // no cortar el ritmo de la pagina.
  if (presentation === 'minimal') {
    return (
      <BusinessSection id={anchor} className="py-10">
        <BusinessContainer>
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-lg font-bold">{title}</p>
              {body && <p className="text-sm opacity-70">{body}</p>}
            </div>
            <BusinessButton href={href} variant="secondary">{label}</BusinessButton>
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `editorial`: titular protagonista a la izquierda y cuerpo a la derecha, con
  // el boton al pie del cuerpo.
  if (presentation === 'editorial') {
    return (
      <BusinessSection id={anchor} className="border-t bg-stone-50">
        <BusinessContainer>
          <div className="grid gap-6 py-12 md:grid-cols-12 md:items-end">
            <h2 className="text-4xl font-black leading-[.95] tracking-tight md:col-span-7 sm:text-6xl">{title}</h2>
            <div className="md:col-span-5">
              {body && <p className="opacity-75">{body}</p>}
              <BusinessButton href={href} className="mt-5">{label}</BusinessButton>
            </div>
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  return null;
}

const PRODUCTS_PRESENTATIONS = ['grid', 'editorial', 'magazine', 'commerce', 'featured'] as const;

/** Catalogo del negocio. FASE A: 5 variantes reales. */
function Products({ products, config, anchor }: BlockProps) {
  if (!products.length) return null;
  const limit = number(config, 'limit', 8);
  const showPrices = flag(config, 'showPrices', true);
  const title = text(config, 'title', 'Nuestros productos');
  const presentation = presentationOf(config, PRODUCTS_PRESENTATIONS, 'grid');
  const items = products.slice(0, limit);
  // `layout` queda como override fino de columnas dentro de `grid`.
  const layout = text(config, 'layout', 'grid');

  // `grid`: catalogo uniforme, denso y escaneable.
  if (presentation === 'grid') {
    return (
      <BusinessSection id={anchor}>
        <BusinessContainer>
          <BusinessHeading title={title} />
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

  // `editorial`: el catalogo como revista: el primer producto abre la seccion y
  // el resto se lee como fichas continuas con precio en columna propia.
  if (presentation === 'editorial') {
    const [lead, ...rest] = items;
    return (
      <BusinessSection id={anchor} className="bg-stone-50">
        <BusinessContainer>
          <BusinessHeading title={title} />
          {lead && (
            <div className="mb-10 grid gap-6 border-b pb-10 md:grid-cols-2">
              {lead.image && <BusinessImage src={lead.image} alt={lead.name} className="aspect-[4/3] w-full rounded-2xl object-cover" />}
              <div className="flex flex-col justify-center">
                <p className="text-xs font-bold uppercase tracking-[.24em] opacity-55">Destacado</p>
                <h3 className="mt-2 text-3xl font-black leading-tight">{lead.name}</h3>
                {(lead.shortDescription || lead.description) && <p className="mt-3 opacity-75">{lead.shortDescription || lead.description}</p>}
                {showPrices && <p className="mt-4 text-2xl font-extrabold">{price(lead.price)}</p>}
              </div>
            </div>
          )}
          <div className="divide-y">
            {rest.map((item: any) => (
              <div key={item.id} className="grid items-center gap-4 py-5 md:grid-cols-12">
                {item.image && <div className="md:col-span-2"><BusinessImage src={item.image} alt={item.name} className="aspect-square w-full rounded-xl object-cover" /></div>}
                <div className="md:col-span-7">
                  <p className="text-lg font-bold">{item.name}</p>
                  {item.shortDescription && <p className="mt-1 text-sm opacity-70">{item.shortDescription}</p>}
                </div>
                {showPrices && <p className="font-extrabold md:col-span-3 md:text-right">{price(item.price)}</p>}
              </div>
            ))}
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `magazine`: mosaico asimetrico al estilo portada de revista. El primer
  // producto ocupa media grilla y el resto alterna proporción.
  if (presentation === 'magazine') {
    return (
      <BusinessSection id={anchor}>
        <BusinessContainer>
          <BusinessHeading title={title} align="left" />
          <div className="grid auto-rows-[150px] grid-cols-2 gap-3 md:grid-cols-4">
            {items.map((item: any, index: number) => {
              const span = index === 0 ? 'col-span-2 row-span-3' : 'col-span-2 row-span-2';
              return (
                <div key={item.id} className={`relative overflow-hidden rounded-2xl bg-neutral-900 ${span}`}>
                  {item.image && <BusinessImage src={item.image} alt={item.name} className="h-full w-full object-cover opacity-80" />}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 text-white">
                    <p className="font-bold leading-tight">{item.name}</p>
                    {showPrices && <p className="mt-0.5 text-sm opacity-85">{price(item.price)}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `commerce`: catalogo orientado a comprar: precio destacado y estado de
  // disponibilidad por producto.
  if (presentation === 'commerce') {
    return (
      <BusinessSection id={anchor} className="bg-stone-50">
        <BusinessContainer>
          <BusinessHeading title={title} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item: any) => (
              <div key={item.id} className="flex flex-col overflow-hidden rounded-2xl border bg-white">
                {item.image && <BusinessImage src={item.image} alt={item.name} className="aspect-[4/3] w-full object-cover" />}
                <div className="flex flex-1 flex-col p-5">
                  <p className="font-bold leading-snug">{item.name}</p>
                  {item.shortDescription && <p className="mt-1 flex-1 text-sm opacity-70">{item.shortDescription}</p>}
                  <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
                    {showPrices ? <p className="text-xl font-extrabold">{price(item.price)}</p> : <span />}
                    {item.active === false && <span className="text-xs font-bold uppercase opacity-50">No disponible</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `featured`: un producto protagonista a sangre y el resto en tira horizontal
  // desplazable, para catalogs largos.
  if (presentation === 'featured') {
    const [lead, ...rest] = items;
    return (
      <BusinessSection id={anchor}>
        <BusinessContainer>
          <BusinessHeading title={title} />
          {lead && (
            <div className="mb-8 grid gap-6 rounded-3xl bg-neutral-900 p-6 text-white md:grid-cols-2 md:items-center">
              {lead.image && <BusinessImage src={lead.image} alt={lead.name} className="aspect-[4/3] w-full rounded-2xl object-cover" />}
              <div>
                <p className="text-xs font-bold uppercase tracking-[.24em] opacity-70">Producto destacado</p>
                <h3 className="mt-1 text-3xl font-extrabold leading-tight">{lead.name}</h3>
                {(lead.shortDescription || lead.description) && <p className="mt-2 opacity-80">{lead.shortDescription || lead.description}</p>}
                {showPrices && <p className="mt-4 text-2xl font-extrabold">{price(lead.price)}</p>}
              </div>
            </div>
          )}
          {rest.length > 0 && (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {rest.map((item: any) => (
                <div key={item.id} className="w-48 shrink-0">
                  {item.image && <BusinessImage src={item.image} alt={item.name} className="aspect-square w-full rounded-2xl object-cover" />}
                  <p className="mt-2 text-sm font-semibold leading-snug">{item.name}</p>
                  {showPrices && <p className="mt-0.5 text-sm font-bold">{price(item.price)}</p>}
                </div>
              ))}
            </div>
          )}
        </BusinessContainer>
      </BusinessSection>
    );
  }

  return null;
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

const PROMOTIONS_PRESENTATIONS = ['cards', 'banner', 'featured'] as const;

/** Promociones vigentes. FASE A: 3 variantes reales. */
function Promotions({ promotions, config, anchor }: BlockProps) {
  if (!promotions.length) return null;
  const limit = number(config, 'limit', 6);
  const title = text(config, 'title', 'Promociones');
  const presentation = presentationOf(config, PROMOTIONS_PRESENTATIONS, 'cards');
  const items = promotions.slice(0, limit);

  // `banner`: las promociones como una franja continua de texto, sin cajas.
  if (presentation === 'banner') {
    return (
      <BusinessSection id={anchor} className="bg-amber-50">
        <BusinessContainer>
          <h2 className="text-2xl font-extrabold sm:text-3xl">{title}</h2>
          <ul className="mt-6 divide-y border-y border-amber-900/15">
            {items.map((item: any) => (
              <li key={item.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div>
                  <p className="font-bold">{item.title}</p>
                  {item.description && <p className="mt-1 text-sm opacity-75">{item.description}</p>}
                </div>
                {item.discount && <p className="shrink-0 text-xl font-extrabold">{item.discount}</p>}
              </li>
            ))}
          </ul>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `featured`: la primera promo a doble ancho y el resto en tira.
  if (presentation === 'featured') {
    const [lead, ...rest] = items;
    return (
      <BusinessSection id={anchor} className="bg-amber-50">
        <BusinessContainer>
          <BusinessHeading title={title} />
          {lead && (
            <div className="mb-6 flex flex-col items-start justify-between gap-4 rounded-3xl bg-neutral-900 p-8 text-white md:flex-row md:items-center">
              <div>
                <p className="text-2xl font-extrabold">{lead.title}</p>
                {lead.description && <p className="mt-2 opacity-80">{lead.description}</p>}
              </div>
              {lead.discount && <p className="shrink-0 text-3xl font-black">{lead.discount}</p>}
            </div>
          )}
          {rest.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((item: any) => (
                <BusinessCard key={item.id}>
                  <p className="font-bold">{item.title}</p>
                  {item.description && <p className="mt-2 text-sm opacity-75">{item.description}</p>}
                  {item.discount && <p className="mt-3 text-lg font-extrabold">{item.discount}</p>}
                </BusinessCard>
              ))}
            </div>
          )}
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `cards`: grilla de tarjetas, la variante por defecto.
  return (
    <BusinessSection id={anchor} className="bg-amber-50">
      <BusinessContainer>
        <BusinessHeading title={title} />
        <div className="grid gap-4 md:grid-cols-3">
          {items.map((item: any) => (
            <BusinessCard key={item.id}>
              <p className="font-bold">{item.title}</p>
              {item.description && <p className="mt-2 text-sm opacity-75">{item.description}</p>}
              {item.discount && <p className="mt-3 text-lg font-extrabold">{item.discount}</p>}
            </BusinessCard>
          ))}
        </div>
      </BusinessContainer>
    </BusinessSection>
  );
}

const PROPERTIES_PRESENTATIONS = ['grid', 'featured', 'editorial'] as const;

/** Listado de propiedades. FASE A: 3 variantes reales. */
function Properties({ properties, config, anchor }: BlockProps) {
  if (!properties.length) return null;
  const limit = number(config, 'limit', 6);
  const title = text(config, 'title', 'Propiedades');
  const presentation = presentationOf(config, PROPERTIES_PRESENTATIONS, 'grid');
  const items = properties.slice(0, limit);
  const coverOf = (item: any) => item.images?.[0]?.url;

  // `featured`: la primera propiedad a doble ancho con ficha completa; el resto
  // en grilla. Es la variante que prioriza la unidad destacada.
  if (presentation === 'featured') {
    const [lead, ...rest] = items;
    return (
      <BusinessSection id={anchor}>
        <BusinessContainer>
          <BusinessHeading title={title} />
          {lead && (
            <div className="mb-8 grid gap-6 rounded-3xl border bg-white p-6 md:grid-cols-2">
              {coverOf(lead) && <BusinessImage src={coverOf(lead)} alt={lead.title} className="aspect-[4/3] w-full rounded-2xl object-cover" />}
              <div>
                <p className="text-xs uppercase opacity-60">{lead.operation} &middot; {lead.type}</p>
                <h3 className="mt-1 text-2xl font-extrabold">{lead.title}</h3>
                <p className="mt-1 text-sm opacity-70">{[lead.city, lead.address].filter(Boolean).join(', ')}</p>
                <p className="mt-3 text-2xl font-extrabold">{price(lead.price)}</p>
                <ul className="mt-3 flex flex-wrap gap-3 text-sm opacity-75">
                  {lead.bedrooms != null && <li>{lead.bedrooms} dormitorios</li>}
                  {lead.bathrooms != null && <li>{lead.bathrooms} baños</li>}
                  {lead.areaTotal != null && <li>{lead.areaTotal} m²</li>}
                </ul>
              </div>
            </div>
          )}
          {rest.length > 0 && (
            <div className="grid gap-4 md:grid-cols-3">
              {rest.map((item: any) => (
                <BusinessCard key={item.id} className="overflow-hidden p-0">
                  {coverOf(item) && <BusinessImage src={coverOf(item)} alt={item.title} className="aspect-[4/3] w-full object-cover" />}
                  <div className="p-4">
                    <p className="text-xs uppercase opacity-60">{item.operation} &middot; {item.type}</p>
                    <p className="mt-1 font-semibold">{item.title}</p>
                    <p className="mt-1 font-bold">{price(item.price)}</p>
                  </div>
                </BusinessCard>
              ))}
            </div>
          )}
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `editorial`: fichas horizontales con caracteristicas en linea: se lee como
  // un listado, no como un catalogo de tarjetas.
  if (presentation === 'editorial') {
    return (
      <BusinessSection id={anchor} className="bg-stone-50">
        <BusinessContainer>
          <BusinessHeading title={title} />
          <div className="divide-y">
            {items.map((item: any) => (
              <div key={item.id} className="grid items-center gap-4 py-5 md:grid-cols-12">
                {coverOf(item) && <div className="md:col-span-3"><BusinessImage src={coverOf(item)} alt={item.title} className="aspect-[4/3] w-full rounded-xl object-cover" /></div>}
                <div className="md:col-span-6">
                  <p className="text-xs uppercase opacity-60">{item.operation} &middot; {item.type}</p>
                  <p className="mt-1 text-lg font-bold">{item.title}</p>
                  <p className="mt-0.5 text-sm opacity-70">{[item.city, item.address].filter(Boolean).join(', ')}</p>
                </div>
                <div className="md:col-span-3 md:text-right">
                  <p className="text-xl font-extrabold">{price(item.price)}</p>
                  <ul className="mt-1 flex flex-wrap gap-2 text-xs opacity-70 md:justify-end">
                    {item.bedrooms != null && <li>{item.bedrooms} dorm.</li>}
                    {item.bathrooms != null && <li>{item.bathrooms} baños</li>}
                    {item.areaTotal != null && <li>{item.areaTotal} m²</li>}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `grid`: catalogo uniforme de tarjetas, la variante por defecto.
  return (
    <BusinessSection id={anchor}>
      <BusinessContainer>
        <BusinessHeading title={title} />
        <div className="grid gap-4 md:grid-cols-3">
          {items.map((item: any) => (
            <BusinessCard key={item.id} className="overflow-hidden p-0">
              {coverOf(item) && <BusinessImage src={coverOf(item)} alt={item.title} className="aspect-[4/3] w-full object-cover" />}
              <div className="p-4">
                <p className="text-xs uppercase opacity-60">{item.operation} &middot; {item.type}</p>
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
              {item.bathrooms != null && <li>{item.bathrooms} baños</li>}
              {item.areaTotal != null && <li>{item.areaTotal} mÃ‚²</li>}
            </ul>
            {business?.whatsapp && <BusinessButton href={waHref(business, `Hola ${business.name}, quiero información de ${item.title}.`)} className="mt-5">Consultar</BusinessButton>}
          </div>
        </div>
      </BusinessContainer>
    </BusinessSection>
  );
}

const SERVICES_PRESENTATIONS = ['cards', 'editorial', 'split', 'bento', 'featured', 'minimal'] as const;

/** Servicios del negocio, con precios si los tiene. FASE A: 6 variantes reales. */
function Services({ business, services, config, anchor, media }: BlockProps) {
  if (!services.length) return null;
  const limit = number(config, 'limit', 12);
  const showPrices = flag(config, 'showPrices', true);
  const title = text(config, 'title', 'Servicios');
  const presentation = presentationOf(config, SERVICES_PRESENTATIONS, 'cards');
  const items = services.slice(0, limit);
  const priceOf = (item: any) => (showPrices && item.price != null ? <p className="mt-2 font-bold">{price(item.price)}</p> : null);

  // `cards`: grilla uniforme de tarjetas con imagen, nombre, descripcion y precio.
  if (presentation === 'cards') {
    return (
      <BusinessSection id={anchor}>
        <BusinessContainer>
          <BusinessHeading title={title} />
          <div className={`grid gap-4 ${SERVICE_COLUMNS[text(config, 'columns', '3')] || SERVICE_COLUMNS['3']}`}>
            {items.map((item: any) => (
              <BusinessCard key={item.id}>
                {item.image && <BusinessImage src={item.image} alt={item.name} className="mb-3 aspect-[4/3] w-full rounded-xl object-cover" />}
                <p className="font-semibold">{item.name}</p>
                {item.description && <p className="mt-1 text-sm opacity-75">{item.description}</p>}
                {priceOf(item)}
              </BusinessCard>
            ))}
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `editorial`: una linea por servicio, con indice y tipografia protagonista.
  // Sin imagenes ni cajas: es una lista tipografica, no un catalogo.
  if (presentation === 'editorial') {
    return (
      <BusinessSection id={anchor} className="bg-stone-50">
        <BusinessContainer>
          <BusinessHeading title={title} />
          <ol className="divide-y border-y">
            {items.map((item: any, index: number) => (
              <li key={item.id} className="grid items-baseline gap-3 py-5 md:grid-cols-12 md:gap-6">
                <span className="text-xs font-bold opacity-40 md:col-span-1">{String(index + 1).padStart(2, '0')}</span>
                <h3 className="text-2xl font-extrabold leading-tight md:col-span-4">{item.name}</h3>
                <div className="md:col-span-6">
                  {item.description && <p className="opacity-75">{item.description}</p>}
                  {showPrices && item.price != null && <p className="mt-1 font-bold">{price(item.price)}</p>}
                </div>
              </li>
            ))}
          </ol>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `split`: imagen del negocio a un lado y la lista de servicios al frente.
  if (presentation === 'split') {
    const cover = mediaUrl(config, 'image', media, 'image', business?.cover || '');
    return (
      <BusinessSection id={anchor}>
        <BusinessContainer>
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            {cover ? (
              <BusinessImage src={cover} alt={title} className="aspect-[3/4] w-full rounded-3xl object-cover" />
            ) : (
              <div>
                <BusinessHeading title={title} />
              </div>
            )}
            <div>
              {!cover && <h2 className="text-3xl font-extrabold">{title}</h2>}
              <ul className="space-y-4">
                {items.map((item: any) => (
                  <li key={item.id} className="border-b pb-4 last:border-0">
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="font-semibold">{item.name}</p>
                      {showPrices && item.price != null && <p className="font-bold">{price(item.price)}</p>}
                    </div>
                    {item.description && <p className="mt-1 text-sm opacity-75">{item.description}</p>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `bento`: el primer servicio ocupa una celda grande y el resto se acomoda en
  // celdas menores. La jerarquia la marca el TAMAÑO, no el color.
  if (presentation === 'bento') {
    const [lead, ...rest] = items;
    return (
      <BusinessSection id={anchor} className="bg-stone-50">
        <BusinessContainer>
          <BusinessHeading title={title} />
          <div className="grid gap-4 md:grid-cols-3">
            {lead && (
              <div className="overflow-hidden rounded-3xl bg-neutral-900 text-white md:col-span-2">
                {lead.image && <BusinessImage src={lead.image} alt={lead.name} className="aspect-[16/10] w-full object-cover" />}
                <div className="p-6">
                  <p className="text-xs font-bold uppercase tracking-[.2em] opacity-70">Destacado</p>
                  <h3 className="mt-1 text-2xl font-extrabold">{lead.name}</h3>
                  {lead.description && <p className="mt-2 opacity-80">{lead.description}</p>}
                  {showPrices && lead.price != null && <p className="mt-3 text-xl font-bold">{price(lead.price)}</p>}
                </div>
              </div>
            )}
            {rest.map((item: any) => (
              <div key={item.id} className="rounded-3xl border bg-white p-5">
                <h3 className="text-lg font-bold">{item.name}</h3>
                {item.description && <p className="mt-1 text-sm opacity-75">{item.description}</p>}
                {showPrices && item.price != null && <p className="mt-2 font-bold">{price(item.price)}</p>}
              </div>
            ))}
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `featured`: el primero destacado a doble ancho con imagen; el resto en
  // grilla de tarjetas iguales de menor peso visual.
  if (presentation === 'featured') {
    const [lead, ...rest] = items;
    return (
      <BusinessSection id={anchor}>
        <BusinessContainer>
          <BusinessHeading title={title} />
          {lead && (
            <div className="mb-8 grid items-center gap-6 rounded-3xl border bg-white p-6 md:grid-cols-2">
              {lead.image && <BusinessImage src={lead.image} alt={lead.name} className="aspect-[4/3] w-full rounded-2xl object-cover" />}
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] opacity-60">Servicio destacado</p>
                <h3 className="mt-1 text-3xl font-extrabold">{lead.name}</h3>
                {lead.description && <p className="mt-2 opacity-75">{lead.description}</p>}
                {showPrices && lead.price != null && <p className="mt-3 text-xl font-bold">{price(lead.price)}</p>}
              </div>
            </div>
          )}
          {rest.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((item: any) => (
                <BusinessCard key={item.id}>
                  {item.image && <BusinessImage src={item.image} alt={item.name} className="mb-3 aspect-[4/3] w-full rounded-xl object-cover" />}
                  <p className="font-semibold">{item.name}</p>
                  {item.description && <p className="mt-1 text-sm opacity-75">{item.description}</p>}
                  {priceOf(item)}
                </BusinessCard>
              ))}
            </div>
          )}
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `minimal`: solo nombre y precio alineados, sin imagenes ni descripciones.
  // La variante mas sobria del bloque.
  if (presentation === 'minimal') {
    return (
      <BusinessSection id={anchor}>
        <BusinessContainer>
          <BusinessHeading title={title} />
          <ul className="max-w-2xl divide-y border-t">
            {items.map((item: any) => (
              <li key={item.id} className="flex items-baseline justify-between gap-6 py-3">
                <span className="font-medium">{item.name}</span>
                {showPrices && item.price != null && <span className="shrink-0 font-bold">{price(item.price)}</span>}
              </li>
            ))}
          </ul>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  return null;
}

const BOOKING_PRESENTATIONS = ['cards', 'calendar', 'cta'] as const;

/**
 * Agenda. El envio real lo hace el endpoint publico de reservas (POST
 * /:slug/bookings). Si no hay horarios configurados el bloque NO aparece:
 * es preferible no mostrarlo a mostrar un boton que no hace nada.
 * FASE A: 3 variantes reales.
 */
function Booking({ business, bookingSlots, config, anchor }: BlockProps) {
  if (!bookingSlots.length) return null;
  // Los nombres de dia llevan tilde: sin ella la pagina mostraba "Miercoles".
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const title = text(config, 'title', 'Reserva tu hora');
  const body = text(config, 'body');
  const presentation = presentationOf(config, BOOKING_PRESENTATIONS, 'cards');
  const reserveHref = business?.whatsapp ? waHref(business, `Hola ${business.name}, quiero reservar.`) : '';
  const dayOf = (slot: any) => days[slot.weekday] || 'Dia';
  const range = (slot: any) => `${slot.startTime} - ${slot.endTime}`;

  // `calendar`: los horarios agrupados por dia en columnas, como una agenda.
  if (presentation === 'calendar') {
    const byDay = bookingSlots.reduce<Record<string, any[]>>((acc, slot) => {
      const key = dayOf(slot);
      acc[key] = acc[key] || [];
      acc[key].push(slot);
      return acc;
    }, {});
    return (
      <BusinessSection id={anchor} className="bg-neutral-50">
        <BusinessContainer>
          <BusinessHeading title={title} text={body} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(byDay).map(([day, slots]) => (
              <div key={day} className="rounded-2xl border bg-white p-5">
                <p className="font-bold">{day}</p>
                <ul className="mt-3 space-y-1 text-sm">
                  {slots.map((slot: any) => (
                    <li key={slot.id} className="opacity-75">{range(slot)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {reserveHref && <div className="mt-8 flex justify-center"><BusinessButton href={reserveHref}>Reservar ahora</BusinessButton></div>}
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `cta`: sin listado de horarios: solo la llamada a reservar. Es la variante
  // para negocios que coordinan la cita por conversacion.
  if (presentation === 'cta') {
    if (!reserveHref) return null;
    return (
      <BusinessSection id={anchor} className="bg-neutral-950 text-white">
        <BusinessContainer>
          <div className="flex flex-col items-start justify-between gap-5 py-8 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-extrabold sm:text-3xl">{title}</h2>
              {body && <p className="mt-2 opacity-75">{body}</p>}
            </div>
            <BusinessButton href={reserveHref} className="shrink-0">Reservar ahora</BusinessButton>
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `cards`: la disponibilidad en tarjetas, una por dia.
  if (presentation === 'cards') {
    return (
      <BusinessSection id={anchor} className="bg-neutral-50">
        <BusinessContainer>
          <BusinessHeading title={title} text={body} />
          <div className="grid gap-4 sm:grid-cols-2">
            {bookingSlots.map((slot: any) => (
              <div key={slot.id} className="flex items-center justify-between gap-4 rounded-2xl border bg-white p-5">
                <div>
                  <p className="font-bold">{dayOf(slot)}</p>
                  <p className="text-sm opacity-70">{range(slot)}</p>
                </div>
                {reserveHref && <BusinessButton href={reserveHref} variant="secondary">Reservar</BusinessButton>}
              </div>
            ))}
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  return null;
}

const TESTIMONIALS_PRESENTATIONS = ['cards', 'quote', 'editorial', 'slider', 'minimal', 'featured'] as const;

/** Testimonios de clientes. FASE A: 6 variantes reales. */
function Testimonials({ testimonials, config, anchor }: BlockProps) {
  if (!testimonials.length) return null;
  const limit = number(config, 'limit', 6);
  const title = text(config, 'title', 'Lo que dicen');
  const presentation = presentationOf(config, TESTIMONIALS_PRESENTATIONS, 'cards');
  const items = testimonials.slice(0, limit);
  const Quote = ({ children }: { children: any }) => <>{`\u201C${children}\u201D`}</>;
  const Author = ({ name }: { name?: string }) => <p className="mt-3 text-sm font-semibold">{name}</p>;

  // `cards`: grilla de tarjetas iguales, la variante mas neutra.
  if (presentation === 'cards') {
    return (
      <BusinessSection id={anchor} className="bg-stone-50">
        <BusinessContainer>
          <BusinessHeading title={title} />
          <div className="grid gap-4 md:grid-cols-3">
            {items.map((item: any) => (
              <BusinessCard key={item.id}>
                <p className="opacity-80"><Quote>{item.content}</Quote></p>
                <Author name={item.name} />
              </BusinessCard>
            ))}
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `quote`: una cita protagonista a gran escala y el resto en columna menor.
  if (presentation === 'quote') {
    const [lead, ...rest] = items;
    return (
      <BusinessSection id={anchor} className="bg-neutral-900 text-white">
        <BusinessContainer>
          <blockquote className="mx-auto max-w-4xl text-center">
            <p className="text-3xl font-extrabold leading-tight sm:text-5xl"><Quote>{lead?.content}</Quote></p>
            <footer className="mt-6 text-sm font-semibold uppercase tracking-[.24em] opacity-70">{lead?.name}</footer>
          </blockquote>
          {rest.length > 0 && (
            <ul className="mt-12 grid gap-6 border-t border-white/15 pt-8 md:grid-cols-3">
              {rest.map((item: any) => (
                <li key={item.id}>
                  <p className="opacity-80"><Quote>{item.content}</Quote></p>
                  <p className="mt-2 text-sm font-semibold">{item.name}</p>
                </li>
              ))}
            </ul>
          )}
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `editorial`: los testimonios como columna de texto corrida, sin cajas.
  if (presentation === 'editorial') {
    return (
      <BusinessSection id={anchor}>
        <BusinessContainer>
          <BusinessHeading title={title} />
          <div className="max-w-2xl space-y-8">
            {items.map((item: any) => (
              <figure key={item.id} className="border-l-2 pl-5">
                <blockquote className="text-lg leading-relaxed opacity-85"><Quote>{item.content}</Quote></blockquote>
                <figcaption className="mt-2 text-sm font-bold uppercase tracking-wider opacity-60">{item.name}</figcaption>
              </figure>
            ))}
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `slider`: tira horizontal con scroll-snap; cada opinion es una tarjeta.
  if (presentation === 'slider') {
    return (
      <BusinessSection id={anchor} className="overflow-hidden bg-stone-50">
        <BusinessContainer><BusinessHeading title={title} /></BusinessContainer>
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:px-6">
          {items.map((item: any) => (
            <div key={item.id} className="w-[85vw] shrink-0 snap-center sm:w-[420px]">
              <BusinessCard className="h-full">
                <p className="opacity-80"><Quote>{item.content}</Quote></p>
                <Author name={item.name} />
              </BusinessCard>
            </div>
          ))}
        </div>
      </BusinessSection>
    );
  }

  // `minimal`: solo la cita y la inicial del autor, sin caja ni decoracion.
  if (presentation === 'minimal') {
    return (
      <BusinessSection id={anchor}>
        <BusinessContainer>
          <BusinessHeading title={title} />
          <ul className="max-w-2xl space-y-6">
            {items.map((item: any) => (
              <li key={item.id} className="flex gap-4">
                <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full border text-sm font-bold">{item.name?.charAt(0) || '?'}</span>
                <div>
                  <p className="opacity-80"><Quote>{item.content}</Quote></p>
                  <p className="mt-1 text-sm font-semibold">{item.name}</p>
                </div>
              </li>
            ))}
          </ul>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `featured`: un testimonio destacado a sangre y el resto en grilla.
  if (presentation === 'featured') {
    const [lead, ...rest] = items;
    return (
      <BusinessSection id={anchor} className="bg-stone-50">
        <BusinessContainer>
          <BusinessHeading title={title} />
          {lead && (
            <div className="mb-8 rounded-3xl bg-neutral-900 p-8 text-white md:p-12">
              <p className="text-2xl font-extrabold leading-snug sm:text-3xl"><Quote>{lead.content}</Quote></p>
              <p className="mt-4 text-sm font-semibold uppercase tracking-[.24em] opacity-70">{lead.name}</p>
            </div>
          )}
          {rest.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((item: any) => (
                <BusinessCard key={item.id}>
                  <p className="opacity-80"><Quote>{item.content}</Quote></p>
                  <Author name={item.name} />
                </BusinessCard>
              ))}
            </div>
          )}
        </BusinessContainer>
      </BusinessSection>
    );
  }

  return null;
}

const TEAM_PRESENTATIONS = ['grid', 'editorial', 'portrait', 'cards', 'minimal'] as const;

/** Equipo. FASE A: 5 variantes reales. */
function Team({ team, config, anchor }: BlockProps) {
  if (!team.length) return null;
  const title = text(config, 'title', 'Nuestro equipo');
  const presentation = presentationOf(config, TEAM_PRESENTATIONS, 'grid');

  // `grid`: fila de retratos pequenos, la mas compacta.
  if (presentation === 'grid') {
    return (
      <BusinessSection id={anchor}>
        <BusinessContainer>
          <BusinessHeading title={title} />
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

  // `portrait`: fichas verticales con retrato alto y texto apilado al pie.
  if (presentation === 'portrait') {
    return (
      <BusinessSection id={anchor} className="bg-stone-50">
        <BusinessContainer>
          <BusinessHeading title={title} />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {team.map((member: any) => (
              <div key={member.id} className="overflow-hidden rounded-2xl bg-white">
                {member.photo && <BusinessImage src={member.photo} alt={member.name} className="aspect-[3/4] w-full object-cover" />}
                <div className="p-4">
                  <p className="font-bold leading-tight">{member.name}</p>
                  {member.role && <p className="mt-1 text-xs uppercase tracking-wider opacity-60">{member.role}</p>}
                </div>
              </div>
            ))}
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `cards`: tarjeta con borde y sombra, retrato cuadrado y bio opcional.
  if (presentation === 'cards') {
    return (
      <BusinessSection id={anchor}>
        <BusinessContainer>
          <BusinessHeading title={title} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((member: any) => (
              <BusinessCard key={member.id} className="text-center">
                {member.photo && <BusinessImage src={member.photo} alt={member.name} className="mx-auto aspect-square w-28 rounded-full object-cover" />}
                <p className="mt-4 font-bold">{member.name}</p>
                {member.role && <p className="mt-1 text-sm opacity-70">{member.role}</p>}
                {member.bio && <p className="mt-2 text-sm opacity-70">{member.bio}</p>}
              </BusinessCard>
            ))}
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `editorial`: presentación vertical de texto con retrato aside, una fila por
  // persona: la variante que prioriza el relato sobre la foto.
  if (presentation === 'editorial') {
    return (
      <BusinessSection id={anchor}>
        <BusinessContainer>
          <BusinessHeading title={title} />
          <div className="divide-y">
            {team.map((member: any) => (
              <div key={member.id} className="grid items-center gap-4 py-6 md:grid-cols-12">
                {member.photo && <div className="md:col-span-2"><BusinessImage src={member.photo} alt={member.name} className="aspect-square w-full rounded-xl object-cover" /></div>}
                <div className="md:col-span-4">
                  <p className="text-xl font-extrabold">{member.name}</p>
                  {member.role && <p className="text-sm opacity-60">{member.role}</p>}
                </div>
                {member.bio && <p className="opacity-75 md:col-span-6">{member.bio}</p>}
              </div>
            ))}
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `minimal`: solo nombres y rol en linea, sin imagenes.
  if (presentation === 'minimal') {
    return (
      <BusinessSection id={anchor}>
        <BusinessContainer>
          <BusinessHeading title={title} />
          <ul className="max-w-2xl divide-y border-t">
            {team.map((member: any) => (
              <li key={member.id} className="flex items-baseline justify-between gap-4 py-3">
                <span className="font-medium">{member.name}</span>
                {member.role && <span className="text-sm opacity-60">{member.role}</span>}
              </li>
            ))}
          </ul>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  return null;
}

const FAQ_PRESENTATIONS = ['accordion', 'editorial', 'minimal'] as const;

/** Preguntas frecuentes, colapsables en mobile. FASE A: 3 variantes reales. */
function FAQ({ faqs, config, anchor }: BlockProps) {
  if (!faqs.length) return null;
  const title = text(config, 'title', 'Preguntas frecuentes');
  const presentation = presentationOf(config, FAQ_PRESENTATIONS, 'accordion');

  // `accordion`: cada pregunta plegable, con `<details>` nativo (teclado y
  // lectores de pantalla sin trabajo extra).
  if (presentation === 'accordion') {
    return (
      <BusinessSection id={anchor} className="bg-stone-50">
        <BusinessContainer>
          <BusinessHeading title={title} />
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

  // `editorial`: respuestas siempre visibles en columna angosta, separadas por
  // filete. Sin plegado: la persona escanea, no descubre.
  if (presentation === 'editorial') {
    return (
      <BusinessSection id={anchor}>
        <BusinessContainer>
          <div className="grid gap-8 md:grid-cols-12">
            <div className="md:col-span-4">
              <h2 className="text-3xl font-black leading-tight sm:text-4xl">{title}</h2>
            </div>
            <div className="divide-y md:col-span-8">
              {faqs.map((item: any) => (
                <div key={item.id} className="py-5">
                  <h3 className="text-lg font-bold">{item.question}</h3>
                  <p className="mt-2 opacity-75">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `minimal`: solo la pregunta en lista escaneable; la respuesta aparece al
  // desplegar. Es la variante mas ligera en la vista.
  if (presentation === 'minimal') {
    return (
      <BusinessSection id={anchor}>
        <BusinessContainer>
          <BusinessHeading title={title} />
          <div className="mx-auto max-w-2xl divide-y border-y">
            {faqs.map((item: any) => (
              <details key={item.id} className="group py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {item.question}
                  <span aria-hidden className="shrink-0 text-lg leading-none opacity-50 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 opacity-75">{item.answer}</p>
              </details>
            ))}
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  return null;
}

const CONTACT_PRESENTATIONS = ['split', 'cards', 'minimal'] as const;

/**
 * Datos de contacto. Reutiliza la seccion real ya probada (mismo formulario y
 * mismos endpoints), asi que la variante NO duplica logica de negocio: solo
 * cambia la COMPOSICION alrededor. FASE A: 3 variantes reales.
 */
function Contact({ business, config, anchor, preview }: BlockProps) {
  const title = text(config, 'title');
  const presentation = presentationOf(config, CONTACT_PRESENTATIONS, 'split');

  // `minimal`: sin formulario. Solo los canales directos (WhatsApp, telefono,
  // correo). Es la variante para quien prefiere no recibir solicitudes.
  if (presentation === 'minimal') {
    const action = industryCta(business?.category);
    const wa = business?.whatsapp ? waHref(business, `Hola ${business?.name || ''}, quiero ${action.toLowerCase()}.`) : '';
    const channels = [
      wa && { label: action, href: wa },
      business?.phone && { label: `Llamar al ${business.phone}`, href: `tel:${business.phone}` },
      business?.email && { label: 'Enviar un correo', href: `mailto:${business.email}` },
    ].filter(Boolean) as Array<{ label: string; href: string }>;
    if (!channels.length) return null;
    return (
      <BusinessSection id={anchor} className="py-10">
        <BusinessContainer>
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-extrabold">{title || 'Hablemos'}</h2>
              <p className="text-sm opacity-70">{business?.description}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {channels.map((channel) => (
                <BusinessButton key={channel.href} href={channel.href} variant={channel.href === wa ? 'primary' : 'secondary'}>
                  {channel.label}
                </BusinessButton>
              ))}
            </div>
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `cards`: cada canal de contacto en su propia tarjeta, con el formulario
  // real debajo. Se diferencia de `split` en la COMPOSICION de los canales.
  if (presentation === 'cards') {
    const action = industryCta(business?.category);
    const channels = [
      business?.whatsapp && { label: action, detail: 'Escríbenos directo', href: waHref(business, `Hola ${business?.name || ''}.`) },
      business?.phone && { label: business.phone, detail: 'Llámanos', href: `tel:${business.phone}` },
      business?.email && { label: business.email, detail: 'Envíanos un correo', href: `mailto:${business.email}` },
      business?.mapsUrl && { label: 'Ubicación', detail: [business?.address, business?.city].filter(Boolean).join(', '), href: business.mapsUrl },
    ].filter(Boolean) as Array<{ label: string; detail: string; href: string }>;
    if (!channels.length) return null;
    return (
      <BusinessSection id={anchor} className="bg-stone-100">
        <BusinessContainer>
          <BusinessHeading eyebrow="Estamos en contacto" title={title || 'Hablemos'} text={business?.description} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {channels.map((channel) => (
              <a
                key={channel.href}
                href={channel.href}
                target={channel.href.startsWith('http') ? '_blank' : undefined}
                rel={channel.href.startsWith('http') ? 'noreferrer' : undefined}
                className="rounded-2xl border bg-white p-5 font-semibold hover:border-stone-900 focus-visible:outline focus-visible:ring-2"
              >
                <span className="block text-xs uppercase tracking-wider opacity-60">{channel.detail}</span>
                <span className="mt-1 block break-words">{channel.label}</span>
              </a>
            ))}
          </div>
          <div className="mt-8">
            <ContactSection business={business} preview={preview} />
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `split`: la seccion probada, con datos a un lado y formulario al otro.
  return <ContactSection business={business} preview={preview} />;
}

/** Botón de WhatsApp. */
function WhatsApp({ business, config, anchor }: BlockProps) {
  if (!business?.whatsapp) return null;
  return (
    <BusinessSection id={anchor} className="py-10">
      <BusinessContainer>
        <BusinessButton href={waHref(business, `Hola ${business.name}, quiero más información.`)}>
          {text(config, 'label', 'Escríbenos por WhatsApp')}
        </BusinessButton>
      </BusinessContainer>
    </BusinessSection>
  );
}

const MAP_PRESENTATIONS = ['split', 'fullscreen', 'inline'] as const;

/** Ubicación: dirección y enlace al mapa. FASE A: 3 variantes reales. */
function Map({ business, config, anchor }: BlockProps) {
  const address = [business?.address, business?.city, business?.region].filter(Boolean).join(', ');
  const href = business?.mapsUrl || (business?.lat != null && business?.lng != null ? `https://www.google.com/maps?q=${business.lat},${business.lng}` : '');
  if (!address && !href) return null;
  const presentation = presentationOf(config, MAP_PRESENTATIONS, 'split');

  // `fullscreen`: el mapa manda y la direccion queda como pie superpuesto. No
  // renderiza un mapa embebido porque exigiria una clave de API externa: la
  // variante usa la seccion real y cambia la composicion alrededor.
  if (presentation === 'fullscreen') {
    return (
      <BusinessSection id={anchor} className="p-0">
        <div className="relative">
          <div className="min-h-[60vh] w-full bg-stone-200" role="img" aria-label={`Ubicacion de ${business?.name || 'el negocio'}`} />
          {address && (
            <div className="absolute inset-x-0 bottom-0 bg-neutral-900/90 p-6 text-white">
              <BusinessContainer className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <p className="font-semibold">{address}</p>
                {href && <BusinessButton href={href} variant="secondary">Como llegar</BusinessButton>}
              </BusinessContainer>
            </div>
          )}
        </div>
      </BusinessSection>
    );
  }

  // `inline`: la variante compacta: solo la linea de direccion con el enlace.
  if (presentation === 'inline') {
    return (
      <BusinessSection id={anchor} className="py-8">
        <BusinessContainer>
          <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
            <p className="text-sm font-semibold">{address}</p>
            {href && <a href={href} target="_blank" rel="noreferrer" className="text-sm font-bold underline underline-offset-4">Ver en el mapa</a>}
          </div>
        </BusinessContainer>
      </BusinessSection>
    );
  }

  // `split`: seccion probada de ubicacion, con direccion y mapa al costado.
  return (
    <BusinessSection id={anchor}>
      <LocationSection business={business} />
    </BusinessSection>
  );
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
            <p className="mt-2 text-sm opacity-70">La vista previa no envía solicitudes.</p>
          </BusinessCard>
        </BusinessContainer>
      </BusinessSection>
    );
  }
  return <ContactSection business={business} />;
}

/** Pie de página con datos del negocio. */
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
 * MAPA ÃšNICO id â†’ renderer. Es la implementación del BlockRegistry.
 * Si un id del BlockRegistry no aparece aquí, el bloque NO tiene renderer y
 * el test de paridad falla: es la guarda contra funcionalidad falsa y contra
 *Ã¤Â¸Â¤Ã¥Ââ€” con el mismo nombre en archivos distintos.
 */
export const BLOCK_RENDERERS: Record<string, (props: BlockProps) => ReactNode> = {
  Hero, HeroVideo, Text: TextBlock, Image: ImageBlock, ImageGallery,
  Video, VideoGallery, Button, CTA, Products, ProductFeatured, Promotions,
  Properties, PropertyFeatured, Services, Booking, Testimonials, Team, FAQ,
  Contact, WhatsApp, Map, SocialLinks, LeadForm, Footer,
};

/** Ã‚¿Este bloque tiene renderer real? */
export function hasRenderer(blockId: string): boolean {
  return Object.prototype.hasOwnProperty.call(BLOCK_RENDERERS, blockId);
}
