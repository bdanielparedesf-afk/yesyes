import { BedDouble, Bath, Car, Maximize, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { clp, propertyImage, propertyHref } from '../shared/templateUtils';

/** Card estandar de propiedad: imagen, operación, precio, ubicación y métricas. */
export default function PropertyCard({ business, property }: { business: any; property: any }) {
  return (
    <Link
      to={propertyHref(business, property)}
      className="group bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-shadow block"
    >
      <div className="relative aspect-[4/3] bg-neutral-100">
        {propertyImage(property) ? (
          <img src={propertyImage(property)} alt={property.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-300">Sin imagen</div>
        )}
        <span
          className={`absolute top-2 left-2 text-xs font-bold rounded px-2 py-1 ${
            property.operation === 'VENTA' ? 'bg-blue-600' : 'bg-emerald-600'
          } text-white`}
        >
          {property.operation}
        </span>
        {property.featured && <span className="absolute top-2 right-2 text-xs font-bold bg-amber-500 text-white rounded px-2 py-1">Destacada</span>}
      </div>
      <div className="p-4">
        <p className="font-bold text-lg">{clp(property.price)} {property.currency === 'USD' ? 'USD' : ''}</p>
        <p className="font-semibold line-clamp-2 mt-1">{property.title}</p>
        <p className="text-sm text-neutral-500 flex items-center gap-1 mt-1">
          <MapPin size={13} /> {[property.city, property.region].filter(Boolean).join(', ') || property.address || '—'}
        </p>
        <div className="mt-3 flex items-center gap-3 text-xs text-neutral-600 border-t pt-2">
          {property.bedrooms != null && <span className="flex items-center gap-1"><BedDouble size={13} /> {property.bedrooms} dorm</span>}
          {property.bathrooms != null && <span className="flex items-center gap-1"><Bath size={13} /> {property.bathrooms} baños</span>}
          {property.parking != null && <span className="flex items-center gap-1"><Car size={13} /> {property.parking}</span>}
          {property.areaTotal != null && <span className="flex items-center gap-1 ml-auto"><Maximize size={13} /> {property.areaTotal} m²</span>}
        </div>
      </div>
    </Link>
  );
}
