import { memo, useCallback } from 'react';
import { Minus, Plus } from 'lucide-react';

interface QuantityStepperProps {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Limite informativo mostrado bajo el selector (ej: "Quedan 3 disponibles"). */
  hint?: string | null;
  compact?: boolean;
}

/**
 * Selector de cantidad compacto y accesible.
 * Nunca baja de 1 ni supera el stock disponible de la combinacion elegida.
 */
function QuantityStepperBase({
  value, min = 1, max, onChange, disabled = false, hint = null, compact = false,
}: QuantityStepperProps) {
  const upper = Math.max(min, Math.floor(Number(max) || min));
  const lower = useCallback(() => onChange(Math.max(min, value - 1)), [min, onChange, value]);
  const raise = useCallback(() => onChange(Math.min(upper, value + 1)), [onChange, upper, value]);

  const buttonClass = `flex items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition-all duration-150 hover:border-primary-400 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-neutral-200 disabled:hover:text-neutral-700 ${
    compact ? 'h-9 w-9' : 'h-10 w-10'
  }`;

  return (
    <div className="space-y-1.5">
      <div className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={lower}
          disabled={disabled || value <= min}
          aria-label="Quitar una unidad"
          className={buttonClass}
        >
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <span
          className="min-w-[2.5rem] text-center text-base font-semibold tabular-nums text-neutral-900"
          aria-live="polite"
          aria-label={`Cantidad: ${value}`}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={raise}
          disabled={disabled || value >= upper}
          aria-label="Agregar una unidad"
          className={buttonClass}
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {hint ? <p className="text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}

export default memo(QuantityStepperBase);
