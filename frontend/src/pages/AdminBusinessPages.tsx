import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, CreditCard, Loader2, Pencil, RotateCcw, Search, ShieldOff, Trash2,
} from 'lucide-react';
import api from '@/lib/axios';

/**
 * ADMIN Ã¢â‚¬â€ PÃƒÂGINAS PUBLICADAS.
 *
 * Este panel responde UNA pregunta que el resto de la app no puede:
 * Ã‚Â¿cuÃƒÂ¡les de las pÃƒÂ¡ginas que vendimos estÃƒÂ¡n en lÃƒÂ­nea de verdad?
 *
 * El detalle importante: el filtro es por estado de VIDA (en lÃƒÂ­nea / en gracia /
 * dada de baja), no por el status del negocio. Una pÃƒÂ¡gina puede estar
 * "PUBLISHED" en la base y no estar en lÃƒÂ­nea porque su plan venciÃƒÂ³: mostrarla
 * como activa serÃƒÂ­a mentir. Por eso cada fila trae `live` calculado por el
 * servidor con la misma funciÃƒÂ³n que usa la ruta pÃƒÂºblica.
 */
export interface PageRow {
  id: string; name: string; slug: string; category: string; status: string;
  live: boolean; availabilityReason: string; availabilityLabel: string;
  graceDaysLeft: number; graceUntil: string | null; periodEnd: string | null;
  subscriptionStatus: string | null; amount: number | null; currency: string | null;
  ownerEmail: string | null; ownerName: string | null;
  publishedAt: string | null; updatedAt: string;
  counts: { services: number; products: number; gallery: number };
}
export interface Summary {
  total: number; live: number; inGrace: number; down: number;
  activeSubs: number; monthlyRevenue: number;
}

const CLP = (v: number) => `$${new Intl.NumberFormat('es-CL').format(v)}`;
const fecha = (v: string | null) =>
  (v ? new Date(v).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Ã¢â‚¬â€');

export const FILTROS_PAGINAS = [
  { id: 'TODOS', label: 'Todas' },
  { id: 'EN_LINEA', label: 'En lÃƒÂ­nea' },
  { id: 'GRACIA', label: 'En gracia' },
  { id: 'BAJA', label: 'Dadas de baja' },
  { id: 'SIN_PLAN', label: 'Sin plan' },
  { id: 'BORRADOR', label: 'Borradores' },
];

/** Color del estado de vida. El rojo es "no esta en linea", no "error". */
export function vidaStyle(row: PageRow) {
  if (row.live) {
    return row.availabilityReason === 'GRACE_ACTIVE'
      ? 'bg-amber-100 text-amber-900'
      : 'bg-emerald-100 text-emerald-900';
  }
  return row.status === 'PUBLISHED'
    ? 'bg-rose-100 text-rose-900'
    : 'bg-neutral-200 text-neutral-700';
}

export default function AdminBusinessPages() {
  const [rows, setRows] = useState<PageRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState('TODOS');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async (f = filter, s = search) => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/business-pages', { params: { filter: f, search: s } });
      setRows(data.rows || []);
      setSummary(data.summary);
      setError('');
    } catch {
      setError('No se pudo cargar el estado de las pÃƒÂ¡ginas.');
    } finally { setLoading(false); }
  };
  useEffect(() => { void load('TODOS', ''); }, []);

  /**
   * Acciones de soporte. Cada una pide confirmaciÃƒÂ³n: son de efecto visible sobre
   * una pÃƒÂ¡gina que ya estÃƒÂ¡ en manos de un cliente, y un clic apurado por dar de
   * baja algo que estaba bien serÃƒÂ­a un costo real de confianza.
   */
  /**
   * ELIMINAR la página. Va con `force` desde el primer intento: el admin
   * pidió poder borrar sin que el sistema le pregunte si está seguro. La única
   * protección que queda no es una duda, es dinero: si hay un cobro vivo en
   * Mercado Pago, el backend lo cancela antes de borrar, y avisa si no pudo.
   */
  const eliminar = async (row: PageRow) => {
    const mensaje = [
      'Eliminar la página de "' + row.name + '"?',
      '',
      'Se borra todo: servicios, productos, fotos y textos.',
      'Si tiene un cobro activo en Mercado Pago, se cancela también.'
    ].join('\n');
    if (!window.confirm(mensaje)) return;
    setBusy(row.id); setError(''); setNotice('');
    try {
      const { data } = await api.delete('/admin/business-pages/' + row.id, { data: { force: true } });
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setNotice(data?.cancelledInProvider
        ? 'Se eliminó "' + row.name + '" y se canceló su cobro en Mercado Pago.'
        : 'Se eliminó "' + row.name + '".');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'No se pudo eliminar la página.');
    } finally { setBusy(''); }
  };
  const accion = async (row: PageRow, verb: 'take-down' | 'restore' | 'subscription', extra: any = {}) => {
    if (verb === 'subscription') {
      if (!window.confirm(`Ã‚Â¿Marcar el plan de "${row.name}" como ${extra.status}? Queda auditado como ajuste manual.`)) return;
    } else if (verb === 'take-down') {
      if (!window.confirm(`Ã‚Â¿Dar de baja la pÃƒÂ¡gina de "${row.name}"? Se le saca de lÃƒÂ­nea al pÃƒÂºblico. Su contenido NO se borra y se puede restablecer en un clic.`)) return;
    } else if (!window.confirm(`Ã‚Â¿Restablecer la pÃƒÂ¡gina de "${row.name}"? VolverÃƒÂ¡ a estar visible para el pÃƒÂºblico.`)) return;

    setBusy(row.id); setError(''); setNotice('');
    try {
      const { data } = await api.put(`/admin/business-pages/${row.id}/${verb}`, extra);
      setRows((prev) => prev.map((r) => (r.id === row.id ? data.row : r)));
      setNotice(verb === 'take-down' ? `PÃƒÂ¡gina de ${row.name} dada de baja.` : `PÃƒÂ¡gina de ${row.name} restablecida.`);
      void load(filter, search);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'No se pudo completar la accion.');
    } finally { setBusy(''); }
  };

  const tarjetas = useMemo(() => (summary ? [
    { label: 'PÃƒÂ¡ginas en lÃƒÂ­nea', value: summary.live, tone: 'text-emerald-700' },
    { label: 'En gracia', value: summary.inGrace, tone: 'text-amber-700' },
    { label: 'Dadas de baja', value: summary.down, tone: 'text-rose-700' },
    { label: 'Suscripciones activas', value: summary.activeSubs, tone: 'text-stone-900' },
    { label: 'Ingreso mensual', value: CLP(summary.monthlyRevenue), tone: 'text-stone-900' },
  ] : []), [summary]);

  return (
    <div className="space-y-6" data-testid="admin-business-pages">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {tarjetas.map((t) => (
          <div key={t.label} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t.label}</p>
            <p className={`mt-1 text-2xl font-bold ${t.tone}`}>{t.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTROS_PAGINAS.map((f) => (
          <button key={f.id} type="button" onClick={() => { setFilter(f.id); void load(f.id, search); }}
            className={`min-h-10 rounded-xl px-3 text-sm font-semibold ${filter === f.id ? 'bg-neutral-950 text-white' : 'bg-white text-neutral-700 hover:bg-neutral-50'}`}>
            {f.label}
          </button>
        ))}
        <form className="relative ml-auto" onSubmit={(e) => { e.preventDefault(); void load(filter, search); }}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, slug o correo"
            className="min-h-10 w-64 rounded-xl border border-neutral-300 pl-9 pr-3 text-sm" />
        </form>
      </div>

      {notice && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

      {loading ? <p className="py-10 text-center text-neutral-500"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></p>
        : !rows.length ? <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">No hay paginas que coincidan con el filtro.</p>
        : (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Negocio</th><th className="px-4 py-3">Estado de la pagina</th>
                  <th className="px-4 py-3">Plan</th><th className="px-4 py-3">Proximo cobro</th>
                  <th className="px-4 py-3">Dueno</th><th className="px-4 py-3">Contenido</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => <PageRow key={r.id} row={r} busy={busy === r.id} onAccion={accion} onEliminar={eliminar} />)}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

/** Fila de la tabla. Va aparte para que el componente principal no crezca. */
function PageRow({ row, busy, onAccion, onEliminar }: { row: PageRow; busy: boolean; onAccion: any; onEliminar: any }) {
  return (
    <tr className="border-b last:border-0 hover:bg-neutral-50">
      <td className="px-4 py-3">
        <p className="font-semibold text-neutral-900">{row.name}</p>
        <p className="text-xs text-neutral-500">/{row.slug} · {row.category}</p>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${vidaStyle(row)}`}>
          {row.live ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <ShieldOff className="mr-1 h-3.5 w-3.5" />}
          {row.availabilityLabel}
        </span>
      </td>
      <td className="px-4 py-3">
        <p className="font-semibold">{row.amount ? CLP(row.amount) : '—'}</p>
        <p className="text-xs text-neutral-500">{row.subscriptionStatus || 'sin plan'}</p>
      </td>
      <td className="px-4 py-3">
        {row.availabilityReason === 'GRACE_ACTIVE'
          ? <span className="text-amber-700">Vence la gracia el {fecha(row.graceUntil)}</span>
          : <span className="text-neutral-600">{fecha(row.periodEnd)}</span>}
      </td>
      <td className="px-4 py-3 text-neutral-700">{row.ownerEmail || '—'}</td>
      <td className="px-4 py-3 text-xs text-neutral-600">
        {row.counts.services} servicios · {row.counts.products} productos · {row.counts.gallery} fotos
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          {row.live && (
            <button type="button" title="Dar de baja" disabled={busy} onClick={() => onAccion(row, 'take-down')}
              className="rounded-lg p-2 text-rose-700 hover:bg-rose-50 disabled:opacity-40"><ShieldOff className="h-4 w-4" /></button>
          )}
          {!row.live && row.status !== 'ARCHIVED' && (
            <button type="button" title="Restablecer" disabled={busy} onClick={() => onAccion(row, 'restore')}
              className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"><RotateCcw className="h-4 w-4" /></button>
          )}
          {row.subscriptionStatus && row.availabilityReason !== 'OK' && (
            <button type="button" title="Marcar plan al día" disabled={busy}
              onClick={() => onAccion(row, 'subscription', { status: 'ACTIVE' })}
              className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"><CreditCard className="h-4 w-4" /></button>
          )}
          <Link to={`/admin/negocios/${row.id}/editor`} title="Abrir editor"
            className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100"><Pencil className="h-4 w-4" /></Link>
          <button type="button" title="Eliminar página" data-testid="delete-page"
            disabled={busy} onClick={() => onEliminar(row)}
            className="rounded-lg p-2 text-rose-700 hover:bg-rose-50 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
        </div>
      </td>
    </tr>
  );
}

