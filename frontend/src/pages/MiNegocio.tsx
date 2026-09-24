import { Suspense, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import BusinessLayout from '@/business/shared/BusinessLayout';
import BusinessPageRenderer from '@/business/BusinessPageRenderer';
import SeoHead from '@/business/shared/SeoHead';
import WhatsAppButton from '@/business/shared/WhatsAppButton';
import { getPublicBusiness, getPublicServices, getPublicProducts, getPublicProperties, getPublicGallery, getPublicContent, getPreviewBusiness, createLead, trackEvent, buildWaLink, type Business } from '@/services/business';

const LEAD_TYPES = [
  { value: 'CONSULTA', label: 'Consulta general' },
  { value: 'RESERVA', label: 'Reserva' },
  { value: 'COTIZACION', label: 'Cotización' },
  { value: 'PEDIDO', label: 'Pedido' },
] as const;

export default function MiNegocio() {
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const previewParam = searchParams.get('preview');
  const preview = Boolean(previewParam);
  const previewToken = previewParam && previewParam !== 'true' ? previewParam : null;
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [gallery, setGallery] = useState<any[]>([]);
  const [content, setContent] = useState<{ testimonials: any[]; faqs: any[]; promotions: any[]; team: any[]; bookingSlots: any[] }>({ testimonials: [], faqs: [], promotions: [], team: [], bookingSlots: [] });
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', message: '', type: 'CONSULTA' as string });
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (preview) {
          // Vista previa autenticada: el backend exige owner o ADMIN.
          const data = await getPreviewBusiness(slug, previewToken);
          if (!alive) return;
          setBusiness(data.business);
          setServices(data.services);
          setProducts(data.products.map((item: any) => ({ ...item, salePrice: item.price, images: item.image ? [item.image] : [], status: item.active ? 'PUBLISHED' : 'PAUSED' })));
          setProperties(data.properties);
          setGallery(data.gallery);
          if (data.testimonials) setContent(data);
          return;
        }
        const b = await getPublicBusiness(slug);
        if (!alive) return;
        setBusiness(b);
        trackEvent(slug, 'PAGE_VIEW');
        const [s, p, pr, g, c] = await Promise.all([
          getPublicServices(slug).catch(() => []),
          getPublicProducts(slug).catch(() => []),
          getPublicProperties(slug).catch(() => []),
          getPublicGallery(slug).catch(() => []),
          getPublicContent(slug).catch(() => ({ testimonials: [], faqs: [], promotions: [], team: [], bookingSlots: [] })),
        ]);
        if (!alive) return;
        setServices(s); setProducts(p.map((item: any) => ({ ...item, salePrice: item.price, images: item.image ? [item.image] : [], status: item.active ? 'PUBLISHED' : 'PAUSED' }))); setProperties(pr); setGallery(g); setContent(c);
      } catch {
        if (alive) setError(preview ? 'No tienes acceso a esta vista previa (inicia sesión como propietario o admin).' : 'Negocio no encontrado');
      }
    })();
    return () => { alive = false; };
  }, [slug, preview, previewToken]);

  if (error) return <div className="min-h-screen flex items-center justify-center p-6 text-center">{error}</div>;
  if (!business) return <div className="min-h-screen flex items-center justify-center animate-pulse">Cargando…</div>;

  const waMsg = `Hola ${business.name}, quiero más información.`;

  return (
    <BusinessLayout business={business}>
      {preview && (
        <div className="sticky top-0 z-50 bg-amber-400 text-amber-950 text-sm font-semibold px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          <span>👁️ Vista previa — Estado: {(business as any).status || 'DRAFT'} (no visible al público)</span>
          <span className="flex gap-3">
            <Link className="underline" to={`/negocio/configuracion?id=${business.id}`}>Volver al dashboard</Link>
            <Link className="underline" to={`/mi-negocio/${slug}`}>Salir de vista previa</Link>
          </span>
        </div>
      )}
      <SeoHead
        title={business.seoTitle || `${business.name}${business.city ? ` | ${business.city}` : ''}`}
        description={business.seoDescription || business.description?.slice(0, 160)}
        image={business.ogImage || business.cover}
        canonical={business.canonical || undefined}
      />
      <Suspense
        fallback={
          <div className="animate-pulse space-y-4 py-8">
            <div className="h-40 bg-neutral-200 rounded-2xl" />
            <div className="h-8 w-1/2 bg-neutral-200 rounded" />
            <div className="h-24 bg-neutral-200 rounded-2xl" />
          </div>
        }
      >
        <BusinessPageRenderer business={business} services={services} products={products} properties={properties} gallery={gallery} {...content} />
      </Suspense>
      <section className="bg-white rounded-xl border p-4">
        <h2 className="text-xl font-bold">Escríbenos</h2>
        {preview ? (
          <p className="mt-2 text-sm text-amber-700">
            Los formularios y la analítica están desactivados en vista previa. Publica el negocio para recibir leads reales.
          </p>
        ) : sent ? (
          <p className="mt-2 text-green-700">¡Gracias! Te contactaremos pronto.</p>
        ) : (
          <form
            className="mt-3 grid gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await createLead(slug, { type: form.type, name: form.name, phone: form.phone, message: form.message });
                setSent(true);
                trackEvent(slug, 'LEAD_CREATED');
              } catch {
                setSent(false);
              }
            }}
          >
            <select
              className="border rounded-lg px-3 py-2"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              aria-label="Tipo de consulta"
            >
              {LEAD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input className="border rounded-lg px-3 py-2" placeholder="Nombre" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="border rounded-lg px-3 py-2" placeholder="Teléfono" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <textarea className="border rounded-lg px-3 py-2" placeholder="Mensaje" value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })} />
            <div className="flex gap-2 flex-wrap">
              <button className="bg-black text-white rounded-lg px-4 py-2" type="submit">
                Enviar {LEAD_TYPES.find((t) => t.value === form.type)?.label.toLowerCase()}
              </button>
              <a
                className="bg-green-500 text-white rounded-lg px-4 py-2" target="_blank" rel="noreferrer"
                href={buildWaLink(business.whatsapp, waMsg)}
                onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
              >WhatsApp</a>
            </div>
          </form>
        )}
      </section>
      {!preview && (
        <WhatsAppButton phone={business.whatsapp} message={waMsg} slug={slug} />
      )}
    </BusinessLayout>
  );
}