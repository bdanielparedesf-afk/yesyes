import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BedDouble, Bath, Car, Maximize } from 'lucide-react';
import { clp, propertyHref, propertyImage, waMessage, type TemplateProps } from '../shared/templateUtils';
import CTABar from '../shared/CTABar';

/** REAL_ESTATE_03 — Premium oscuro: grid en negro con precio protagonista y filtros por dormitorios. */
export default function RealEstate03({ business, properties }: TemplateProps) {
  const slug = business?.slug;
  const navigate = useNavigate();
  const [op, setOp] = useState('');
  const [beds, setBeds] = useState('');

  const filtered = properties.filter(
    (p: any) =>
      (!op || p.operation === op) &&
      (!beds || (p.bedrooms || 0) >= Number(beds)),
  );

  return (
    <div className="-mx-4 -mt-6 bg-neutral-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-10">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-800 pb-8">
          <div>
            <p className="uppercase tracking-[0.4em] text-[11px] text-amber-500">Propiedades</p>
            <h1 className="text-4xl sm:text-5xl font-black mt-2">{business?.name}</h1>
          </div>
          <p className="text-neutral-400 text-sm max-w-md">
            {business?.description || `Asesoría inmobiliaria en ${business?.city || 'Chile'}.`}
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          {['', 'VENTA', 'ARRIENDO'].map((o) => (
            <button
              key={o}
              onClick={() => setOp(o)}
              className={`text-sm font-semibold rounded-full px-5 py-2 border ${op === o ? 'bg-amber-500 text-black border-amber-500' : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'}`}
            >
              {o === '' ? 'Todas' : o === 'VENTA' ? 'Venta' : 'Arriendo'}
            </button>
          ))}
          <span className="w-px bg-neutral-800 mx-2" />
          {['', '1', '2', '3'].map((b) => (
            <button
              key={b || 'all'}
              onClick={() => setBeds(b)}
              className={`text-sm rounded-full px-4 py-2 border ${beds === b ? 'bg-white text-black border-white' : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'}`}
            >
              {b === '' ? 'Cualquier dorm.' : `${b}+ dorm`}
            </button>
          ))}
        </div>

        {!filtered.length && <p className="text-neutral-400 py-8 text-center">Sin propiedades para ese filtro.</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p: any) => (
            <article
              key={p.id}
              onClick={() => navigate(propertyHref(business, p))}
              className="group bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden cursor-pointer hover:border-amber-500/60 transition-colors"
            >
              <div className="relative h-52 overflow-hidden">
                {propertyImage(p) ? (
                  <img src={propertyImage(p)} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                ) : (
                  <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-neutral-500">Sin fotos</div>
                )}
                <span className={`absolute top-3 left-3 text-[11px] font-bold px-2.5 py-1 rounded ${p.operation === 'VENTA' ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                  {p.operation === 'ARRIENDO' ? 'ARRIENDO' : 'VENTA'}
                </span>
              </div>
              <div className="p-4">
                <p className="text-xl font-black text-amber-500">
                  {clp(p.price)}{p.operation === 'ARRIENDO' && <span className="text-xs font-medium text-neutral-400"> /mes</span>}
                </p>
                <p className="font-semibold mt-1">{p.title}</p>
                <p className="text-sm text-neutral-400 line-clamp-1">{[p.city, p.region].filter(Boolean).join(', ')}</p>
                <div className="mt-3 flex items-center gap-3 text-xs text-neutral-400 border-t border-neutral-800 pt-3">
                  {p.bedrooms != null && <span className="inline-flex items-center gap-1"><BedDouble size={13} /> {p.bedrooms}</span>}
                  {p.bathrooms != null && <span className="inline-flex items-center gap-1"><Bath size={13} /> {p.bathrooms}</span>}
                  {p.parking != null && <span className="inline-flex items-center gap-1"><Car size={13} /> {p.parking}</span>}
                  {(p.areaTotal || p.areaBuilt) && <span className="inline-flex items-center gap-1"><Maximize size={13} /> {p.areaTotal || p.areaBuilt} m²</span>}
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="h-12" />
      </div>
      <CTABar business={business} slug={slug} message={waMessage(business, 'quiero información de una propiedad')} waLabel="Hablar con un asesor" />
    </div>
  );
}
