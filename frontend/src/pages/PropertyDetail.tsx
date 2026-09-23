import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BedDouble, Bath, Car, Maximize, ArrowLeft } from 'lucide-react';
import BusinessLayout from '@/business/shared/BusinessLayout';
import SeoHead from '@/business/shared/SeoHead';
import WhatsAppButton from '@/business/shared/WhatsAppButton';
import { clp } from '@/business/shared/templateUtils';
import { getPublicBusiness, getPublicProperty, createLead, trackEvent, buildWaLink } from '@/services/business';

/** Detalle de propiedad: /mi-negocio/:slug/propiedad/:propertyId */
export default function PropertyDetail() {
  const { slug = '', propertyId = '' } = useParams();
  const [business, setBusiness] = useState<any>(null);
  const [property, setProperty] = useState<any>(null);
  const [error, setError] = useState('');
  const [imgIdx, setImgIdx] = useState(0);
  const [leadForm, setLeadForm] = useState({ name: '', phone: '', message: '' });
  const [leadSent, setLeadSent] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [b, p] = await Promise.all([getPublicBusiness(slug), getPublicProperty(slug, propertyId)]);
        setBusiness(b);
        setProperty(p);
        trackEvent(slug, 'PROPERTY_VIEW');
      } catch {
        setError('Propiedad no encontrada');
      }
    })();
  }, [slug, propertyId]);

  if (error) return <div className="min-h-screen flex items-center justify-center">{error}</div>;
  if (!property || !business) return <div className="min-h-screen flex items-center justify-center animate-pulse">Cargando…</div>;

  const images: string[] = (property.images || []).map((i: any) => i.url);
  const mainImg = images[imgIdx];
  const waMsg = `Hola ${business.name}, me interesa la propiedad: ${property.title} (${clp(property.price)})`;
  const mapHref =
    property.lat != null && property.lng != null
      ? `https://www.google.com/maps?q=${property.lat},${property.lng}&z=15&output=embed`
      : null;

  return (
    <BusinessLayout business={business}>
      <SeoHead
        title={`${property.title} | ${business.name}`}
        description={property.description?.slice(0, 160) || `${property.operation} — ${property.city || ''}`}
        image={mainImg || business.ogImage || business.cover}
        canonical={business.canonical || undefined}
      />
      <Link
        to={`/mi-negocio/${slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-black mb-4"
      >
        <ArrowLeft size={15} /> Volver a {business.name}
      </Link>

      <div className="grid lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-3 space-y-3">
          {mainImg ? (
            <img src={mainImg} alt={property.title} className="w-full h-[320px] sm:h-[440px] object-cover rounded-2xl" />
          ) : (
            <div className="w-full h-[320px] bg-neutral-200 rounded-2xl flex items-center justify-center text-neutral-400">Sin fotos</div>
          )}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((url, i) => (
                <button
                  key={url + i}
                  onClick={() => setImgIdx(i)}
                  className={`shrink-0 rounded-lg overflow-hidden border-2 ${i === imgIdx ? 'border-blue-600' : 'border-transparent'}`}
                >
                  <img src={url} alt={`${property.title} ${i + 1}`} className="w-24 h-16 object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="lg:col-span-2 bg-white border rounded-2xl p-6 space-y-4 lg:sticky lg:top-20">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full text-white ${property.operation === 'VENTA' ? 'bg-blue-600' : 'bg-emerald-600'}`}>
              {property.operation === 'ARRIENDO' ? 'Arriendo' : 'Venta'}
            </span>
            <span className="text-xs bg-neutral-100 rounded-full px-2.5 py-1">{property.type}</span>
          </div>
          <p className="text-3xl font-extrabold text-blue-950">
            {clp(property.price)} {property.operation === 'ARRIENDO' && <span className="text-base font-medium text-neutral-500">/mes</span>}
          </p>
          <h1 className="text-xl font-bold">{property.title}</h1>
          <p className="text-sm text-neutral-500">{[property.address, property.city, property.region].filter(Boolean).join(', ')}</p>

          <div className="grid grid-cols-2 gap-2 text-sm">
            {property.bedrooms != null && (
              <span className="inline-flex items-center gap-2 bg-neutral-50 rounded-lg px-3 py-2"><BedDouble size={15} /> {property.bedrooms} dorm</span>
            )}
            {property.bathrooms != null && (
              <span className="inline-flex items-center gap-2 bg-neutral-50 rounded-lg px-3 py-2"><Bath size={15} /> {property.bathrooms} baños</span>
            )}
            {property.parking != null && (
              <span className="inline-flex items-center gap-2 bg-neutral-50 rounded-lg px-3 py-2"><Car size={15} /> {property.parking} est.</span>
            )}
            {(property.areaTotal || property.areaBuilt) && (
              <span className="inline-flex items-center gap-2 bg-neutral-50 rounded-lg px-3 py-2">
                <Maximize size={15} /> {property.areaTotal || property.areaBuilt} m²
              </span>
            )}
          </div>

          <a
            href={buildWaLink(business.whatsapp, waMsg)}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
            className="block text-center rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold py-3"
          >
            Consultar propiedad
          </a>
          {business.phone && (
            <a href={`tel:${business.phone}`} onClick={() => trackEvent(slug, 'PHONE_CLICK')} className="block text-center text-sm text-neutral-600 underline underline-offset-4">
              {business.phone}
            </a>
          )}
        </aside>
      </div>

      {property.description && (
        <section className="mt-8">
          <h2 className="text-lg font-bold mb-2">Descripción</h2>
          <p className="text-neutral-600 whitespace-pre-line leading-relaxed">{property.description}</p>
        </section>
      )}

      {/* Lead de tipo PROPERTY_INQUIRY: consulta de propiedad por el formulario. */}
      <section className="mt-8 bg-white border rounded-2xl p-5 max-w-xl">
        <h2 className="text-lg font-bold mb-1">Dejar contacto</h2>
        <p className="text-sm text-neutral-500 mb-3">Te contactaremos sobre «{property.title}».</p>
        {leadSent ? (
          <p className="text-green-700 text-sm">¡Gracias! Te contactaremos pronto.</p>
        ) : (
          <form
            className="grid gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await createLead(slug, {
                  type: 'PROPERTY_INQUIRY',
                  name: leadForm.name,
                  phone: leadForm.phone,
                  message: leadForm.message || `Me interesa la propiedad: ${property.title}`,
                  payload: { propertyId: property.id, propertyTitle: property.title },
                });
                setLeadSent(true);
                trackEvent(slug, 'LEAD_CREATED');
              } catch {
                setLeadSent(false);
              }
            }}
          >
            <input className="border rounded-lg px-3 py-2" placeholder="Nombre" required
              value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} />
            <input className="border rounded-lg px-3 py-2" placeholder="Teléfono" required
              value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} />
            <textarea className="border rounded-lg px-3 py-2" rows={3} placeholder="Mensaje (opcional)"
              value={leadForm.message} onChange={(e) => setLeadForm({ ...leadForm, message: e.target.value })} />
            <button className="bg-black text-white rounded-lg px-4 py-2" type="submit">Consultar propiedad</button>
          </form>
        )}
      </section>

      {!!property.features?.length && (
        <section className="mt-6">
          <h2 className="text-lg font-bold mb-2">Características</h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {property.features.map((f: string) => (
              <li key={f} className="bg-white border rounded-lg px-3 py-2 text-sm">{f}</li>
            ))}
          </ul>
        </section>
      )}

      {(mapHref || property.agent) && (
        <section className="mt-8 grid sm:grid-cols-2 gap-6">
          {property.agent && (
            <div className="bg-white border rounded-2xl p-5">
              <h2 className="text-lg font-bold mb-2">Agente</h2>
              <p className="text-neutral-700">{property.agent}</p>
              <p className="text-sm text-neutral-500 mt-1">{business.name}</p>
            </div>
          )}
          {mapHref && (
            <div className="bg-white border rounded-2xl overflow-hidden">
              <iframe title="Mapa" src={mapHref} className="w-full h-64 border-0" loading="lazy" />
            </div>
          )}
        </section>
      )}

      <div className="h-14" />
      <WhatsAppButton phone={business.whatsapp} message={waMsg} slug={slug} label="Consultar propiedad" />
    </BusinessLayout>
  );
}
