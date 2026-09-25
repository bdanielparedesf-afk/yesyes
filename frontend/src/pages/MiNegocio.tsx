import { Suspense, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import BusinessShell from '@/business/BusinessShell';
import BusinessPageRenderer from '@/business/BusinessPageRenderer';
import SeoHead from '@/business/shared/SeoHead';
import { getPreviewBusiness, getPublicPage, trackEvent, type Business } from '@/services/business';

type Content = { testimonials: any[]; faqs: any[]; promotions: any[]; team: any[]; bookingSlots: any[] };
const emptyContent: Content = { testimonials: [], faqs: [], promotions: [], team: [], bookingSlots: [] };
const normalizeProducts = (items: any[]) => items.map((item) => ({ ...item, salePrice: item.price, images: item.image ? [item.image] : [], status: item.active ? 'PUBLISHED' : 'PAUSED' }));

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
  const [content, setContent] = useState<Content>(emptyContent);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!preview) return;
    const receivePreview = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'YESYES_BUSINESS_PREVIEW') return;
      setBusiness((current) => current ? { ...current, visual: { ...current.visual, ...(event.data.visual || {}), sections: event.data.sections || current.visual?.sections }, template: event.data.templateCode && current.template ? { ...current.template, code: String(event.data.templateCode) } : current.template } : current);
    };
    window.addEventListener('message', receivePreview);
    return () => window.removeEventListener('message', receivePreview);
  }, [preview]);

  useEffect(() => {
    let alive = true;
    setError('');
    const load = async () => {
      try {
        if (preview) {
          const data = await getPreviewBusiness(slug, previewToken);
          if (!alive) return;
          setBusiness(data.business); setServices(data.services || []); setProducts(normalizeProducts(data.products || []));
          setProperties(data.properties || []); setGallery(data.gallery || []);
          setContent({ testimonials: data.testimonials || [], faqs: data.faqs || [], promotions: data.promotions || [], team: data.team || [], bookingSlots: data.bookingSlots || [] });
          return;
        }
        const data = await getPublicPage(slug);
        if (!alive) return;
        setBusiness(data.business); setServices(data.services || []); setProducts(normalizeProducts(data.products || []));
        setProperties(data.properties || []); setGallery(data.gallery || []);
        setContent({ testimonials: data.testimonials || [], faqs: data.faqs || [], promotions: data.promotions || [], team: data.team || [], bookingSlots: data.bookingSlots || [] });
        void trackEvent(slug, 'PAGE_VIEW');
      } catch (cause) {
        if (!alive) return;
        const status = (cause as any)?.response?.status;
        setError(status === 401 || status === 403
          ? 'Inicia sesión como propietario o administrador para abrir esta vista previa.'
          : status === 404
            ? (preview ? 'La vista previa no existe o venció.' : 'No encontramos este negocio.')
            : 'No pudimos conectar con el servicio. Intenta nuevamente.');
      }
    };
    void load();
    return () => { alive = false; };
  }, [slug, preview, previewToken]);

  if (error) return <main className="grid min-h-screen place-items-center bg-stone-50 px-4 text-center"><div><h1 className="text-3xl font-bold text-stone-900">No pudimos mostrar esta página</h1><p className="mt-2 text-stone-600">{error}</p><Link className="mt-6 inline-flex rounded-xl bg-stone-900 px-5 py-3 font-semibold text-white" to="/">Volver al inicio</Link></div></main>;
  if (!business) return <main className="min-h-screen bg-stone-50 p-6" aria-busy="true" aria-label="Cargando página"><div className="mx-auto max-w-6xl animate-pulse space-y-5"><div className="h-72 rounded-3xl bg-stone-200" /><div className="h-9 w-1/2 rounded bg-stone-200" /><div className="h-40 rounded-3xl bg-stone-200" /></div></main>;

  return <BusinessShell business={business} preview={preview}>
    <SeoHead title={business.seoTitle || `${business.name}${business.city ? ` | ${business.city}` : ''}`} description={business.seoDescription || business.description?.slice(0, 160)} image={business.ogImage || business.cover} canonical={business.canonical || undefined} />
    {preview && <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-2 text-sm"><Link className="font-semibold text-stone-700" to={`/negocio/configuracion?id=${business.id}`}>Volver a editar</Link><Link className="text-stone-600 hover:underline" to={`/mi-negocio/${slug}`}>Salir de vista previa</Link></div>}
    <Suspense fallback={<div className="mx-auto max-w-6xl animate-pulse px-4 py-20"><div className="h-72 rounded-3xl bg-stone-200" /></div>}>
      <BusinessPageRenderer business={business} services={services} products={products} properties={properties} gallery={gallery} {...content} preview={preview} />
    </Suspense>
  </BusinessShell>;
}