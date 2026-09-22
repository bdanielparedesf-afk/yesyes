import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, BedDouble, Bath, Maximize } from 'lucide-react';
import { clp, propertyHref, propertyImage, waMessage, type TemplateProps } from '../shared/templateUtils';
import CTABar from '../shared/CTABar';

/** REAL_ESTATE_02 — Buscador grande: buscador/chips centrados sobre hero y resultados en lista. */
export default function RealEstate02({ business, properties }: TemplateProps) {
  const slug = business?.slug;
  const navigate = useNavigate();
  const [op, setOp] = useState('');
  const [type, setType] = useState('');
  const [city, setCity] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const types = useMemo(() => [...new Set(properties.map((p: any) => p.type))], [properties]);
  const cities = useMemo(() => [...new Set(properties.map((p: any) => p.city).filter(Boolean))], [properties]);
  const filtered = properties.filter(
    (p: any) =>
      (!op || p.operation === op) &&
      (!type || p.type === type) &&
      (!city || p.city === city) &&
      (!maxPrice || p.price <= Number(maxPrice)),
  );

  return (
    <div className="space-y-8">
      <section className="-mx-4 -mt-6 relative bg-gradient-to-r from-slate-900 to-slate-700 text-white px-4 py-14">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold">{business?.name}</h1>
          <p className="mt-2 text-slate-300">Encuentra tu próxima propiedad</p>
        </div>
        <div className="max-w-4xl mx-auto mt-8 bg-white rounded-2xl shadow-xl p-4 text-neutral-800 grid sm:grid-cols-5 gap-3">
          <div className="sm:col-span-5 flex gap-2">
            {['', 'VENTA', 'ARRIENDO'].map((o) => (
              <button
                key={o}
                onClick={() => setOp(o)}
                className={`flex-1 text-sm font-semibold rounded-lg py-2 border ${op === o ? 'bg-slate-900 text-white border-slate-900' : 'hover:bg-neutral-50'}`}
              >
                {o === '' ? 'Todas' : o === 'VENTA' ? 'Venta' : 'Arriendo'}
              </button>
            ))}
          </div>
          <select value={type} onChange={(e) => setType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Tipo</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={city} onChange={(e) => setCity(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Ciudad</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Precio máx.</option>
            <option value="50000000">$50.000.000</option>
            <option value="100000000">$100.000.000</option>
            <option value="200000000">$200.000.000</option>
            <option value="500000000">$500.000.000</option>
          </select>
          <div className="flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold">
            <Search size={16} /> {filtered.length} resultados
          </div>
        </div>
      </section>

      {!filtered.length && (
        <p className="bg-white border rounded-2xl p-8 text-center text-neutral-500">Sin resultados para esa búsqueda.</p>
      )}
      <div className="space-y-4">
        {filtered.map((p: any) => (
          <article
            key={p.id}
            onClick={() => navigate(propertyHref(business, p))}
            className="grid sm:grid-cols-3 bg-white border rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
          >
            {propertyImage(p) && (
              <img src={propertyImage(p)} alt={p.title} className="w-full h-48 sm:h-full object-cover" loading="lazy" />
            )}
            <div className="sm:col-span-2 p-5">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${p.operation === 'VENTA' ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                  {p.operation === 'ARRIENDO' ? 'Arriendo' : 'Venta'}
                </span>
                <span className="text-xs bg-neutral-100 rounded-full px-2 py-0.5">{p.type}</span>
              </div>
              <p className="text-2xl font-extrabold text-slate-900 mt-2">
                {clp(p.price)} {p.operation === 'ARRIENDO' && <span className="text-sm font-medium text-neutral-500">/mes</span>}
              </p>
              <p className="font-semibold">{p.title}</p>
              <p className="text-sm text-neutral-500">{[p.address, p.city, p.region].filter(Boolean).join(', ')}</p>
              <div className="mt-3 flex gap-4 text-sm text-neutral-600">
                {p.bedrooms != null && <span className="inline-flex items-center gap-1"><BedDouble size={14} /> {p.bedrooms} dorm</span>}
                {p.bathrooms != null && <span className="inline-flex items-center gap-1"><Bath size={14} /> {p.bathrooms} baños</span>}
                {(p.areaTotal || p.areaBuilt) && <span className="inline-flex items-center gap-1"><Maximize size={14} /> {p.areaTotal || p.areaBuilt} m²</span>}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="h-14" />
      <CTABar business={business} slug={slug} message={waMessage(business, 'quiero agendar una visita')} waLabel="Agendar visita" />
    </div>
  );
}
