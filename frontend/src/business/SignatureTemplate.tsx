import { Clock3, MapPin, Sparkles } from 'lucide-react';
import { buildWaLink } from '@/services/business';
import { categoryLabel } from './businessLabels';
import { getIndustryComposition } from './industryComposition';
import { heroImage } from './assets';
import { BusinessButton, BusinessCard, BusinessContainer, BusinessHeading, BusinessImage, BusinessSection } from './components';
import type { TemplateProps } from './registry';

import { signatureCategory, signatureVariant } from './signatureUtils';
import { collectionGroupLabel, resolveCollectionGroups } from './collectionGroups';
const money = (value: unknown) => value == null ? 'Consultar' : `$${Number(value).toLocaleString('es-CL')}`;
const imageOf = (item: any) => item?.image || item?.images?.[0]?.url;

/** Tres nuevas direcciones visuales para cada rubro, sin sustituir las plantillas actuales. */
export default function SignatureTemplate({ business, services, products, properties, gallery }: TemplateProps) {
  const code = String(business?.template?.code || '').toUpperCase();
  const category = signatureCategory(code) || String(business?.category || 'PRO').toUpperCase();
  const variant = signatureVariant(code);
  const composition = getIndustryComposition(null, category);
  // Productos y servicios son recursos INDEPENDIENTES: cada uno se muestra si
  // tiene contenido. Nunca se eligen uno en lugar del otro.
  const groups = resolveCollectionGroups({ properties, products, services });
  const empty = groups.visible.length === 0;
  const name = business?.name || categoryLabel(category);
  const message = `Hola ${name}, quiero ${composition.cta.toLowerCase()}.`;
  const href = buildWaLink(business?.whatsapp, message);
  const image = heroImage(business, category);
  const sectionName = category === 'REAL_ESTATE' ? 'Propiedades destacadas' : ['FOOD', 'BAKERY', 'CAFE', 'BOUTIQUE', 'FLOWERS'].includes(category) ? 'Nuestra selecciÃ³n' : 'Lo que ofrecemos';
  const closing = variant === 'NATIVE' ? `Hecho cerca, para ${categoryLabel(category).toLowerCase()}.` : variant === 'ATLAS' ? 'Tu prÃ³xima experiencia empieza aquÃ­.' : `Un lugar para descubrir ${categoryLabel(category).toLowerCase()}.`;

  return <div className="business-signature overflow-hidden" data-business-signature={variant.toLowerCase()}>
    <section id="inicio" className="relative isolate min-h-[72vh] overflow-hidden bg-neutral-950 text-white">
      <BusinessImage src={image} alt={`${categoryLabel(category)} â€” ${name}`} eager className="absolute inset-0 -z-20 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/45 to-black/10" />
      <BusinessContainer className={`flex min-h-[72vh] items-end py-16 ${variant === 'ATLAS' ? 'sm:items-center' : ''}`}><div className="max-w-3xl">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.28em] text-white/80"><Sparkles size={15} aria-hidden /> {categoryLabel(category)} Â· {variant === 'NATIVE' ? 'Cercano' : variant === 'ATLAS' ? 'DirecciÃ³n' : 'Esencial'}</p>
        <h1 className="mt-5 text-5xl font-black leading-[.95] tracking-tight sm:text-7xl" style={{ fontFamily: 'var(--biz-heading)' }}>{name}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/80">{business?.description || closing}</p>
        <div className="mt-8 flex flex-wrap gap-3"><BusinessButton href={href}>{composition.cta}</BusinessButton><BusinessButton href="#contacto" variant="secondary">Conocer el negocio</BusinessButton></div>
      </div></BusinessContainer>
    </section>

    {groups.visible.map((group) => <BusinessSection key={group.key} id={group.key} className="bg-white"><BusinessContainer><div className={`grid gap-10 ${variant === 'ATLAS' ? 'lg:grid-cols-[.8fr_1.2fr]' : 'lg:grid-cols-[1.15fr_.85fr]'}`}>
      <div><BusinessHeading eyebrow="Una experiencia mÃ¡s simple" title={group.key === 'properties' ? sectionName : collectionGroupLabel(group.key)} text="InformaciÃ³n clara, atenciÃ³n cercana y los detalles que necesitas para elegirnos." /></div>
      <div className="grid gap-4 sm:grid-cols-2">{group.items.slice(0, 6).map((item: any) => <BusinessCard key={item.id} className="group overflow-hidden p-0">
        {imageOf(item) && <BusinessImage src={imageOf(item)} alt={item.name || item.title} className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105" />}<div className="p-5"><h3 className="text-lg font-bold">{item.name || item.title}</h3><p className="mt-2 line-clamp-2 text-sm opacity-70">{item.shortDescription || item.description || item.bio}</p><p className="mt-4 font-bold text-[var(--biz-primary)]">{money(item.price ?? item.salePrice)}</p></div>
      </BusinessCard>)}</div>
    </div></BusinessContainer></BusinessSection>)}
    {empty && <BusinessSection id="catalogo" className="bg-white"><BusinessContainer><div className="grid gap-4 sm:grid-cols-2"><BusinessCard className="sm:col-span-2 bg-[var(--biz-bg)]"><p className="font-semibold">Estamos preparando nuestra colecciÃ³n.</p><p className="mt-2 text-sm opacity-70">EscrÃ­benos y te ayudaremos a encontrar la mejor opciÃ³n.</p></BusinessCard></div></BusinessContainer></BusinessSection>}

    {!!gallery.length && <BusinessSection id="galeria" className="bg-[var(--biz-bg)]"><BusinessContainer><BusinessHeading eyebrow="AsÃ­ se ve nuestro trabajo" title="Una mirada a lo que hacemos" align="center" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{gallery.slice(0, 6).map((photo: any, index: number) => <BusinessImage key={photo.id || photo.url} src={photo.url} alt={photo.alt || `GalerÃ­a de ${name}`} className={`w-full rounded-[var(--biz-radius)] object-cover ${index === 0 ? 'aspect-[4/3] sm:col-span-2 lg:col-span-2' : 'aspect-square'}`} />)}</div></BusinessContainer></BusinessSection>}

    <BusinessSection id="contacto" className="bg-neutral-950 text-white"><BusinessContainer><div className="grid gap-8 md:grid-cols-3"><div className="md:col-span-2"><BusinessHeading eyebrow="Hablemos" title={closing} text="CuÃ©ntanos quÃ© necesitas y te responderemos directamente por WhatsApp." /><BusinessButton href={href}>{composition.cta}</BusinessButton></div><div className="space-y-4 text-sm text-white/80"><p className="flex gap-3"><MapPin size={19} className="shrink-0 text-[var(--biz-accent)]" aria-hidden /> {[business?.address, business?.city, business?.region].filter(Boolean).join(', ') || 'UbicaciÃ³n disponible al consultar.'}</p><p className="flex gap-3"><Clock3 size={19} className="shrink-0 text-[var(--biz-accent)]" aria-hidden /> {business?.hours ? 'Consulta nuestros horarios por WhatsApp.' : 'AtenciÃ³n y consultas por mensaje.'}</p></div></div></BusinessContainer></BusinessSection>
  </div>;
}
