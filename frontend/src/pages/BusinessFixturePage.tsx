import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import BusinessShell from '@/business/BusinessShell';
import BusinessPageRenderer from '@/business/BusinessPageRenderer';
import { categoryLabel } from '@/business/businessLabels';
import { ALL_BUSINESS_CATEGORY_CODES, isKnownCategoryCode } from '@/business/taxonomy';
import { buildPreviewFixture } from '@/business/fixtures/previewFixture';

const CATEGORIES = ALL_BUSINESS_CATEGORY_CODES;
const VARIANTS = [{ id: 'EDITORIAL', label: 'Esencial' }, { id: 'ATLAS', label: 'Dirección' }, { id: 'NATIVE', label: 'Cercano' }];

export default function BusinessFixturePage() {
  const { category: categoryParam = 'FLOWERS' } = useParams();
  const [params, setParams] = useSearchParams();
  const requested = String(categoryParam).toUpperCase().replace(/-/g, '_');
  const selectedCategory = String(params.get('category') || requested).toUpperCase().replace(/-/g, '_');
  const category = isKnownCategoryCode(selectedCategory) ? selectedCategory : 'FLOWERS';
  const variant = VARIANTS.some((item) => item.id === params.get('variant')) ? params.get('variant')! : 'EDITORIAL';
  if (!import.meta.env.DEV) return <Navigate to="/404" replace />;
  // Mismo builder de contenido que usa la galería de diseños: una sola fuente.
  const { business, services, products, properties, gallery, testimonials, faqs, promotions, team, bookingSlots } =
    buildPreviewFixture(category, `${category}_SIGNATURE_${variant}`);

  const select = (key: string, value: string) => { const next = new URLSearchParams(params); next.set(key, value); setParams(next, { replace: true }); };
  return <TestPreview business={business} services={services} products={products} properties={properties} gallery={gallery} testimonials={testimonials} faqs={faqs} promotions={promotions} team={team} bookingSlots={bookingSlots} category={category} variant={variant} select={select} />;
}

function TestPreview({ business, services, products, properties, gallery, testimonials, faqs, promotions, team, bookingSlots, category, variant, select }: any) {
  return <div className="min-h-screen bg-stone-900"><div className="sticky top-0 z-[60] border-b border-white/10 bg-stone-950/95 px-4 py-3 text-white backdrop-blur"><div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3"><strong className="mr-auto text-sm">QA · Todos los campos completos</strong><label className="text-xs">Rubro <select className="ml-2 rounded-lg bg-white/10 p-2" value={category} onChange={(e) => select('category', e.target.value)}>{CATEGORIES.map((item) => <option key={item} value={item}>{categoryLabel(item)}</option>)}</select></label><label className="text-xs">Diseño <select className="ml-2 rounded-lg bg-white/10 p-2" value={variant} onChange={(e) => select('variant', e.target.value)}>{VARIANTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label></div></div><BusinessShell business={business}><BusinessPageRenderer business={business} services={services} products={products} properties={properties} gallery={gallery} testimonials={testimonials} faqs={faqs} promotions={promotions} team={team} bookingSlots={bookingSlots} preview /></BusinessShell></div>;
}
