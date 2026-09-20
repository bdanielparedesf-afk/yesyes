import { memo, useMemo } from 'react';
import { Check, X } from 'lucide-react';
import type { VariantAttributeVM, VariantAvailability, VariantEngine, VariantOptionVM } from '@/utils/variantEngine';

interface ProductVariantSelectorProps {
  engine: VariantEngine<unknown>;
  selection: Record<string, string>;
  onSelect: (attribute: string, value: string) => void;
}

interface ResolvedOption extends VariantOptionVM {
  availability: VariantAvailability;
  selected: boolean;
}

function optionLabel(option: ResolvedOption): string {
  if (option.availability === 'out_of_stock') return `${option.value} (agotado)`;
  if (option.availability === 'unavailable') return `${option.value} (no disponible)`;
  return option.value;
}

function ImageSwatch({ option, group, onSelect }: {
  option: ResolvedOption;
  group: string;
  onSelect: (attribute: string, value: string) => void;
}) {
  const disabled = option.availability !== 'available';
  return (
    <button
      type="button"
      onClick={() => onSelect(group, option.value)}
      disabled={disabled}
      aria-pressed={option.selected}
      aria-label={`${group}: ${optionLabel(option)}`}
      title={optionLabel(option)}
      className={`group/swatch relative flex w-[68px] flex-col items-center gap-1 rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
        disabled ? 'cursor-not-allowed opacity-45' : 'hover:-translate-y-0.5'
      }`}
    >
      <span
        className={`relative h-14 w-14 overflow-hidden rounded-xl border bg-white transition-all duration-150 ${
          option.selected
            ? 'border-primary-700 ring-2 ring-primary-200'
            : 'border-neutral-200 group-hover/swatch:border-primary-400'
        }`}
      >
        {option.image ? (
          <img
            src={option.image}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-neutral-50 text-[10px] font-medium text-neutral-500">
            {option.value.slice(0, 3)}
          </span>
        )}
        {option.selected ? (
          <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-tl-lg bg-primary-700 text-white">
            <Check className="h-3 w-3" aria-hidden />
          </span>
        ) : null}
        {disabled ? (
          <span className="absolute inset-0 flex items-center justify-center bg-white/55">
            <X className="h-4 w-4 text-neutral-500" aria-hidden />
          </span>
        ) : null}
      </span>
      <span
        className={`w-full truncate text-center text-[11px] leading-tight ${
          option.selected ? 'font-semibold text-primary-800' : 'text-neutral-600'
        }`}
      >
        {option.value}
      </span>
    </button>
  );
}


function TextChip({ option, group, onSelect }: {
  option: ResolvedOption;
  group: string;
  onSelect: (attribute: string, value: string) => void;
}) {
  const disabled = option.availability !== 'available';
  return (
    <button
      type="button"
      onClick={() => onSelect(group, option.value)}
      disabled={disabled}
      aria-pressed={option.selected}
      aria-label={`${group}: ${optionLabel(option)}`}
      title={optionLabel(option)}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 ${
        option.selected
          ? 'border-primary-700 bg-primary-100 font-semibold text-primary-900 shadow-sm'
          : disabled
            ? 'cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-400'
            : 'border-neutral-200 bg-white text-neutral-800 hover:border-primary-400 hover:bg-primary-50'
      }`}
    >
      {option.selected ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
      <span className={`truncate ${disabled ? 'line-through decoration-neutral-300' : ''}`}>
        {option.value}
      </span>
      {option.availability !== 'available' ? (
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
          {option.availability === 'out_of_stock' ? 'agotado' : 'n/d'}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Selector generico de variantes agrupadas por atributo.
 * Decide solo si usar miniaturas (cuando el atributo tiene imagenes) o botones
 * de texto. No depende del proveedor y nunca muestra IDs/SKU tecnicos.
 */
function ProductVariantSelectorBase({ engine, selection, onSelect }: ProductVariantSelectorProps) {
  const groups = useMemo(() => engine.attributes.map((group: VariantAttributeVM) => ({
    name: group.name,
    presentation: group.presentation,
    options: group.options.map((option): ResolvedOption => ({
      ...option,
      availability: engine.availabilityOf(group.name, option.value, selection),
      selected: selection[group.name] === option.value,
    })),
  })), [engine, selection]);

  if (!groups.length) return null;

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const selectedValue = selection[group.name];
        return (
          <div key={group.name} role="group" aria-label={group.name}>
            <div className="mb-2 flex items-baseline gap-2">
              <p className="text-sm font-semibold text-neutral-900">{group.name}</p>
              {selectedValue ? (
                <span className="truncate text-sm text-neutral-500">{selectedValue}</span>
              ) : null}
            </div>
            {group.presentation === 'image' ? (
              <div className="flex flex-wrap gap-3">
                {group.options.map((option) => (
                  <ImageSwatch key={option.value} option={option} group={group.name} onSelect={onSelect} />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {group.options.map((option) => (
                  <TextChip key={option.value} option={option} group={group.name} onSelect={onSelect} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default memo(ProductVariantSelectorBase);
