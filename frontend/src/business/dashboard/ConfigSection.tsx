import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTemplates, updateBusiness, uploadBusinessImage, deleteBusiness } from '@/services/business';
import api from '@/lib/axios';
import { getMercadoPagoStatus, startMercadoPagoConnection, disconnectMercadoPago, type MercadoPagoStatus } from '@/services/mercadoPago';
import { categoryLabel } from '../businessLabels';
import { createLatestTemplatesRequest, reconcileTemplateId, type TemplateOption } from './templateSync';

export const CATS = ['FLOWERS','BARBER','HAIR','CAFE','FOOD','BAKERY','NAILS','PET','FITNESS','AUTO','REAL_ESTATE','BOUTIQUE','PHOTO','PRO','BEAUTY','MECHANIC','DETAILING','CLEANING','TUTORING','CONSTRUCTION','FURNITURE','PHONE'];
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
type TemplatesState = { category: string; options: TemplateOption[] };

/**
 * Sección de configuración: información básica, plantilla, horarios, redes,
 * SEO, logo/portada, publicación y Mercado Pago.
 */
export default function ConfigSection({ businessId, detail, onSaved }: {
  businessId: string;
  detail: any;
  onSaved: (business: any) => void;
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', slug: '', category: detail?.category || '', description: '', phone: '', whatsapp: '',
    email: '', address: '', city: '', region: '', mapsUrl: '', seoTitle: '', seoDescription: '',
  });
  const [hours, setHours] = useState<Record<string, string>>({});
  const [socials, setSocials] = useState({ instagram: '', facebook: '', tiktok: '', youtube: '' });
  const [templateId, setTemplateId] = useState(detail?.templateId || '');
  const [templatesState, setTemplatesState] = useState<TemplatesState>({ category: '', options: [] });
  const [templatesStatus, setTemplatesStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const templatesRequest = useRef<ReturnType<typeof createLatestTemplatesRequest<TemplateOption>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [mpStatus, setMpStatus] = useState<MercadoPagoStatus | null>(null);
  const [mpLoading, setMpLoading] = useState(false);

  useEffect(() => {
    if (!detail) return;
    setForm({
      name: detail.name || '', slug: detail.slug || '', category: detail.category || '',
      description: detail.description || '', phone: detail.phone || '', whatsapp: detail.whatsapp || '',
      email: detail.email || '', address: detail.address || '', city: detail.city || '',
      region: detail.region || '', mapsUrl: detail.mapsUrl || '',
      seoTitle: detail.seoTitle || '', seoDescription: detail.seoDescription || '',
    });
    const h = detail.hours && typeof detail.hours === 'object' ? detail.hours : {};
    setHours(Object.fromEntries(DAYS.map((d) => [d, String((h as any)[d] || '')])));
    const s = detail.socials && typeof detail.socials === 'object' ? detail.socials : {};
    setSocials({
      instagram: String((s as any).instagram || ''), facebook: String((s as any).facebook || ''),
      tiktok: String((s as any).tiktok || ''), youtube: String((s as any).youtube || ''),
    });
    setTemplateId(detail.templateId || '');
  }, [detail]);

  // Solo la respuesta vigente puede reemplazar la lista de la categoría actual.
  useEffect(() => {
    const category = form.category;
    if (!category) {
      templatesRequest.current?.invalidate();
      setTemplatesState({ category: '', options: [] });
      setTemplatesStatus('idle');
      return;
    }

    const request = createLatestTemplatesRequest(getTemplates, {
      onStart: (requestedCategory) => {
        setTemplatesState({ category: requestedCategory, options: [] });
        setTemplatesStatus('loading');
      },
      onSuccess: (requestedCategory, options) => {
        setTemplatesState({ category: requestedCategory, options });
        setTemplateId((current: string) => reconcileTemplateId(current, options));
        setTemplatesStatus('idle');
      },
      onError: (requestedCategory) => {
        setTemplatesState({ category: requestedCategory, options: [] });
        setTemplateId('');
        setTemplatesStatus('error');
      },
    });
    templatesRequest.current = request;
    void request.load(category);

    return () => request.invalidate();
  }, [form.category]);

  // Estado de Mercado Pago del negocio.
  useEffect(() => {
    getMercadoPagoStatus(businessId).then(setMpStatus).catch(() => setMpStatus(null));
  }, [businessId]);
  const saveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const hoursOut: Record<string, string> = {};
      for (const d of DAYS) { const v = (hours[d] || '').trim(); if (v) hoursOut[d] = v; }
      const socialsOut: Record<string, string> = {};
      for (const [k, v] of Object.entries(socials)) { const t = v.trim(); if (t) socialsOut[k] = t; }
      const updated = await updateBusiness(businessId, {
        name: form.name.trim(),
        slug: form.slug.trim() || detail.slug,
        category: form.category,
        templateId: templateId || null,
        description: form.description.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        region: form.region.trim() || null,
        mapsUrl: form.mapsUrl.trim() || null,
        seoTitle: form.seoTitle.trim() || null,
        seoDescription: form.seoDescription.trim() || null,
        hours: hoursOut,
        socials: socialsOut,
      });
      onSaved(updated);
      setMsg('Negocio actualizado');
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Error guardando (revisa los campos)');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED') => {
    setBusy(true);
    try {
      const action = status === 'PUBLISHED' ? 'publish' : status === 'PAUSED' ? 'pause' : 'archive';
      const { data } = await api.post(`/businesses/${businessId}/${action}`);
      const updated = data.business;
      onSaved(updated);
      setMsg(status === 'PUBLISHED' ? 'Negocio publicado 🎉' : status === 'PAUSED' ? 'Negocio pausado' : 'Negocio archivado');
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Error actualizando estado');
    } finally {
      setBusy(false);
    }
  };

  const pickImage = async (kind: 'logo' | 'cover', file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadBusinessImage(businessId, kind, file);
      const updated = await updateBusiness(businessId, { [kind]: url });
      onSaved(updated);
      setMsg(kind === 'logo' ? 'Logo subido' : 'Portada subida');
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Error subiendo imagen (máx 5MB, JPG/PNG/WEBP)');
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!window.confirm('¿Archivar este negocio? Dejará de estar visible públicamente (borrado lógico).')) return;
    setBusy(true);
    try {
      await deleteBusiness(businessId);
      navigate('/negocio');
    } catch {
      setMsg('Error archivando el negocio');
      setBusy(false);
    }
  };

  const handleConnect = async () => {
    setMpLoading(true);
    try {
      const { authorizationUrl } = await startMercadoPagoConnection(businessId);
      window.location.href = authorizationUrl;
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Error al iniciar conexión con Mercado Pago');
      setMpLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setMpLoading(true);
    try {
      await disconnectMercadoPago(businessId);
      setMpStatus({ connected: false, status: 'NOT_CONNECTED' } as MercadoPagoStatus);
      setMsg('Mercado Pago desconectado');
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Error al desconectar');
    } finally {
      setMpLoading(false);
    }
  };
  const templates = templatesState.category === form.category ? templatesState.options : [];
  const checks = [
    { label: 'Nombre', ok: Boolean(detail?.name) },
    { label: 'Descripción', ok: Boolean(detail?.description) },
    { label: 'Contacto (WhatsApp/tel/email)', ok: Boolean(detail?.whatsapp || detail?.phone || detail?.email) },
    { label: 'Dirección', ok: Boolean(detail?.address) },
    { label: 'Logo', ok: Boolean(detail?.logo) },
    { label: 'Portada', ok: Boolean(detail?.cover) },
    { label: 'Plantilla', ok: Boolean(detail?.templateId) },
    { label: 'SEO', ok: Boolean(detail?.seoTitle || detail?.seoDescription) },
  ];
  const pct = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  const mpConnected = mpStatus?.connected === true;

  return (
    <div className="space-y-5">
      {/* Estado + acciones de publicacion */}
      <section className="bg-white border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">
            Estado: <strong>{detail?.status}</strong> · Completado: {pct}%
          </p>
          <a className="text-sm underline" href={`/mi-negocio/${detail?.slug}?preview=true`} target="_blank" rel="noreferrer">
            👁️ Vista previa de la página
          </a>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {detail?.status !== 'PUBLISHED' && (
            <button type="button" disabled={busy} onClick={() => setStatus('PUBLISHED')}
              className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
              Publicar
            </button>
          )}
          {detail?.status === 'PUBLISHED' && (
            <button type="button" disabled={busy} onClick={() => setStatus('PAUSED')}
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
              Pausar
            </button>
          )}
          {detail?.status === 'PAUSED' && (
            <button type="button" disabled={busy} onClick={() => setStatus('PUBLISHED')}
              className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
              Reanudar
            </button>
          )}
          {detail?.status === 'DRAFT' && (
            <button type="button" disabled={busy} onClick={() => setStatus('ARCHIVED')}
              className="border rounded-lg px-3 py-1.5 disabled:opacity-50">
              Archivar
            </button>
          )}
        </div>
      </section>

      {msg && (
        <p className={`text-sm ${/error|revisa/i.test(msg) ? 'text-red-600' : 'text-green-700'}`}>{msg}</p>
      )}

      {/* Checklist de completitud */}
      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        {checks.map((c) => (
          <li key={c.label}
            className={`rounded-lg px-3 py-2 border ${c.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-neutral-50 text-neutral-500'}`}>
            {c.ok ? '✓' : '○'} {c.label}
          </li>
        ))}
      </ul>

      {/* Mercado Pago */}
      <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Mercado Pago</h3>
          {mpConnected
            ? <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Conectado</span>
            : <span className="text-xs bg-neutral-200 text-neutral-600 px-2 py-1 rounded-full">No conectado</span>}
        </div>
        {mpConnected && mpStatus?.mpUserId && <p className="text-xs text-neutral-500">ID de cuenta: {mpStatus.mpUserId}</p>}
        {mpConnected && mpStatus?.expiresAt && (
          <p className="text-xs text-neutral-500">Expira: {new Date(mpStatus.expiresAt).toLocaleDateString()}</p>
        )}
        {mpConnected ? (
          <button type="button" disabled={mpLoading} onClick={handleDisconnect}
            className="bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded-lg px-3 py-1.5 disabled:opacity-50">
            {mpLoading ? 'Desconectando…' : 'Desconectar Mercado Pago'}
          </button>
        ) : (
          <button type="button" disabled={mpLoading} onClick={handleConnect}
            className="bg-black hover:bg-neutral-800 text-white text-sm rounded-lg px-3 py-1.5 disabled:opacity-50">
            {mpLoading ? 'Conectando…' : 'Conectar Mercado Pago'}
          </button>
        )}
      </div>
      {/* Informacion basica */}
      <form onSubmit={saveInfo} className="bg-white border rounded-xl p-4 grid gap-2 sm:grid-cols-2">
        <h3 className="font-semibold sm:col-span-2">Información del negocio</h3>
        <input className="border rounded-lg px-3 py-2" placeholder="Nombre *" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="border rounded-lg px-3 py-2" placeholder="Slug (URL)" value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        <select className="border rounded-lg px-3 py-2" value={form.category}
          onChange={(e) => {
            const category = e.target.value;
            setForm({ ...form, category });
            setTemplatesState({ category, options: [] });
            setTemplateId('');
            setTemplatesStatus('loading');
          }}>
          {CATS.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
        </select>
        <input className="border rounded-lg px-3 py-2" placeholder="Teléfono" value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input className="border rounded-lg px-3 py-2" placeholder="WhatsApp" value={form.whatsapp}
          onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
        <input className="border rounded-lg px-3 py-2" placeholder="Email" type="email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="border rounded-lg px-3 py-2" placeholder="Dirección" value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <input className="border rounded-lg px-3 py-2" placeholder="Ciudad" value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })} />
        <input className="border rounded-lg px-3 py-2" placeholder="Región" value={form.region}
          onChange={(e) => setForm({ ...form, region: e.target.value })} />
        <input className="border rounded-lg px-3 py-2 sm:col-span-2" placeholder="URL de Google Maps" value={form.mapsUrl}
          onChange={(e) => setForm({ ...form, mapsUrl: e.target.value })} />
        <textarea className="border rounded-lg px-3 py-2 sm:col-span-2" rows={4} placeholder="Descripción"
          value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

        {/* Plantillas compatibles con la categoria */}
        <div className="sm:col-span-2 mt-2">
          <p className="text-sm font-semibold mb-2">Plantilla de la página</p>
          {templatesStatus === 'loading' ? (
            <p className="text-xs text-neutral-500" role="status" aria-live="polite">Cargando plantillas…</p>
          ) : templatesStatus === 'error' ? (
            <p className="text-xs text-red-600" role="alert">No pudimos cargar las plantillas. Intenta nuevamente.</p>
          ) : templates.length === 0 ? (
            <p className="text-xs text-neutral-500">
              No hay plantillas cargadas para esta categoría. Ejecuta <code>npm run db:seed:business</code> para sembrarlas.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {templates.map((t) => (
                <label key={t.id}
                  className={`border rounded-xl px-3 py-2.5 cursor-pointer text-sm flex items-start gap-2 ${
                    templateId === t.id ? 'border-black bg-neutral-50 ring-1 ring-black' : 'border-neutral-200 hover:border-neutral-400'
                  }`}>
                  <input type="radio" name="template" className="mt-0.5" checked={templateId === t.id}
                    onChange={() => setTemplateId(t.id)} />
                  <span>
                    <span className="font-semibold block">{t.name}</span>
                    <span className="text-xs text-neutral-500">{t.code} · {t.capabilities?.join(', ')}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Horarios */}
        <div className="sm:col-span-2 mt-2">
          <p className="text-sm font-semibold mb-2">Horarios</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {DAYS.map((d) => (
              <div key={d} className="flex items-center gap-2">
                <span className="text-xs w-20 text-neutral-500">{d}</span>
                <input className="border rounded-lg px-2 py-1.5 text-sm flex-1" placeholder="10:00 - 19:00 (vacío = cerrado)"
                  value={hours[d] || ''} onChange={(e) => setHours({ ...hours, [d]: e.target.value })} />
              </div>
            ))}
          </div>
        </div>

        {/* Redes sociales */}
        <div className="sm:col-span-2 mt-2">
          <p className="text-sm font-semibold mb-2">Redes sociales</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {(['instagram', 'facebook', 'tiktok', 'youtube'] as const).map((k) => (
              <input key={k} className="border rounded-lg px-3 py-2 text-sm" placeholder={k}
                value={socials[k]} onChange={(e) => setSocials({ ...socials, [k]: e.target.value })} />
            ))}
          </div>
        </div>

        {/* SEO */}
        <div className="sm:col-span-2 mt-2">
          <p className="text-sm font-semibold mb-2">SEO</p>
          <div className="grid gap-2">
            <input className="border rounded-lg px-3 py-2" placeholder="Título SEO (ej: Peluquería Luna | Temuco)"
              maxLength={160} value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
            <textarea className="border rounded-lg px-3 py-2" rows={2} maxLength={320}
              placeholder="Descripción SEO" value={form.seoDescription}
              onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} />
          </div>
        </div>

        <button className="bg-black text-white rounded-lg px-4 py-2 disabled:opacity-50 sm:col-span-2"
          type="submit" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </form>
      {/* Imagenes de marca */}
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
          {detail?.logo
            ? <img src={detail.logo} alt="Logo" className="w-14 h-14 rounded-full object-cover" />
            : <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center">🏷️</div>}
          <label className="underline cursor-pointer">
            Cambiar logo
            <input type="file" accept="image/*" className="hidden" disabled={busy}
              onChange={(e) => pickImage('logo', e.target.files?.[0])} />
          </label>
        </div>
        <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
          {detail?.cover
            ? <img src={detail.cover} alt="Portada" className="w-24 h-14 rounded-lg object-cover" />
            : <div className="w-24 h-14 rounded-lg bg-neutral-100 flex items-center justify-center">🏞️</div>}
          <label className="underline cursor-pointer">
            Cambiar portada
            <input type="file" accept="image/*" className="hidden" disabled={busy}
              onChange={(e) => pickImage('cover', e.target.files?.[0])} />
          </label>
        </div>
      </div>

      {/* Zona de peligro: borrado logico */}
      <section className="bg-white border border-red-200 rounded-xl p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-red-700">Archivar negocio</p>
          <p className="text-xs text-neutral-500">Borrado lógico: desaparece del público pero conserva tus datos.</p>
        </div>
        <button type="button" disabled={busy} onClick={archive}
          className="text-red-700 border border-red-300 rounded-lg px-3 py-1.5 text-sm hover:bg-red-50 disabled:opacity-50">
          Archivar
        </button>
      </section>
    </div>
  );
}