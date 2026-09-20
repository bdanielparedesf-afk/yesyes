import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Play, X, ZoomIn } from 'lucide-react';
import { parseVideoSource } from '@/utils/productPresentation';

interface GalleryItem {
  id: string;
  type: 'image' | 'video';
  src: string;
  thumb: string;
  embed: boolean;
}

interface ProductGalleryProps {
  images: string[];
  video?: string | null;
  title: string;
  /** Imagen de la variante seleccionada: la galeria la enfoca automaticamente. */
  focusImage?: string | null;
  onChange?: (src: string) => void;
  overlay?: ReactNode;
}

const FALLBACK_IMAGE = '/logo-icon.svg';

/**
 * Galeria del producto: imagen principal grande, miniaturas, navegacion,
 * zoom (hover en desktop, toque en mobile), video y cambio suave cuando el
 * usuario elige una variante con imagen propia.
 */
function ProductGalleryBase({
  images, video = null, title, focusImage = null, onChange, overlay,
}: ProductGalleryProps) {
  const items = useMemo<GalleryItem[]>(() => {
    const unique = [...new Set(images.filter(Boolean))];
    const list: GalleryItem[] = unique.map((src, idx) => ({
      id: `img-${idx}`,
      type: 'image',
      src,
      thumb: src,
      embed: false,
    }));
    const source = parseVideoSource(video);
    if (source) {
      list.push({
        id: 'video',
        type: 'video',
        src: source.src,
        thumb: '',
        embed: source.kind === 'embed',
      });
    }
    return list;
  }, [images, video]);

  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const zoomLayer = useRef<HTMLDivElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!focusImage) return;
    const next = items.findIndex((item) => item.type === 'image' && item.src === focusImage);
    if (next >= 0) setIndex(next);
  }, [focusImage, items]);

  const active = items[index] ?? items[0];
  const total = items.length;

  useEffect(() => {
    if (active && active.type === 'image' && onChange) onChange(active.src);
  }, [active, onChange]);

  useEffect(() => {
    setLoaded(false);
    setZoom(false);
  }, [active?.id]);

  const go = useCallback((step: number) => {
    setIndex((prev) => {
      if (!total) return prev;
      return (prev + step + total) % total;
    });
  }, [total]);

  const applyZoomPosition = useCallback((clientX: number, clientY: number) => {
    const layer = zoomLayer.current;
    const box = stage.current?.getBoundingClientRect();
    if (!layer || !box) return;
    const x = ((clientX - box.left) / box.width) * 100;
    const y = ((clientY - box.top) / box.height) * 100;
    layer.style.backgroundPosition = `${Math.max(0, Math.min(100, x))}% ${Math.max(0, Math.min(100, y))}%`;
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' && !zoom) return;
    applyZoomPosition(event.clientX, event.clientY);
  }, [applyZoomPosition, zoom]);

  const handleTap = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') applyZoomPosition(event.clientX, event.clientY);
    setZoom((prev) => !prev);
  }, [applyZoomPosition]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
    if (event.key === 'Escape') setZoom(false);
  }, [go]);

  if (!active) {
    return (
      <div className="aspect-square w-full rounded-[var(--radius-xl)] border border-neutral-100 bg-white" />
    );
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      {total > 1 ? (
        <div className="no-scrollbar order-2 flex shrink-0 gap-2 overflow-x-auto pb-1 lg:order-1 lg:max-h-[552px] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0">
          {items.map((item, idx) => {
            const selected = idx === index;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(idx)}
                aria-label={item.type === 'video' ? 'Ver video del producto' : `Ver imagen ${idx + 1}`}
                aria-current={selected}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-white transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 sm:h-16 sm:w-16 ${
                  selected ? 'border-primary-700 ring-1 ring-primary-200' : 'border-neutral-200 hover:border-primary-400'
                }`}
              >
                {item.type === 'video' ? (
                  <span className="flex h-full w-full items-center justify-center bg-neutral-900 text-white">
                    <Play className="h-4 w-4" aria-hidden />
                  </span>
                ) : (
                  <img
                    src={broken[item.thumb] ? FALLBACK_IMAGE : item.thumb}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={() => setBroken((prev) => ({ ...prev, [item.thumb]: true }))}
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        ref={stage}
        role="group"
        aria-label={`Galería de ${title}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerMove={handlePointerMove}
        onPointerEnter={(event) => { if (event.pointerType !== 'touch') setZoom(true); }}
        onPointerLeave={(event) => { if (event.pointerType !== 'touch') setZoom(false); }}
        onClick={handleTap}
        className="group relative order-1 aspect-square w-full cursor-zoom-in overflow-hidden rounded-[var(--radius-xl)] border border-neutral-100 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 lg:order-2"
      >
        {overlay}

        {active.type === 'video' && active.embed ? (
          <iframe
            src={active.src}
            title={`Video de ${title}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        ) : active.type === 'video' ? (
          <video
            src={active.src}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full bg-neutral-900 object-contain"
          />
        ) : (
          <>
            <img
              key={active.src}
              src={broken[active.src] ? FALLBACK_IMAGE : active.src}
              alt={title}
              loading="eager"
              decoding="async"
              onLoad={() => setLoaded(true)}
              onError={() => {
                setBroken((prev) => ({ ...prev, [active.src]: true }));
                setLoaded(true);
              }}
              className={`h-full w-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
            <div
              ref={zoomLayer}
              aria-hidden
              className={`pointer-events-none absolute inset-0 bg-no-repeat transition-opacity duration-200 ${zoom ? 'opacity-100' : 'opacity-0'}`}
              style={{
                backgroundImage: `url(${broken[active.src] ? FALLBACK_IMAGE : active.src})`,
                backgroundSize: '185%',
                backgroundPosition: '50% 50%',
              }}
            />
          </>
        )}

        <span className="pointer-events-none absolute bottom-3 right-3 hidden items-center gap-1 rounded-full bg-neutral-900/70 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm lg:flex">
          {zoom ? <X className="h-3 w-3" aria-hidden /> : <ZoomIn className="h-3 w-3" aria-hidden />}
          {zoom ? 'Zoom activo' : 'Pasa el cursor para zoom'}
        </span>

        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); go(-1); }}
              aria-label="Imagen anterior"
              className="absolute left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/90 text-neutral-700 shadow-sm transition-all duration-150 hover:border-primary-400 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 lg:flex lg:opacity-0 lg:group-hover:opacity-100"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); go(1); }}
              aria-label="Imagen siguiente"
              className="absolute right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/90 text-neutral-700 shadow-sm transition-all duration-150 hover:border-primary-400 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 lg:flex lg:opacity-0 lg:group-hover:opacity-100"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
            <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-neutral-900/70 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              {index + 1}/{total}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default memo(ProductGalleryBase);

