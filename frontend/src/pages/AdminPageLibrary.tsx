/**
 * BIBLIOTECA DE EJEMPLARES (solo admin).
 *
 * QUÉ HACE: guarda una página que ya quedó bien como "ejemplo" y después crea
 * páginas nuevas a partir de ella, con el mismo contenido y diseño. Es la
 * diferencia entre armar una peluquería desde cero y entregarla en diez
 * minutos con la estructura ya resuelta.
 *
 * POR QUÉ ESTÁ SEPARADA DE LA LISTA DE NEGOCIOS: los ejemplos no son páginas
 * de clientes. No tienen dueño, no se publican y no se cobran, así que
 * meterlos en la lista de negocios obligaría a filtrar constantemente filas
 * que no son lo que el admin está buscando.
 *
 * UNA COPIA, NO UN ENLACE: si el ejemplo fuera una referencia a la página
 * original, editar la original cambiaría el ejemplo detrás de la espalda, y
 * borrar la original se llevaría el ejemplo. Por eso el contenido se guarda
 * copiado: sobrevive al borrado de la página de la que salió.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore, BookMarked, Loader2, Search, Trash2, UserRound } from 'lucide-react';
import api from '@/lib/axios';

interface LibraryEntry {
  id: string;
  name: string;
  description: string | null;
  label: string | null;
  category: string | null;
  sourceBusinessName: string | null;
  timesUsed: number;
  archived: boolean;
  createdAt: string;
  counts: { services: number; products: number; gallery: number; properties: number };
}

export default function AdminPageLibrary() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState('');
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  /** Ejemplo abierto para crear una página nueva a partir de él. */
  const [reuseFrom, setReuseFrom] = useState<LibraryEntry | null>(null);
  const [newName, setNewName] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<LibraryEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [library, users] = await Promise.all([
        api.get('/admin/page-library', { params: { includeArchived: 1, search: search || undefined } }),
        api.get('/admin/businesses/candidates'),
      ]);
      setEntries(library.data.entries || []);
      setCandidates(users.data.users || []);
    } catch {
      setMessage({ type: 'error', text: 'No se pudo cargar la biblioteca.' });
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const totales = useMemo(() => ({
    ejemplos: entries.filter((e) => !e.archived).length,
    apartados: entries.filter((e) => e.archived).length,
    usos: entries.reduce((acc, e) => acc + e.timesUsed, 0),
  }), [entries]);

  const apartar = async (entry: LibraryEntry) => {
    setActionId(entry.id); setMessage(null);
    try {
      await api.put(`/admin/page-library/${entry.id}`, { archived: !entry.archived });
      await load();
      setMessage({ type: 'ok', text: entry.archived ? `“${entry.name}” vuelve a estar disponible.` : `“${entry.name}” quedó apartado.` });
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.response?.data?.message || 'No se pudo actualizar el ejemplo.' });
    } finally { setActionId(''); }
  };

  const borrar = async () => {
    if (!confirmDelete) return;
    const objetivo = confirmDelete;
    setActionId(objetivo.id); setMessage(null);
    try {
      await api.delete(`/admin/page-library/${objetivo.id}`);
      setConfirmDelete(null);
      await load();
      setMessage({ type: 'ok', text: `Se eliminó el ejemplo “${objetivo.name}”.` });
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.response?.data?.message || 'No se pudo eliminar el ejemplo.' });
    } finally { setActionId(''); }
  };

  const reuse = async () => {
    if (!reuseFrom || !newName.trim() || !newOwner) return;
    setActionId(reuseFrom.id); setMessage(null);
    try {
      const { data } = await api.post(`/admin/page-library/${reuseFrom.id}/reuse`, {
        name: newName.trim(), ownerId: newOwner,
      });
      const { businessId } = data;
      setReuseFrom(null); setNewName(''); setNewOwner('');
      setMessage({ type: 'ok', text: 'Página creada desde el ejemplo. Abriendo el editor…' });
      navigate(`/admin/negocios/${businessId}/editor`);
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.response?.data?.message || 'No se pudo crear la página desde el ejemplo.' });
    } finally { setActionId(''); }
  };

  /** Texto de "qué trae este ejemplo", para que el admin no abra cada tarjeta. */
  const resumen = (entry: LibraryEntry) => {
    const partes = [
      entry.counts.services && `${entry.counts.services} servicios`,
      entry.counts.products && `${entry.counts.products} productos`,
      entry.counts.gallery && `${entry.counts.gallery} fotos`,
      entry.counts.properties && `${entry.counts.properties} propiedades`,
    ].filter(Boolean);
    return partes.length ? partes.join(' · ') : 'Sin contenido guardado';
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary-700">YesYes Business</p>
        <h1 className="mt-1 flex items-center gap-2 text-3xl font-black text-neutral-950">
          <BookMarked className="h-7 w-7" /> Biblioteca de ejemplos
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Guarda una página que quedó bien y úsala de base para crear las siguientes.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumen de la biblioteca">
        {[
          { label: 'Ejemplos disponibles', value: totales.ejemplos },
          { label: 'Apartados', value: totales.apartados },
          { label: 'Veces reutilizados', value: totales.usos },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-neutral-500">{item.label}</p>
            <p className="mt-2 text-3xl font-black text-neutral-950">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm" aria-label="Buscar ejemplos">
        <label className="relative block">
          <span className="sr-only">Buscar ejemplos</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o tipo" className="min-h-11 w-full rounded-xl border border-neutral-300 pl-10 pr-4 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200" />
        </label>
      </section>

      {message && (
        <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {message.text}
        </div>
      )}


      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Cargando ejemplos" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-44 animate-pulse rounded-2xl border border-neutral-200 bg-white" />)}
        </div>
      ) : !entries.length ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <BookMarked className="mx-auto h-10 w-10 text-neutral-300" aria-hidden />
          <h2 className="mt-3 font-bold text-neutral-900">Todavía no hay ejemplos</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">
            Abre una página que haya quedado bien y guárdala como ejemplo desde la lista de negocios.
            Quedará aquí aunque borres la página original.
          </p>
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Ejemplos">
          {entries.map((entry) => (
            <article key={entry.id} className={`flex min-h-44 flex-col rounded-2xl border bg-white p-5 shadow-sm ${entry.archived ? 'border-neutral-200 opacity-60' : 'border-neutral-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="line-clamp-1 font-bold text-neutral-950">{entry.name}</h2>
                {entry.archived && <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-600">Apartado</span>}
              </div>
              {entry.label && <p className="mt-1 text-sm font-semibold text-primary-700">{entry.label}</p>}
              <p className="mt-1 text-xs text-neutral-500">{resumen(entry)}</p>
              {entry.sourceBusinessName && (
                <p className="mt-1 truncate text-xs text-neutral-400">Viene de “{entry.sourceBusinessName}”</p>
              )}
              <p className="mt-2 text-xs text-neutral-400">
                {entry.category ? `${entry.category} · ` : ''}usado {entry.timesUsed} {entry.timesUsed === 1 ? 'vez' : 'veces'}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4 text-xs">
                <button
                  type="button"
                  disabled={entry.archived || actionId === entry.id}
                  onClick={() => { setReuseFrom(entry); setNewName(`${entry.name} (copia)`); }}
                  data-testid="library-reuse"
                  className="inline-flex items-center gap-1 rounded-lg bg-neutral-950 px-3 py-1.5 font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Usar este ejemplo
                </button>
                <button
                  type="button"
                  disabled={actionId === entry.id}
                  onClick={() => apartar(entry)}
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                >
                  {entry.archived ? <><ArchiveRestore className="h-3.5 w-3.5" /> Reactivar</> : <><Archive className="h-3.5 w-3.5" /> Apartar</>}
                </button>
                <button
                  type="button"
                  disabled={actionId === entry.id}
                  onClick={() => setConfirmDelete(entry)}
                  aria-label={`Eliminar el ejemplo ${entry.name}`}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {reuseFrom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="reuse-title" data-testid="library-reuse-dialog">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="reuse-title" className="text-lg font-black text-neutral-950">Crear página desde “{reuseFrom.name}”</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Se crea una página nueva con el mismo contenido y diseño. La página original
              no se toca, y la nueva queda en borrador hasta que la publiques.
            </p>
            <label className="mt-5 block text-sm font-semibold text-neutral-800">
              Nombre de la página nueva
              <input autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Ej: Peluquería Luna Osorno" className="mt-2 min-h-11 w-full rounded-xl border border-neutral-300 px-3 font-normal focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200" />
            </label>
            <label className="mt-4 block text-sm font-semibold text-neutral-800">
              Cliente
              <select value={newOwner} onChange={(event) => setNewOwner(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-neutral-300 px-3 font-normal focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200">
                <option value="">Selecciona un cliente</option>
                {candidates.map((user) => <option key={user.id} value={user.id}>{[user.name, user.lastName].filter(Boolean).join(' ')} · {user.email}</option>)}
              </select>
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setReuseFrom(null)} className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">Cancelar</button>
              <button
                type="button"
                onClick={reuse}
                disabled={!newName.trim() || !newOwner || actionId === reuseFrom.id}
                data-testid="library-reuse-confirm"
                className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {actionId === reuseFrom.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}
                Crear página
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="library-delete-title" data-testid="library-delete-dialog">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="library-delete-title" className="text-lg font-black text-neutral-950">¿Eliminar el ejemplo “{confirmDelete.name}”?</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Se borra la copia guardada y no se puede recuperar. Si solo quieres dejar de
              usarlo, conviene Apartarlo.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">Cancelar</button>
              <button
                type="button"
                onClick={borrar}
                disabled={actionId === confirmDelete.id}
                data-testid="library-delete-confirm"
                className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-60"
              >
                {actionId === confirmDelete.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
