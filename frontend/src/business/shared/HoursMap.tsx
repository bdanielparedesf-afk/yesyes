import { MapPin, Clock } from 'lucide-react';

const DAY_ORDER = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Horarios (Json) + dirección / mapa del negocio. */
export default function HoursMap({ business }: { business: any }) {
  const hours = business?.hours && typeof business.hours === 'object' ? (business.hours as Record<string, unknown>) : null;
  const mapHref =
    business?.mapsUrl ||
    (business?.lat != null && business?.lng != null
      ? `https://www.google.com/maps?q=${business.lat},${business.lng}`
      : '');
  const entries = hours
    ? Object.entries(hours).sort(
        (a, b) => DAY_ORDER.indexOf(a[0]) - DAY_ORDER.indexOf(b[0]) || a[0].localeCompare(b[0]),
      )
    : [];

  return (
    <div className="grid sm:grid-cols-2 gap-6">
      {entries.length > 0 && (
        <div>
          <h3 className="font-bold flex items-center gap-2 mb-3">
            <Clock size={16} /> Horarios
          </h3>
          <dl className="text-sm divide-y divide-neutral-200">
            {entries.map(([day, value]) => (
              <div key={day} className="flex justify-between gap-4 py-2">
                <dt className="font-medium">{day}</dt>
                <dd className="text-neutral-600 text-right">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <div>
        <h3 className="font-bold flex items-center gap-2 mb-3">
          <MapPin size={16} /> Ubicación
        </h3>
        {business?.address && (
          <p className="text-sm text-neutral-700">
            {business.address}
            {business?.city ? `, ${business.city}` : ''}
            {business?.region ? ` — ${business.region}` : ''}
          </p>
        )}
        {business?.phone && <p className="text-sm mt-2">Tel: {business.phone}</p>}
        {business?.email && <p className="text-sm">{business.email}</p>}
        {mapHref && (
          <a
            href={mapHref}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-3 text-sm font-semibold underline text-blue-700"
          >
            Ver en el mapa
          </a>
        )}
      </div>
    </div>
  );
}
