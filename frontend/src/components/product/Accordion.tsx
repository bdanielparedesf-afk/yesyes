import { memo, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Contenido corto a la derecha del titulo (ej: "4 opciones"). */
  meta?: string | null;
}

/**
 * Acordeon accesible y sobrio para la informacion secundaria del producto.
 * Evita paredes de texto y se puede usar en desktop y mobile.
 */
function AccordionBase({ title, children, defaultOpen = false, meta = null }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-neutral-100 last:border-b-0">
      <h2>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-4 py-4 text-left transition-colors duration-150 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
        >
          <span className="text-sm font-semibold tracking-tight text-neutral-900 sm:text-base">{title}</span>
          <span className="flex items-center gap-3">
            {meta ? <span className="hidden text-xs text-neutral-400 sm:inline">{meta}</span> : null}
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </span>
        </button>
      </h2>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className="pb-5 text-sm leading-relaxed text-neutral-600">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default memo(AccordionBase);
