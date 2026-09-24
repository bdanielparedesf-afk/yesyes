import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getBusiness, getBusinessCapabilities, saveBusinessCapabilities } from '@/services/business';

export default function AdminBusinessEditor() {
  const { id = '' } = useParams();
  const [business, setBusiness] = useState<any>(null);
  const [capabilities, setCapabilities] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => Promise.all([getBusiness(id), getBusinessCapabilities(id)]).then(([b, c]) => { setBusiness(b); setCapabilities(c.sections || []); }).catch((e) => setMessage(e?.response?.data?.message || 'No se pudo cargar el negocio'));
  useEffect(() => { load(); }, [id]);

  const move = (index: number, delta: number) => setCapabilities((items) => { const next = [...items]; const target = index + delta; if (target < 0 || target >= next.length) return items; [next[index], next[target]] = [next[target], next[index]]; return next.map((s, i) => ({ ...s, order: (i + 1) * 10 })); });
  const toggle = (id: string) => setCapabilities((items) => items.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s));
  const save = async () => { setBusy(true); try { await saveBusinessCapabilities(id, capabilities); await load(); setMessage('Capacidades guardadas'); } catch (e: any) { setMessage(e?.response?.data?.message || 'No se pudo guardar'); } finally { setBusy(false); } };

  return <div className="space-y-6"><div className="flex flex-wrap gap-3 items-center justify-between"><div><h1 className="text-2xl font-bold">Editor Business</h1><p className="text-sm text-neutral-500">{business?.name || 'Cargando…'}</p></div><Link className="underline text-sm" to="/admin/negocios">Volver</Link></div>{message && <p className="text-sm text-neutral-700">{message}</p>}<section className="bg-white rounded-xl border p-4 space-y-3"><h2 className="font-semibold">Secciones activas y orden</h2>{capabilities.map((s, i) => <div key={s.id} className="flex items-center gap-2 border rounded-lg p-2"><span className="font-mono text-sm w-16">{s.id}</span><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.enabled} onChange={() => toggle(s.id)} /> Activa</label><button type="button" className="ml-auto border rounded px-2" onClick={() => move(i, -1)} aria-label={`Subir ${s.id}`}>↑</button><button type="button" className="border rounded px-2" onClick={() => move(i, 1)} aria-label={`Bajar ${s.id}`}>↓</button></div>)}<button type="button" disabled={busy} onClick={save} className="bg-black text-white rounded-lg px-4 py-2 disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar capabilities'}</button></section></div>;
}
