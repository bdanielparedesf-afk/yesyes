import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import BusinessLayout from '@/business/shared/BusinessLayout';
import SeoHead from '@/business/shared/SeoHead';
import WhatsAppButton from '@/business/shared/WhatsAppButton';
import { resolveTemplate } from '@/business/registry';
import { getPublicBusiness, getPublicServices, getPublicProducts, getPublicProperties, getPublicGallery, createLead, trackEvent, buildWaLink } from '@/services/business';

export default function MiNegocio() {
  const { slug = '' } = useParams();
  const [business, setBusiness] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [gallery, setGallery] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', message: '' });
  const [sent, setSent] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const b = await getPublicBusiness(slug);
        setBusiness(b);
        trackEvent(slug, 'PAGE_VIEW');
        const [s, p, pr, g] = await Promise.all([
          getPublicServices(slug).catch(() => []),
          getPublicProducts(slug).catch(() => []),
          getPublicProperties(slug).catch(() => []),
          getPublicGallery(slug).catch(() => []),
        ]);
        setServices(s); setProducts(p); setProperties(pr); setGallery(g);
      } catch {
        setError('Negocio no encontrado');
      }
    })();
  }, [slug]);

  if (error) return <div className="min-h-screen flex items-center justify-center">{error}</div>;
  if (!business) return <div className="min-h-screen flex items-center justify-center animate-pulse">Cargando…</div>;

  const Template = resolveTemplate(business?.template?.code);
  const waMsg = `Hola ${business.name}, quiero más información.`;

  return (
    <BusinessLayout business={business}>
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
        <Template business={business} services={services} products={products} properties={properties} gallery={gallery} />
      </Suspense>
      <section className="bg-white rounded-xl border p-4">
        <h2 className="text-xl font-bold">Escríbenos</h2>
        {sent ? (
          <p className="mt-2 text-green-700">¡Gracias! Te contactaremos pronto.</p>
        ) : (
          <form
            className="mt-3 grid gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await createLead(slug, { type: 'CONSULTA', ...form });
              setSent(true);
              trackEvent(slug, 'LEAD_CREATED');
            }}
          >
            <input className="border rounded-lg px-3 py-2" placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="border rounded-lg px-3 py-2" placeholder="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <textarea className="border rounded-lg px-3 py-2" placeholder="Mensaje" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            <div className="flex gap-2">
              <button className="bg-black text-white rounded-lg px-4 py-2" type="submit">Enviar consulta</button>
              <a className="bg-green-500 text-white rounded-lg px-4 py-2" target="_blank" rel="noreferrer" href={buildWaLink(business.whatsapp, waMsg)} onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}>WhatsApp</a>
            </div>
          </form>
        )}
      </section>
      <WhatsAppButton phone={business.whatsapp} message={waMsg} slug={slug} />
    </BusinessLayout>
  );
}
