import { BedDouble, Bath, Car, Ruler } from 'lucide-react';
import { Link } from 'react-router-dom';
import { clp, operationLabel, propertyHref, propertyImage, type TemplateProps } from './templateUtils';

/** Card de propiedad reutilizable (lista, grid, destacadas). */
export default function PropertyCard({ business, property, variant = 'grid' }: { business: any; property: any; variant?: 'grid' | 'featured' | 'row' }) {
  const img = propertyImage(property);
  const meta = [
    property.bedrooms != null && { icon: BedDouble, label: `${property.bedrooms} dorm` },
    property.bathrooms != null && { icon: Bath, label: `${property.bathrooms} baños` },
    property.parking != null && { icon: Car, label: `${property.parking} auto${property.parking === 1 ? '' : 's'}` },
    (property.areaBuilt || property.areaTotal) && {
      icon: Ruler,
      label: `${property.areaBuilt || property.areaTotal} m²`,
    },
  ].filter(Boolean) as { icon: typeof BedDouble; label: string }[];

  if (variant === 'row') {
    return (
      <Link
        to={propertyHref(business, property)}
        className="flex gap-4 bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow"
      >
        <div className="w-40 sm:w-56 shrink-0 aspect-[4/3] bg-neutral-100">
          {img && <img src={img} alt={property.title} className="w-full h-full object-cover" loading="lazy" />}
        </div>
        <div className="p-4 flex-1 min-w-0">
          <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded ${property.operation === 'VENTA' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {operationLabel(property.operation)}
          </span>
          <p className="font-semibold mt-1 truncate">{property.title}</p>
          <p className="text-sm text-neutral-500 truncate">{[property.address, property.city].filter(Boolean).join(', ')}</p>
          <p className="font-bold text-lg mt-1">{clp(property.price)} {property.currency === 'USD' ? 'USD' : ''}</p>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-neutral-500">
            {meta.map((m) => (
              <span key={m.label} className="inline-flex items-center gap-1">
                <m.icon size={13} /> {m.label}
              </span>
            ))}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={propertyHref(business, property)}
      className={`group bg-white border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow ${variant === 'featured' ? 'ring-1 ring-amber-300' : ''}`}
    >
      <div className="relative aspect-[4/3] bg-neutral-100 overflow-hidden">
        {img ? (
          <img src={img} alt={property.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-300 text-4xl">🏠</div>
        )}
        <span className={`absolute top-2 left-2 text-[11px] font-bold uppercase px-2 py-0.5 rounded ${property.operation === 'VENTA' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {operationLabel(property.operation)}
        </span>
        {variant === 'featured' && (
          <span className="absolute top-2 right-2 text-[11px] font-bold uppercase bg-amber-400 text-amber-950 px-2 py-0.5 rounded">
            Destacada
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="font-bold text-lg">{clp(property.price)} {property.currency === 'USD' ? 'USD' : ''}</p>
        <p className="font-semibold mt-1 line-clamp-1">{property.title}</p>
        <p className="text-sm text-neutral-500 line-clamp-1">
          {[property.address, property.city].filter(Boolean).join(', ')}
        </p>
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-neutral-500">
          {meta.map((m) => (
            <span key={m.label} className="inline-flex items-center gap-1">
              <m.icon size={13} /> {m.label}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

/** Lista de propiedades que usa una plantilla (evita repetir estados de filtro). */
export function PropertyShowcase({ business, properties, variant = 'grid' }: Pick<TemplateProps, 'business' | 'properties'> & { variant?: 'grid' | 'featured' | 'row' }) {
  if (!properties?.length) return null;
  return (
    <>
      {properties.map((p: any) => (
        <PropertyCard key={p.id} business={business} property={p} variant={variant} />
      ))}
    </>
  );
}
