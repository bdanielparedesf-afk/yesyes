import { useEffect, useState } from 'react';
import { sectionDefinition } from './sectionRegistry';
import { MediaField } from './MediaField';
import { mediaSlotsOfSection, setBlockConfigValue, type ManifestLike } from './useBuilderState';
import { manifestSectionOfCapability } from './types';
import type { BusinessMediaItem } from '@/services/business';

const input = 'mt-1 w-full rounded-xl border border-stone-200 p-3 text-sm outline-none focus:border-stone-900';
function Group({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) { const [open, setOpen] = useState(defaultOpen); return <section className="border-b"><button type="button" className="flex w-full items-center justify-between px-5 py-4 text-left text-xs font-bold uppercase tracking-widest" onClick={() => setOpen(!open)} aria-expanded={open}>{title}<span aria-hidden>{open ? '−' : '+'}</span></button>{open && <div className="space-y-4 px-5 pb-5">{children}</div>}</section>; }
function Field({ label, value, onChange, type = 'text', hint, testId }: { label: string; value: any; onChange: (value: string) => void; type?: string; hint?: string; testId?: string }) { return <label className="block text-sm font-semibold">{label}<input data-testid={testId} className={input} type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} />{hint && <span className="mt-1 block text-xs font-normal text-stone-500">{hint}</span>}</label>; }
/**
 * FASE 6 — MEDIOS DE LA SECIÓN.
 *
 * Solo aparece si el manifest tiene un bloque con campos `media-ref` (los
 * declara el BlockRegistry del backend, no este archivo). Cada campo abre el
 * picker real: subir, elegir de lo ya subido, reemplazar o quitar.
 *
 * La escritura pasa SIEMPRE por `setBlockConfigValue`, que devuelve un manifest
 * nuevo; por eso la elección de media entra en el historial de undo/redo y en
 * el autosave igual que cualquier otro cambio del documento.
 */
function SectionMedia({ business, manifest, selected, sectionId, onEditManifest }: {
  business: any; manifest: ManifestLike | null; selected: string; sectionId?: string; onEditManifest?: (manifest: ManifestLike) => void;
}) {
  const [schemas, setSchemas] = useState<Record<string, Array<{ key: string; label: string; type: string; required?: boolean }>>>({});
  const [media, setMedia] = useState<BusinessMediaItem[]>(() => (business?.media || []) as BusinessMediaItem[]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => { setMedia((business?.media || []) as BusinessMediaItem[]); }, [business?.media]);

  // El contrato de campos lo da el backend: es quien valida el manifest.
  useEffect(() => {
    let alive = true;
    import('@/lib/axios').then(({ default: api }) => api.get('/template-engine/registries'))
      .then(({ data }: any) => {
        if (!alive) return;
        const map: Record<string, any[]> = {};
        for (const block of data?.blocks || []) map[block.id] = block.configSchema || [];
        setSchemas(map);
      })
      .catch(() => { if (alive) setLoadError('No se pudo leer el catálogo de medios del motor.'); });
    return () => { alive = false; };
  }, []);

  if (!manifest || !onEditManifest || !business?.id) return null;
  // Se resuelve por el id REAL de la seccion. La capability no sirve aqui: dos
  // bloques distintos pueden compartir capability (p.ej. galeria y video), y la
  // busqueda inversa devolveria la seccion equivocada, con sus campos de medio.
  const direct = (manifest.sections || []).find((item: any) => item?.id === sectionId);
  const section = direct || manifestSectionOfCapability(manifest as any, sectionId || selected) || null;
  const resolvedSectionId = String(section?.id ?? sectionId ?? selected);
  const slots = mediaSlotsOfSection(manifest, resolvedSectionId, schemas);
  if (!slots.length) return null;

  return (
    <Group title="Imágenes y video">
      {loadError && <p className="text-xs text-rose-600">{loadError}</p>}
      {slots.map((slot) => (
        <div key={slot.blockId} className="space-y-4 border-b border-stone-100 pb-4 last:border-0">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{slot.blockLabel}</p>
          {slot.fields.map((field) => {
            // En un video, `poster` es el segundo campo: se controla junto al video.
            const isVideo = field.kind === 'video';
            const posterSlot = isVideo ? slot.fields.find((f) => f.key === 'poster') : undefined;
            return (
              <MediaField
                key={field.key}
                businessId={String(business.id)}
                media={media}
                label={field.label}
                value={field.value}
                kind={field.kind}
                required={field.required}
                onChange={(reference) => onEditManifest(setBlockConfigValue(manifest, { sectionId: resolvedSectionId, blockId: slot.blockId, field: field.key, value: reference }))}
                onLibraryChange={setMedia}
                {...(isVideo && posterSlot ? {
                  posterOf: posterSlot.value as string | null,
                  onPosterChange: (reference: string | null) => onEditManifest(setBlockConfigValue(manifest, { sectionId: resolvedSectionId, blockId: slot.blockId, field: 'poster', value: reference })),
                } : {})}
              />
            );
          })}
        </div>
      ))}
    </Group>
  );
}

export default function BuilderInspector({ business, selected, onChange, manifest, sectionId, onEditManifest }: { business: any; selected: string; onChange: (patch: Record<string, unknown>) => void; manifest?: ManifestLike | null; sectionId?: string; onEditManifest?: (manifest: ManifestLike) => void }) {
  const definition = sectionDefinition(selected); const cta = business.cta || {};
  return <aside data-testid="builder-inspector" className="h-full overflow-auto bg-white"><header className="border-b p-5"><p className="text-xs font-bold uppercase tracking-widest text-stone-500">Estás editando</p><h2 className="text-xl font-bold">{definition?.label || 'Diseño'}</h2></header>
    {(selected === 'HERO' || selected === 'ABOUT') && <Group title="Contenido"><Field testId={selected === 'HERO' ? 'builder-name-input' : undefined} label={selected === 'HERO' ? 'Título' : 'Encabezado'} value={selected === 'HERO' ? business.name : business.aboutTitle} onChange={(value) => onChange(selected === 'HERO' ? { name: value } : { aboutTitle: value })} /><Field label="Descripción" value={business.description} onChange={(description) => onChange({ description })} /><Field label="Imagen" value={business.cover} type="url" onChange={(cover) => onChange({ cover })} /></Group>}
    {selected === 'HERO' && <><Group title="Llamadas a la acción"><Field label="Botón principal" value={cta.primaryLabel} onChange={(primaryLabel) => onChange({ cta: { ...cta, primaryLabel } })} /><Field label="Acción" value={cta.primaryAction} onChange={(primaryAction) => onChange({ cta: { ...cta, primaryAction } })} hint="WHATSAPP, CONTACT o URL." /><Field label="Botón secundario" value={cta.secondaryLabel} onChange={(secondaryLabel) => onChange({ cta: { ...cta, secondaryLabel } })} /></Group><Group title="Diseño" defaultOpen={false}><Field label="Alineación" value={cta.alignment || 'left'} onChange={(alignment) => onChange({ cta: { ...cta, alignment } })} /><Field label="Altura" value={cta.height || 'medium'} onChange={(height) => onChange({ cta: { ...cta, height } })} /></Group></>}
    {selected === 'CTA' && <Group title="Llamado a la acción"><Field label="Título" value={cta.title || business.name} onChange={(title) => onChange({ cta: { ...cta, title } })} /><Field label="Descripción" value={cta.description} onChange={(description) => onChange({ cta: { ...cta, description } })} /><Field label="Texto del botón" value={cta.primaryLabel} onChange={(primaryLabel) => onChange({ cta: { ...cta, primaryLabel } })} /><Field label="Acción" value={cta.primaryAction} onChange={(primaryAction) => onChange({ cta: { ...cta, primaryAction } })} /></Group>}
    {['CONTACT', 'WHATSAPP', 'MAP', 'FOOTER'].includes(selected) && <Group title="Contacto"><Field label="Teléfono" value={business.phone} type="tel" onChange={(phone) => onChange({ phone })} /><Field label="WhatsApp" value={business.whatsapp} type="tel" onChange={(whatsapp) => onChange({ whatsapp })} /><Field label="Correo electrónico" value={business.email} type="email" onChange={(email) => onChange({ email })} /><Field label="Dirección" value={business.address} onChange={(address) => onChange({ address })} /><Field label="Ciudad" value={business.city} onChange={(city) => onChange({ city })} /><Field label="Referencia de ubicación" value={business.mapsUrl} type="url" onChange={(mapsUrl) => onChange({ mapsUrl })} /></Group>}
    <SocialFields business={business} selected={selected} onChange={onChange} /><HoursFields business={business} selected={selected} onChange={onChange} />
    {selected === 'SEO' && <Group title="Posicionamiento"><Field label="Título SEO" value={business.seoTitle} onChange={(seoTitle) => onChange({ seoTitle })} hint={`${String(business.seoTitle || '').length} de 60 caracteres`} /><Field label="Descripción SEO" value={business.seoDescription} onChange={(seoDescription) => onChange({ seoDescription })} hint={`${String(business.seoDescription || '').length} de 160 caracteres`} /><Field label="Dirección de la página" value={business.slug} onChange={(slug) => onChange({ slug })} /><Field label="Imagen social" value={business.ogImage} type="url" onChange={(ogImage) => onChange({ ogImage })} /></Group>}
    {['SERVICES', 'PRODUCTS', 'CATALOG', 'GALLERY', 'TEAM', 'TESTIMONIALS', 'FAQ'].includes(selected) && <Group title="Contenido"><p className="text-sm leading-6 text-stone-600">Usa únicamente el contenido real de tu negocio.{dataEmpty(selected)}</p></Group>}
    <SectionMedia business={business} manifest={manifest ?? null} selected={selected} sectionId={sectionId} onEditManifest={onEditManifest} />
  </aside>;
function SocialFields({ business, selected, onChange }: any) { if (!['SOCIALS', 'FOOTER', 'CONTACT'].includes(selected)) return null; const set = (key: string, value: string) => onChange({ socials: { ...business.socials, [key]: value } }); return <Group title="Redes sociales"><Field label="Instagram" value={business.socials?.instagram} onChange={(value) => set('instagram', value)} /><Field label="Facebook" value={business.socials?.facebook} onChange={(value) => set('facebook', value)} /><Field label="TikTok" value={business.socials?.tiktok} onChange={(value) => set('tiktok', value)} /><Field label="YouTube" value={business.socials?.youtube} onChange={(value) => set('youtube', value)} /><Field label="Sitio web" value={business.socials?.website} onChange={(value) => set('website', value)} /></Group>; }
function HoursFields({ business, selected, onChange }: any) { if (selected !== 'OPENING_HOURS') return null; const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']; const set = (day: string, value: string) => onChange({ hours: { ...business.hours, [day]: value } }); return <Group title="Horarios">{days.map((day) => <Field key={day} label={day} value={business.hours?.[day]} onChange={(value) => set(day, value)} hint="Ejemplo: 09:00 - 18:00" />)}</Group>; }

}
function dataEmpty(id: string) { return ` No agregaremos ${id === 'FAQ' ? 'preguntas' : 'información'} automáticamente.`; }
