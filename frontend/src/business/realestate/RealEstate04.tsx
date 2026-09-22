import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BedDouble, Bath, Maximize } from 'lucide-react';
import { clp, propertyHref, propertyImage, waMessage, type TemplateProps } from '../shared/templateUtils';
import { buildWaLink, trackEvent } from '@/services/business';
import WhatsAppButton from '../shared/WhatsAppButton';
import Socials from '../shared/Socials';

/** REAL_ESTATE_04 — Editorial: fichas alternadas foto/texto tipo revista inmobiliaria. */
export default function RealEstate04({ business, properties }: TemplateProps) {
  const slug = business?.slug;
  const navigate = useNavigate();
  const [op, setOp] = useState('');
  const [type, setType] = useState('');

  const types = useMemo(() => [...new Set(properties.map((p: any) => p.type))], [properties]);
  const filtered = properties.filter((p: any) => (!op || p.operation === op) && (!type || p.type === type));

  return (
    <div className="space-y-12">
      <header className="text-center border-b border-neutral-300 pb-8">
        <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-400">Inmobiliaria</p>
        <h1 className="text-4xl sm:text-5xl font-light tracking-wide mt-3">{business?.name}</h1>
        <div className="mt-4 flex justify-center">
          <Socials socials={business?.socials} />
        </div>
      </header>

      <div className="flex flex-wrap justify-center gap-2">
        {['', 'VENTA', 'ARRIENDO'].map((o) => (
          <button
            key={o}
            onClick={() => setOp(o)}
            className={`text-sm rounded-full px-5 py-2 border ${op === o ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-300 text-neutral-600 hover:border-neutral-500'}`}
          >
            {o === '' ? 'Todas' : o === 'VENTA' ? 'Venta' : 'Arriendo'}
          </button>
        ))}
        <select value={type} onChange={(e) => setType(e.target.value)} className="text-sm border border-neutral-300 rounded-full px-4 py-2">
          <option value="">Tipo de propiedad</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {!filtered.length && <p className="text-center text-neutral-500 py-8">No hay propiedades disponibles con ese filtro.</p>}

      <div className="space-y-14">
        {filtered.map((p: any, i: number) => (
          <article
            key={p.id}
            onClick={() => navigate(propertyHref(business, p))}
            className={`grid sm:grid-cols-2 gap-8 items-center cursor-pointer group ${i % 2 ? 'sm:[direction:rtl]' : ''}`}
          >
            <div className="[direction:ltr] overflow-hidden rounded-3xl">
              {propertyImage(p) ? (
                <img src={propertyImage(p)} alt={p.title} className="w-full h-72 sm:h-96 object-cover group-hover:scale-[1.03] transition-transform duration-300" loading="lazy" />
              ) : (
                <div className="w-full h-72 bg-neutral-200 flex items-center justify-center text-neutral-400">Sin fotos</div>
              )}
            </div>
            <div className="[direction:ltr]">
              <span className={`text-xs font-bold px-3 py-1 rounded-full text-white ${p.operation === 'VENTA' ? 'bg-blue-700' : 'bg-emerald-700'}`}>
                {p.operation === 'ARRIENDO' ? 'Arriendo' : 'Venta'}
              </span>
              <p className="text-3xl font-light mt-3">
                {clp(p.price)}{p.operation === 'ARRIENDO' && <span className="text-sm text-neutral-500"> /mes</span>}
              </p>
              <h2 className="text-xl font-semibold mt-2">{p.title}</h2>
              <p className="text-neutral-500 mt-1">{[p.address, p.city, p.region].filter(Boolean).join(', ')}</p>
              <p className="text-sm text-neutral-600 mt-3 line-clamp-3">{p.description}</p>
              <div className="mt-4 flex gap-5 text-sm text-neutral-700 border-t pt-4">
                {p.bedrooms != null && <span className="inline-flex items-center gap-1.5"><BedDouble size={15} /> {p.bedrooms} dorm</span>}
                {p.bathrooms != null && <span className="inline-flex items-center gap-1.5"><Bath size={15} /> {p.bathrooms} baños</span>}
                {(p.areaTotal || p.areaBuilt) && <span className="inline-flex items-center gap-1.5"><Maximize size={15} /> {p.areaTotal || p.areaBuilt} m²</span>}
              </div>
              <a
                href={buildWaLink(business?.whatsapp, `Hola, me interesa la propiedad: ${p.title}`)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => { e.stopPropagation(); trackEvent(slug, 'WHATSAPP_CLICK'); }}
                className="inline-block mt-4 text-sm underline underline-offset-4 text-neutral-600 hover:text-black"
              >
                Consultar propiedad →
              </a>
            </div>
          </article>
        ))}
      </div>

      <WhatsAppButton phone={business?.whatsapp} message={waMessage(business, 'quiero ver propiedades')} slug={slug} label="Contactar" />
    </div>
  );
}
