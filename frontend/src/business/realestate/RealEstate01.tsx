import { getIndustryComposition } from '../industryComposition';
import { thematicAssets } from '../assets';
import { buildWaLink } from '@/services/business';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BedDouble, Bath, Car, Maximize } from 'lucide-react';
import { clp, propertyHref, propertyImage, waMessage, type TemplateProps } from '../shared/templateUtils';
import CTABar from '../shared/CTABar';
import HoursMap from '../shared/HoursMap';

const OPS = ['', 'VENTA', 'ARRIENDO'] as const;

function Card({ p, onOpen }: { p: any; onOpen: () => void }) {
  return (
    <article
      onClick={onOpen}
      className="group bg-white rounded-2xl border overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
    >
      <div className="relative">
        {propertyImage(p) ? (
          <img src={propertyImage(p)} alt={p.title} className="w-full h-52 object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-52 bg-neutral-200 flex items-center justify-center text-neutral-400">Sin fotos</div>
        )}
        <span className={`absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full text-white ${p.operation === 'VENTA' ? 'bg-blue-600' : 'bg-emerald-600'}`}>
          {p.operation === 'ARRIENDO' ? 'Arriendo' : 'Venta'}
        </span>
        {p.featured && <span className="absolute top-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500 text-white">Destacada</span>}
      </div>
      <div className="p-4">
        <p className="font-bold text-lg text-blue-950">
          {clp(p.price)} {p.operation === 'ARRIENDO' && <span className="text-sm font-medium text-neutral-500">/mes</span>}
        </p>
        <p className="font-semibold mt-1 line-clamp-1">{p.title}</p>
        <p className="text-sm text-neutral-500 line-clamp-1">{[p.address, p.city].filter(Boolean).join(', ') || p.region}</p>
        <div className="mt-3 flex items-center gap-3 text-xs text-neutral-600 border-t pt-3">
          {p.bedrooms != null && <span className="inline-flex items-center gap-1"><BedDouble size={13} /> {p.bedrooms} dorm</span>}
          {p.bathrooms != null && <span className="inline-flex items-center gap-1"><Bath size={13} /> {p.bathrooms} baños</span>}
          {p.parking != null && <span className="inline-flex items-center gap-1"><Car size={13} /> {p.parking}</span>}
          {(p.areaTotal || p.areaBuilt) && (
            <span className="inline-flex items-center gap-1"><Maximize size={13} /> {p.areaTotal || p.areaBuilt} m²</span>
          )}
        </div>
      </div>
    </article>
  );
}

/** REAL_ESTATE_01 — Clásico: hero + sidebar de filtros sticky + grid de propiedades. */
export default function RealEstate01({ business, properties }: TemplateProps) {
  const slug = business?.slug;
  const composition = getIndustryComposition(business?.template?.code, business?.category);
  const hero = business?.cover || thematicAssets(composition.category)[0];
  const waHref = buildWaLink(business?.whatsapp, `Hola ${business?.name || ''}, quiero ${composition.cta.toLowerCase()}.`);
  const navigate = useNavigate();
  const [op, setOp] = useState('');
  const [type, setType] = useState('');
  const [city, setCity] = useState('');

  const types = useMemo(() => [...new Set(properties.map((p: any) => p.type))], [properties]);
  const cities = useMemo(() => [...new Set(properties.map((p: any) => p.city).filter(Boolean))], [properties]);
  const filtered = properties.filter(
    (p: any) => (!op || p.operation === op) && (!type || p.type === type) && (!city || p.city === city),
  );

  return (
    <div className="space-y-8">
      <section className="relative -mx-4 -mt-6 min-h-[68vh] overflow-hidden bg-stone-950 px-4 py-16 text-white sm:flex sm:items-center">
        <img src={hero?.src} alt={hero?.alt || `Inmobiliaria ${business?.name}`} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/75 to-white/10" />
        <div className="relative mx-auto w-full max-w-5xl text-right">
          <p className="text-xs uppercase tracking-[.35em] text-stone-600">Arquitectura y propiedades</p>
          <h1 className="mt-3 text-4xl font-light tracking-tight text-stone-950 sm:text-6xl">{business?.name}</h1>
          <p className="mt-4 text-stone-700">{business?.city || 'Chile'} · Venta y arriendo</p>
          <a href={waHref} target="_blank" rel="noreferrer" className="mt-6 inline-block bg-stone-950 px-7 py-3 text-sm font-bold text-white focus-visible:outline focus-visible:ring-2">{composition.cta}</a>
        </div>
      </section>

      <div className="grid lg:grid-cols-4 gap-6 items-start">
        <aside className="lg:col-span-1 lg:sticky lg:top-20 bg-white border rounded-2xl p-5 space-y-4">
          <h2 className="font-bold text-sm uppercase tracking-wide text-neutral-400">Filtros</h2>
          <div className="flex gap-2">
            {OPS.map((o) => (
              <button
                key={o}
                onClick={() => setOp(o)}
                className={`flex-1 text-xs font-semibold rounded-lg py-2 border ${op === o ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-neutral-50'}`}
              >
                {o === '' ? 'Todas' : o === 'VENTA' ? 'Venta' : 'Arriendo'}
              </button>
            ))}
          </div>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Todos los tipos</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Todas las ciudades</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <p className="text-xs text-neutral-400">{filtered.length} propiedad(es)</p>
        </aside>

        <div className="lg:col-span-3">
          {business?.description && <p className="text-neutral-600 mb-4 whitespace-pre-line">{business.description}</p>}
          {!filtered.length && (
            <p className="bg-white border rounded-2xl p-8 text-center text-neutral-500">
              No hay propiedades con esos filtros. Ajusta la búsqueda o contáctanos.
            </p>
          )}
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((p: any) => (
              <Card key={p.id} p={p} onOpen={() => navigate(propertyHref(business, p))} />
            ))}
          </div>
        </div>
      </div>

      <section className="bg-white rounded-2xl border p-6">
        <HoursMap business={business} />
      </section>
      <div className="h-14" />
      <CTABar business={business} slug={slug} message={waMessage(business, 'quiero ver propiedades')} waLabel="Contactar asesor" />
    </div>
  );
}

