import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  AlertCircle, Check, ChevronRight, CreditCard, Loader2, RefreshCw, Shield, ShoppingCart, Truck,
} from 'lucide-react';
import { getProductBySlug, toNormalizedVariant } from '@/services/products';
import type { Product, ProductVariant } from '@/services/products';
import { buildVariantEngine, type VariantCombination } from '@/utils/variantEngine';
import { cleanDescription } from '@/lib/html-utils';
import {
  firstSentences, formatCLP, formatDimensions, formatPercent, normalizeProductTitle,
  publicTags, sanitizeSkuForDisplay, stockStatus,
} from '@/utils/productPresentation';
import { useCartStore } from '@/store/useCartStore';
import ProductGallery from '@/components/product/ProductGallery';
import ProductVariantSelector from '@/components/product/ProductVariantSelector';
import QuantityStepper from '@/components/product/QuantityStepper';
import Accordion from '@/components/product/Accordion';
import ProductRating from '@/components/product/ProductRating';
import ProductDetailSkeleton from '@/components/product/ProductDetailSkeleton';
import MobileBuyBar from '@/components/product/MobileBuyBar';
import RelatedProducts from '@/components/product/RelatedProducts';

const LOW_STOCK_THRESHOLD = 5;
const ADDED_FEEDBACK_MS = 1800;
const ACTION_FEEDBACK_MS = 300;

type LoadState = 'loading' | 'ready' | 'not_found' | 'error';

const STOCK_TONES: Record<string, string> = {
  in_stock: 'bg-emerald-50 text-emerald-700',
  low_stock: 'bg-amber-50 text-amber-700',
  out_of_stock: 'bg-rose-50 text-rose-600',
};

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const addItem = useCartStore((s) => s.addItem);

  const [product, setProduct] = useState<Product | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [retryKey, setRetryKey] = useState(0);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const addedTimer = useRef<number | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!slug) { setState('not_found'); return; }
    let alive = true;
    setState('loading');
    setProduct(null);
    setSelection({});
    setQuantity(1);
    setMainImage(null);
    window.scrollTo({ top: 0, behavior: 'auto' });
    getProductBySlug(slug)
      .then((data) => {
        if (!alive) return;
        if (!data) { setState('not_found'); return; }
        setProduct(data);
        setState('ready');
      })
      .catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [slug, retryKey]);

  useEffect(() => () => {
    if (addedTimer.current) window.clearTimeout(addedTimer.current);
  }, []);

  /** Motor de variantes: agnostico de proveedor y calculado una sola vez. */
  const engine = useMemo(
    () => buildVariantEngine<ProductVariant>(product?.productVariants ?? [], toNormalizedVariant),
    [product?.productVariants],
  );

  useEffect(() => {
    if (!product) return;
    setSelection(engine.hasVariants ? engine.defaultSelection() : {});
  }, [product, engine]);

  const combination: VariantCombination | null = useMemo(() => {
    if (!product) return null;
    if (!engine.hasVariants) return engine.first;
    return engine.find(selection);
  }, [engine, product, selection]);

  const displayName = useMemo(
    () => normalizeProductTitle(product?.name) || product?.name || '',
    [product?.name],
  );

  const price = Number(combination?.price || product?.price || 0);
  const stock = Math.max(0, Math.floor(combination ? combination.stock : product?.stock ?? 0));
  const compareAtPrice = Number(product?.compareAtPrice || 0);
  const hasDiscount = compareAtPrice > price && price > 0;
  const discountPercent = hasDiscount ? formatPercent(((compareAtPrice - price) / compareAtPrice) * 100) : 0;
  const status = stockStatus(stock, LOW_STOCK_THRESHOLD);
  const unavailableCombination = Boolean(product && engine.hasVariants && !combination);
  const canBuy = Boolean(product) && !unavailableCombination && status.kind !== 'out_of_stock';

  const gallery = useMemo(() => {
    const list: string[] = [];
    const push = (value?: string | null) => {
      const url = String(value ?? '').trim();
      if (url && !list.includes(url)) list.push(url);
    };
    if (combination?.image) push(combination.image);
    push(product?.image);
    (product?.productImages || []).forEach((img) => push(img.url));
    return list;
  }, [combination?.image, product?.image, product?.productImages]);

  const selectionLabel = useMemo(
    () => engine.describe(selection).map((a) => `${a.name}: ${a.value}`).join(' · '),
    [engine, selection],
  );
  const variantLabel = selectionLabel || undefined;

  const descriptionText = useMemo(
    () => cleanDescription(product?.description || ''),
    [product?.description],
  );
  const features = useMemo(() => publicTags(product?.tags), [product?.tags]);

  const reviewSummary = useMemo(() => {
    const reviews = product?.reviews ?? [];
    if (!reviews.length) return null;
    const total = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return { count: reviews.length, average: total / reviews.length, items: reviews.slice(0, 3) };
  }, [product?.reviews]);

  const specs = useMemo(() => {
    if (!product) return [];
    const rows: { label: string; value: string }[] = [];
    if (product.category) rows.push({ label: 'Categoría', value: product.category });
    if (product.collection?.name) rows.push({ label: 'Colección', value: product.collection.name });
    engine.attributes.forEach((group) => {
      const value = selection[group.name];
      if (value) rows.push({ label: group.name, value });
    });
    const sku = sanitizeSkuForDisplay(combination?.sku);
    if (sku) rows.push({ label: 'Código', value: sku });
    if (product.weight) rows.push({ label: 'Peso', value: `${product.weight} kg` });
    const dimensions = formatDimensions(product.dimensions);
    if (dimensions) rows.push({ label: 'Dimensiones', value: dimensions });
    rows.push({ label: 'Despacho', value: '15-25 días hábiles a todo Chile' });
    return rows;
  }, [combination?.sku, engine.attributes, product, selection]);

  const handleSelect = useCallback((attribute: string, value: string) => {
    setSelection((prev) => engine.reconcile({ ...prev, [attribute]: value }, attribute));
  }, [engine]);

  const resetFeedback = useCallback(() => {
    if (addedTimer.current) window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAdded(false), ADDED_FEEDBACK_MS);
  }, []);

  const addToCart = useCallback((navigateToCheckout = false) => {
    if (!product || !combination || !canBuy || busy) return;
    const maxQuantity = Math.max(1, stock);
    const payload = {
      id: `${product.id}::${combination.id}`,
      name: displayName || product.name,
      price,
      image: mainImage || combination.image || product.image,
      imageHover: product.imageHover,
      stock: maxQuantity,
      providerPrice: product.providerPrice,
      quantity: Math.min(Math.max(1, quantity), maxQuantity),
      variant: variantLabel,
      productId: product.id,
      variantId: combination.id,
      sku: sanitizeSkuForDisplay(combination.sku) ?? undefined,
      attributes: engine.describe(selection),
    };
    if (navigateToCheckout) {
      addItem(payload);
      navigate('/checkout');
      return;
    }
    setBusy(true);
    // Microinteraccion breve: evita dobles clics y confirma visualmente la accion.
    window.setTimeout(() => {
      addItem(payload);
      setBusy(false);
      setAdded(true);
      resetFeedback();
      toast.success('Producto agregado al carrito');
    }, ACTION_FEEDBACK_MS);
  }, [busy, canBuy, combination, displayName, engine, mainImage, navigate, price, product, quantity,
    resetFeedback, selection, stock, variantLabel]);

  useEffect(() => { setQuantity(1); }, [combination?.id]);

  useEffect(() => {
    if (!product) return;
    const previous = document.title;
    document.title = displayName ? `${displayName} | YesYes` : previous;
    return () => { document.title = previous; };
  }, [displayName, product]);

  useEffect(() => {
    if (state !== 'ready') { setBarVisible(false); return; }
    const node = actionsRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => setBarVisible(!(entries[0]?.isIntersecting ?? true)),
      { rootMargin: '0px 0px -64px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [state]);

  if (state === 'loading') return <ProductDetailSkeleton />;

  if (state === 'not_found') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-bold text-neutral-900">Producto no encontrado</h1>
          <p className="text-neutral-500">El producto que buscas no está disponible o fue retirado.</p>
          <Link
            to="/productos"
            className="inline-flex items-center rounded-full bg-primary-700 px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-800"
          >
            Ver productos
          </Link>
        </div>
      </div>
    );
  }

  if (state === 'error' || !product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="max-w-md space-y-4 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-amber-500" aria-hidden />
          <h1 className="text-xl font-bold text-neutral-900">No pudimos cargar el producto</h1>
          <p className="text-neutral-500">Revisa tu conexión e inténtalo nuevamente.</p>
          <button
            type="button"
            onClick={() => setRetryKey((key) => key + 1)}
            className="inline-flex items-center gap-2 rounded-full bg-primary-700 px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-800"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-safe-bar lg:pb-8">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
        {/* Breadcrumbs */}
        <nav aria-label="Ruta de navegación" className="mb-4 flex items-center gap-1.5 text-xs text-neutral-500 sm:mb-6 sm:text-sm">
          <Link to="/" className="transition-colors hover:text-neutral-900">Inicio</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-300" aria-hidden />
          <Link
            to={`/categoria/${product.categorySlug || 'general'}`}
            className="truncate transition-colors hover:text-neutral-900"
          >
            {product.category}
          </Link>
          <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-neutral-300 sm:block" aria-hidden />
          <span className="hidden truncate text-neutral-900 sm:block" aria-current="page">{displayName}</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start lg:gap-10 xl:gap-14">
          {/* Galeria */}
          <div className="lg:sticky lg:top-20">
            <ProductGallery
              images={gallery}
              video={product.video}
              title={displayName}
              focusImage={combination?.image ?? null}
              onChange={setMainImage}
              overlay={hasDiscount ? (
                <span className="absolute left-3 top-3 z-10 rounded-full bg-accent-600 px-2.5 py-1 text-xs font-bold text-white shadow-md">
                  -{discountPercent}%
                </span>
              ) : !canBuy ? (
                <span className="absolute left-3 top-3 z-10 rounded-full bg-neutral-900/80 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                  Agotado
                </span>
              ) : null}
            />
          </div>

          {/* Informacion */}
          <div className="space-y-5 sm:space-y-6">
            <div className="space-y-3">
              <Link
                to={`/categoria/${product.categorySlug || 'general'}`}
                className="inline-block rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-800 transition-colors hover:bg-primary-100"
              >
                {product.category}
              </Link>
              <h1 className="text-xl font-bold leading-snug tracking-tight text-neutral-900 sm:text-2xl lg:text-[1.75rem]">
                {displayName}
              </h1>
              {reviewSummary ? (
                <ProductRating average={reviewSummary.average} count={reviewSummary.count} size="md" />
              ) : null}
            </div>

            {/* Precio y descuento */}
            <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-1" aria-live="polite">
                <span
                  key={price}
                  className="animate-price-pop text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl"
                >
                  {price > 0 ? formatCLP(price) : 'Precio no disponible'}
                </span>
                {hasDiscount ? (
                  <>
                    <span className="mb-1.5 rounded-md bg-accent-100 px-1.5 py-0.5 text-xs font-bold text-accent-700">
                      -{discountPercent}%
                    </span>
                    <span className="mb-1 text-sm text-neutral-400 line-through">
                      {formatCLP(compareAtPrice)}
                    </span>
                  </>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STOCK_TONES[status.kind]}`}>
                  {status.kind === 'out_of_stock'
                    ? <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                    : <Check className="h-3.5 w-3.5" aria-hidden />}
                  {status.label}
                </span>
                {status.detail ? <span className="text-xs text-neutral-500">{status.detail}</span> : null}
              </div>
            </div>

            {/* Variantes */}
            {engine.hasVariants ? (
              <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm sm:p-5">
                <ProductVariantSelector engine={engine} selection={selection} onSelect={handleSelect} />
                {variantLabel ? (
                  <p className="mt-4 border-t border-neutral-100 pt-3 text-sm text-neutral-500">
                    Selección: <span className="font-medium text-neutral-800">{variantLabel}</span>
                  </p>
                ) : null}
                {unavailableCombination ? (
                  <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                    Esa combinación no está disponible. Elige otra opción.
                  </p>
                ) : null}
                {combination && status.kind === 'out_of_stock' ? (
                  <p className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                    Esta combinación está agotada por ahora.
                  </p>
                ) : null}
              </div>
            ) : engine.invalid ? (
              <p className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                No pudimos cargar las opciones de este producto. Inténtalo nuevamente.
              </p>
            ) : null}

            {/* Cantidad y acciones */}
            <div className="space-y-4">
              {canBuy ? (
                <QuantityStepper
                  value={quantity}
                  max={Math.max(1, stock)}
                  onChange={setQuantity}
                  hint={status.kind === 'low_stock' ? status.detail : null}
                />
              ) : null}

              <div ref={actionsRef} className="flex flex-col gap-2.5 sm:flex-row">
                <button
                  type="button"
                  onClick={() => addToCart(false)}
                  disabled={!canBuy || busy}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary-700 px-6 text-sm font-semibold text-white shadow-md transition-all duration-150 hover:bg-primary-800 hover:shadow-lg active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500 disabled:shadow-none sm:text-base"
                >
                  {busy
                    ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    : added
                      ? <Check className="h-5 w-5" aria-hidden />
                      : <ShoppingCart className="h-5 w-5" aria-hidden />}
                  {busy ? 'Agregando…' : added ? 'Agregado al carrito' : 'Agregar al carrito'}
                </button>
                <button
                  type="button"
                  onClick={() => addToCart(true)}
                  disabled={!canBuy || busy}
                  className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-primary-700 bg-white px-6 text-sm font-semibold text-primary-800 transition-all duration-150 hover:bg-primary-50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400 disabled:hover:bg-white sm:text-base"
                >
                  {canBuy ? 'Comprar ahora' : 'Sin stock'}
                </button>
              </div>

              <p aria-live="polite" className="min-h-[1.25rem] text-sm text-emerald-700">
                {added ? (
                  <>
                    ✓ Producto agregado.{' '}
                    <Link to="/carrito" className="font-semibold underline decoration-emerald-300 underline-offset-2 hover:text-emerald-800">
                      Ver carrito
                    </Link>
                  </>
                ) : null}
              </p>
            </div>

            {/* Beneficios */}
            <ul className="grid gap-2.5 rounded-2xl border border-neutral-100 bg-white p-4 text-sm text-neutral-600 shadow-sm sm:p-5">
              <li className="flex items-start gap-3">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" aria-hidden />
                <span><b className="font-semibold text-neutral-800">Envío</b> 15-25 días hábiles a todo Chile.</span>
              </li>
              <li className="flex items-start gap-3">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" aria-hidden />
                <span><b className="font-semibold text-neutral-800">Garantía legal</b> 6 meses por falla de fábrica.</span>
              </li>
              <li className="flex items-start gap-3">
                <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" aria-hidden />
                <span><b className="font-semibold text-neutral-800">Pago seguro</b> con Mercado Pago.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Detalle del producto */}
        <div className="mt-8 grid gap-6 lg:mt-12 lg:grid-cols-3 lg:gap-8">
          <section className="lg:col-span-2" aria-labelledby="detail-title">
            <h2 id="detail-title" className="sr-only">Detalle del producto</h2>
            <div className="rounded-[var(--radius-xl)] border border-neutral-100 bg-white px-5 shadow-sm sm:px-6">
              {descriptionText ? (
                <Accordion title="Descripción" defaultOpen>
                  <p className="whitespace-pre-line">
                    {descriptionOpen ? descriptionText : firstSentences(descriptionText, 320)}
                  </p>
                  {descriptionText.length > 320 ? (
                    <button
                      type="button"
                      onClick={() => setDescriptionOpen((prev) => !prev)}
                      className="mt-3 text-sm font-semibold text-primary-800 transition-colors hover:text-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
                    >
                      {descriptionOpen ? 'Ver menos' : 'Ver más'}
                    </button>
                  ) : null}
                </Accordion>
              ) : null}

              {features.length ? (
                <Accordion title="Características">
                  <ul className="space-y-1.5">
                    {features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </Accordion>
              ) : null}

              {specs.length ? (
                <Accordion title="Especificaciones">
                  <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                    {specs.map((row) => (
                      <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-neutral-100 py-1.5 last:border-0">
                        <dt className="text-neutral-500">{row.label}</dt>
                        <dd className="text-right font-medium text-neutral-800">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </Accordion>
              ) : null}

              <Accordion title="Envío y entrega">
                <p>Despachamos a todo Chile en 15-25 días hábiles con seguimiento. El envío se calcula en el checkout y es gratis en compras sobre $50.000.</p>
              </Accordion>

              <Accordion title="Garantía y devoluciones">
                <p>Cubrimos 6 meses de garantía legal por falla de fábrica (Ley 19.496) y aceptamos devoluciones dentro de los 10 días posteriores a la recepción si el producto llega con problemas.</p>
              </Accordion>
            </div>
          </section>

          <aside className="space-y-4">
            {reviewSummary ? (
              <section aria-labelledby="reviews-title" className="rounded-[var(--radius-xl)] border border-neutral-100 bg-white p-5 shadow-sm">
                <h2 id="reviews-title" className="text-base font-bold tracking-tight text-neutral-900">Opiniones de clientes</h2>
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-3xl font-extrabold tracking-tight text-neutral-900">
                    {reviewSummary.average.toFixed(1)}
                  </span>
                  <div>
                    <ProductRating average={reviewSummary.average} count={reviewSummary.count} showCount={false} size="md" />
                    <p className="mt-0.5 text-xs text-neutral-500">{reviewSummary.count} reseñas</p>
                  </div>
                </div>
                <ul className="mt-4 space-y-4 border-t border-neutral-100 pt-4">
                  {reviewSummary.items.map((review) => (
                    <li key={review.id} className="space-y-1">
                      <ProductRating average={review.rating} count={1} showCount={false} />
                      {review.comment ? <p className="text-sm text-neutral-600">{review.comment}</p> : null}
                      {review.verifiedPurchase ? (
                        <p className="text-[11px] font-medium text-emerald-600">Compra verificada</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="protected-title" className="rounded-[var(--radius-xl)] border border-neutral-100 bg-white p-5 shadow-sm">
              <h2 id="protected-title" className="text-base font-bold tracking-tight text-neutral-900">Compra protegida</h2>
              <ul className="mt-3 space-y-2.5 text-sm text-neutral-600">
                <li className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" aria-hidden />
                  Pago procesado por Mercado Pago.
                </li>
                <li className="flex items-start gap-2">
                  <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" aria-hidden />
                  Seguimiento de tu pedido en cada etapa.
                </li>
                <li className="flex items-start gap-2">
                  <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" aria-hidden />
                  Soporte por WhatsApp y correo.
                </li>
              </ul>
            </section>
          </aside>
        </div>

        <RelatedProducts categorySlug={product.categorySlug} excludeId={product.id} />
      </div>

      <MobileBuyBar
        price={price}
        compareAtPrice={compareAtPrice}
        visible={barVisible}
        disabled={!canBuy}
        busy={busy}
        added={added}
        onAdd={() => addToCart(false)}
        onBuy={() => addToCart(true)}
      />
    </div>
  );
}
