import { memo } from 'react';
import { Check, Loader2, ShoppingCart } from 'lucide-react';
import { formatCLP } from '@/utils/productPresentation';

interface MobileBuyBarProps {
  price: number;
  compareAtPrice?: number;
  visible: boolean;
  disabled: boolean;
  busy: boolean;
  added: boolean;
  onAdd: () => void;
  onBuy: () => void;
}

/**
 * Barra de accion inferior en mobile: compacta, no invasiva y respeta el
 * area segura inferior. Se oculta cuando los CTA principales estan visibles.
 */
function MobileBuyBarBase({
  price, compareAtPrice = 0, visible, disabled, busy, added, onAdd, onBuy,
}: MobileBuyBarProps) {
  const hasDiscount = compareAtPrice > price;
  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur transition-transform duration-200 ease-out lg:hidden ${
        visible ? 'translate-y-0' : 'pointer-events-none translate-y-full'
      }`}
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center gap-3 px-4 pt-3">
        <div className="min-w-0">
          <p className="text-base font-bold leading-tight text-neutral-900">{formatCLP(price)}</p>
          {hasDiscount ? (
            <p className="text-[11px] text-neutral-400 line-through">{formatCLP(compareAtPrice)}</p>
          ) : null}
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          <button
            type="button"
            onClick={onAdd}
            disabled={disabled || busy}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-primary-700 px-4 text-sm font-semibold text-primary-800 transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : added ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <ShoppingCart className="h-4 w-4" aria-hidden />
            )}
            {busy ? 'Agregando…' : added ? 'Agregado' : 'Agregar'}
          </button>
          <button
            type="button"
            onClick={onBuy}
            disabled={disabled || busy}
            className="inline-flex h-11 min-w-[6.5rem] items-center justify-center rounded-full bg-primary-700 px-5 text-sm font-semibold text-white shadow-md transition-all duration-150 hover:bg-primary-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:shadow-none"
          >
            Comprar ahora
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(MobileBuyBarBase);
