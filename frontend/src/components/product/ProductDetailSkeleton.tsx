/**
 * Skeleton de la ficha de producto: reserva el espacio de galeria, precio,
 * variantes y botones para evitar saltos (CLS) mientras carga la API.
 */
export default function ProductDetailSkeleton() {
  return (
    <div className="min-h-screen bg-neutral-50" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Cargando producto…</span>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6 h-3 w-56 animate-pulse rounded-full bg-neutral-200" />
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="space-y-4">
            <div className="aspect-square w-full animate-pulse rounded-[var(--radius-xl)] border border-neutral-100 bg-white" />
            <div className="flex gap-3">
              {[0, 1, 2, 3].map((key) => (
                <div key={key} className="h-16 w-16 animate-pulse rounded-lg bg-neutral-200" />
              ))}
            </div>
          </div>
          <div className="space-y-5">
            <div className="h-5 w-24 animate-pulse rounded-full bg-neutral-200" />
            <div className="space-y-2">
              <div className="h-6 w-full animate-pulse rounded bg-neutral-200" />
              <div className="h-6 w-3/4 animate-pulse rounded bg-neutral-200" />
            </div>
            <div className="h-4 w-40 animate-pulse rounded bg-neutral-200" />
            <div className="h-10 w-44 animate-pulse rounded bg-neutral-200" />
            <div className="h-4 w-32 animate-pulse rounded bg-neutral-200" />
            <div className="space-y-2 pt-2">
              <div className="h-4 w-20 animate-pulse rounded bg-neutral-200" />
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3, 4].map((key) => (
                  <div key={key} className="h-10 w-24 animate-pulse rounded-full bg-neutral-200" />
                ))}
              </div>
            </div>
            <div className="h-12 w-40 animate-pulse rounded-full bg-neutral-200" />
            <div className="flex gap-3 pt-2">
              <div className="h-12 flex-1 animate-pulse rounded-full bg-neutral-200" />
              <div className="h-12 flex-1 animate-pulse rounded-full bg-neutral-200" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
