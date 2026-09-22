import { useEffect, useState } from 'react';
import api from '@/lib/axios';

export default function AdminBusinesses() {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    api.get('/admin/businesses').then((r) => setList(r.data.businesses || [])).catch(() => setList([]));
  }, []);
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Negocios</h1>
      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-3">Nombre</th>
              <th className="p-3">Propietario</th>
              <th className="p-3">Categoría</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id} className="border-b">
                <td className="p-3">{b.name}</td>
                <td className="p-3">{b.owner?.email}</td>
                <td className="p-3">{b.category}</td>
                <td className="p-3">{b.status}</td>
                <td className="p-3 flex gap-2">
                  <a className="underline" href={`/mi-negocio/${b.slug}`} target="_blank" rel="noreferrer">Ver</a>
                  <button className="underline" onClick={() => api.put(`/businesses/${b.id}`, { status: 'PUBLISHED' }).then(() => window.location.reload())}>Publicar</button>
                  <button className="underline" onClick={() => api.put(`/businesses/${b.id}`, { status: 'PAUSED' }).then(() => window.location.reload())}>Pausar</button>
                  <button className="underline" onClick={() => api.delete(`/businesses/${b.id}`).then(() => window.location.reload())}>Archivar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <p className="p-4 text-neutral-500">Sin negocios.</p>}
      </div>
    </div>
  );
}
