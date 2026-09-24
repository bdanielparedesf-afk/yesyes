import { useState } from 'react';
import { Clock3, ExternalLink, Loader2, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { buildWaLink, createLead, trackEvent } from '@/services/business';
import { ctaLabel } from '../businessLabels';
import { BusinessButton, BusinessCard, BusinessHeading, BusinessImage, BusinessSection, BusinessContainer } from './index';

const DAY_ORDER = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export function HoursSection({ business, dark = false }: { business: any; dark?: boolean }) {
  const entries = Object.entries(business?.hours || {}).filter(([, value]) => String(value || '').trim()).sort(([a], [b]) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  if (!entries.length) return null;
  return <BusinessSection id="horarios" className={dark ? 'bg-black text-white' : ''}><BusinessContainer><BusinessHeading title="Horarios" /><dl className="max-w-xl divide-y divide-current/15">{entries.map(([day, value]) => <div key={day} className="flex justify-between gap-6 py-3"><dt>{day}</dt><dd className="text-right font-semibold">{String(value)}</dd></div>)}</dl></BusinessContainer></BusinessSection>;
}
export function LocationSection({ business, dark = false }: { business: any; dark?: boolean }) {
  const address = [business?.address, business?.city, business?.region].filter(Boolean).join(', ');
  const href = business?.mapsUrl || (business?.lat != null && business?.lng != null ? `https://www.google.com/maps?q=${business.lat},${business.lng}` : '');
  if (!address && !href) return null;
  return <BusinessSection id="ubicacion" className={dark ? 'bg-neutral-900 text-white' : 'bg-stone-100'}><BusinessContainer><div className="grid items-center gap-7 md:grid-cols-2"><div><BusinessHeading eyebrow="Visítanos" title="Ubicación" text={address} />{href && <BusinessButton href={href}>Abrir ubicación <ExternalLink size={16} className="ml-2" aria-hidden /></BusinessButton>}</div>{business?.mapImage ? <BusinessImage src={business.mapImage} alt={`Mapa de ${business.name}`} className="aspect-[4/3] w-full rounded-3xl object-cover" /> : <div className="grid min-h-56 place-items-center rounded-3xl border bg-white/60" aria-label="Ubicación del negocio"><MapPin size={44} aria-hidden /></div>}</div></BusinessContainer></BusinessSection>;
}
export function ContactSection({ business, preview = false }: { business: any; preview?: boolean }) {
  const slug = business.slug; const action = ctaLabel(business.category); const waMessage = `Hola ${business.name}, quiero ${action.toLowerCase()}.`;
  const socials = Object.entries(business?.socials || {}).filter(([, value]) => String(value || '').trim());
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const submitLead = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); setSendState('sending');
    try { await createLead(slug, { name: form.get('name'), phone: form.get('phone'), message: form.get('message'), type: 'CONSULTA', website: '' }); formElement.reset(); setSendState('sent'); void trackEvent(slug, 'LEAD_CREATED'); }
    catch { setSendState('error'); }
  };
  return <BusinessSection id="contacto" className="bg-stone-100"><BusinessContainer><BusinessHeading eyebrow="Estamos en contacto" title="Hablemos" text={business?.description} /><div className="grid gap-5 lg:grid-cols-2">
    <div className="grid content-start gap-3">{business?.whatsapp && <BusinessButton href={buildWaLink(business.whatsapp, waMessage)} onClick={() => void trackEvent(slug, 'WHATSAPP_CLICK')}>{action}</BusinessButton>}{business?.phone && <BusinessButton href={`tel:${business.phone}`} variant="secondary" onClick={() => void trackEvent(slug, 'PHONE_CLICK')}><Phone size={17} className="mr-2" aria-hidden />Llamar al {business.phone}</BusinessButton>}{business?.email && <BusinessButton href={`mailto:${business.email}`} variant="secondary" onClick={() => void trackEvent(slug, 'EMAIL_CLICK')}><Mail size={17} className="mr-2" aria-hidden />Enviar un correo</BusinessButton>}{socials.length > 0 && <div className="flex flex-wrap gap-2 pt-2">{socials.map(([name, url]) => <a key={name} href={String(url).startsWith('http') ? String(url) : `https://${url}`} target="_blank" rel="noreferrer" className="rounded-full border bg-white px-4 py-2 text-sm font-semibold capitalize">{name}</a>)}</div>}</div>
    {preview ? <BusinessCard className="bg-amber-50"><p className="font-semibold">Formulario disponible al publicar</p><p className="mt-2 text-sm opacity-70">La vista previa no envía solicitudes.</p></BusinessCard> : <form className="grid gap-3 rounded-[var(--biz-radius)] bg-white p-5 shadow-[var(--biz-shadow)]" onSubmit={submitLead}>
      <label className="text-sm font-semibold">Nombre<input name="name" required className="mt-1 w-full rounded-xl border p-3" autoComplete="name" /></label><label className="text-sm font-semibold">Teléfono<input name="phone" className="mt-1 w-full rounded-xl border p-3" autoComplete="tel" /></label><label className="text-sm font-semibold">Mensaje<textarea name="message" required className="mt-1 w-full rounded-xl border p-3" /></label><button disabled={sendState === 'sending'} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--biz-primary)] px-5 font-bold text-white disabled:opacity-60">{sendState === 'sending' ? <Loader2 className="animate-spin" aria-hidden /> : <MessageCircle aria-hidden />}{sendState === 'sending' ? 'Enviando…' : 'Enviar mensaje'}</button><p role="status" aria-live="polite" className="text-sm text-stone-600">{sendState === 'sent' ? '¡Gracias! Te contactaremos pronto.' : sendState === 'error' ? 'No pudimos enviar el mensaje. Inténtalo nuevamente.' : ''}</p>
    </form>}
  </div></BusinessContainer></BusinessSection>;
}
export function SocialLinks({ business }: { business: any }) { return <div className="flex flex-wrap gap-3">{Object.entries(business?.socials || {}).filter(([, value]) => value).map(([name, url]) => <a key={name} href={String(url).startsWith('http') ? String(url) : `https://${url}`} target="_blank" rel="noreferrer" className="capitalize hover:underline">{name}</a>)}</div>; }
export { Clock3 };
