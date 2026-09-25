import { NavLink } from 'react-router-dom';

export type DashboardSection =
  | 'inicio'
  | 'configuracion'
  | 'servicios'
  | 'productos'
  | 'propiedades'
  | 'galeria'
  | 'diseno'
  | 'contenido'
  | 'reservas'
  | 'leads';

const ITEMS: { key: DashboardSection; label: string; path: string }[] = [
  { key: 'inicio', label: 'Inicio', path: '/negocio' },
  { key: 'diseno', label: 'Editar página', path: '/negocio/diseno' },
  { key: 'configuracion', label: 'Datos y contacto', path: '/negocio/configuracion' },
  { key: 'servicios', label: 'Servicios', path: '/negocio/servicios' },
  { key: 'productos', label: 'Productos', path: '/negocio/productos' },
  { key: 'propiedades', label: 'Propiedades', path: '/negocio/propiedades' },
  { key: 'galeria', label: 'Galería', path: '/negocio/galeria' },
  { key: 'contenido', label: 'Textos y extras', path: '/negocio/contenido' },
  { key: 'reservas', label: 'Reservas', path: '/negocio/reservas' },
  { key: 'leads', label: 'Contactos', path: '/negocio/leads' },
];

/** Tabs de navegación del dashboard Business (?id= mantiene el negocio seleccionado). */
export default function DashboardNav({ section, businessId }: { section: DashboardSection; businessId?: string | null }) {
  const suffix = businessId ? `?id=${businessId}` : '';
  return (
    <nav className="flex gap-1 overflow-x-auto pb-1">
      {ITEMS.map((it) => (
        <NavLink
          key={it.key}
          to={it.key === 'inicio' ? it.path : `${it.path}${suffix}`}
          className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            section === it.key ? 'bg-black text-white' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}
