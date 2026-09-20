import { memo } from 'react';
import { Star } from 'lucide-react';

interface ProductRatingProps {
  average: number;
  count: number;
  /** Muestra "N reseñas" al lado de las estrellas. */
  showCount?: boolean;
  size?: 'sm' | 'md';
}

/** Valoracion real del producto. Nunca inventa datos: si no hay reseñas, no se usa. */
function ProductRatingBase({ average, count, showCount = true, size = 'sm' }: ProductRatingProps) {
  if (!count || average <= 0) return null;
  const starClass = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  const rounded = Math.round(average * 2) / 2;
  return (
    <div className="flex items-center gap-2" aria-label={`Valoración ${average.toFixed(1)} de 5 con ${count} reseñas`}>
      <span className="flex items-center gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((index) => {
          const filled = rounded >= index;
          return (
            <Star
              key={index}
              className={`${starClass} ${filled ? 'text-amber-400' : 'text-neutral-200'}`}
              fill={filled ? 'currentColor' : 'none'}
              strokeWidth={filled ? 0 : 1.5}
            />
          );
        })}
      </span>
      <span className="text-sm font-semibold text-neutral-900">{average.toFixed(1)}</span>
      {showCount ? <span className="text-sm text-neutral-500">({count} reseñas)</span> : null}
    </div>
  );
}

export default memo(ProductRatingBase);
