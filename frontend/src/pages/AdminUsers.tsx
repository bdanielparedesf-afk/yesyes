import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Loader2, Eye, X } from 'lucide-react';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/useAuthStore';

const ADMIN_EMAIL = 'bdanielparedesf@gmail.com';

interface AdminUser {
  id: string;
  name?: string;
  lastName?: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  CUSTOMER: 'Cliente',
  SUPPORT: 'Soporte',
  AUDITOR: 'Auditor',
};
const roleLabel = (role: string) => ROLE_LABELS[role] || role;
const roleColor = (role: string) => {
  if (role === 'ADMIN') return 'bg-purple-100 text-purple-800';
  if (role === 'SUPPORT') return 'bg-sky-100 text-sky-800';
  if (role === 'AUDITOR') return 'bg-amber-100 text-amber-800';
  return 'bg-gray-100 text-gray-800';
};

const formatDate = (d: string) => {
  const dt = new Date(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

export default function AdminUsers() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = (user?.email?.toLowerCase() === ADMIN_EMAIL) || user?.role === 'ADMIN';

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AdminUser | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data.users || res.data || []);
    } catch {
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  if (!isAdmin) return null;

  const handleChangeRole = async (u: AdminUser) => {
    const nuevoRole = u.role === 'ADMIN' ? 'CUSTOMER' : 'ADMIN';
    const nuevoLabel = roleLabel(nuevoRole);
    if (!confirm(`Cambiar a ${nuevoLabel}?`)) return;
    try {
      await api.put(`/admin/users/${u.id}/role`, { role: nuevoRole });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role: nuevoRole } : x)));
      toast.success('Rol actualizado');
    } catch {
      toast.error('Error al cambiar rol');
    }
  };

  const handleToggleActive = async (u: AdminUser) => {
    if (!confirm(u.isActive ? 'Bloquear a este usuario?' : 'Desbloquear?')) return;
    try {
      const { data } = await api.put(`/admin/users/${u.id}/active`);
      setUsers((prev) => prev.map((x) => (x.id === data.id ? data : x)));
      toast.success(data.isActive ? 'Desbloqueado' : 'Bloqueado');
    } catch {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: !x.isActive } : x)));
      toast.success(u.isActive ? 'Bloqueado' : 'Desbloqueado');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Usuarios</h2>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs uppercase">Nombre</th>
                  <th className="text-left px-6 py-3 text-xs uppercase">Email</th>
                  <th className="text-left px-6 py-3 text-xs uppercase">Rol</th>
                  <th className="text-left px-6 py-3 text-xs uppercase">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">{`${u.name || ''} ${u.lastName || ''}`.trim() || '—'}</td>
                    <td className="px-6 py-4 text-sm">{u.email}</td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs ${roleColor(u.role)}`}>{roleLabel(u.role)}</span>{!u.isActive && (<span className="ml-2 bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">BLOQUEADO</span>)}</td>
                    <td className="px-6 py-4 text-sm">{formatDate(u.createdAt)}</td>
                    <td className="px-6 py-4"><div className="flex gap-2"><button onClick={() => handleChangeRole(u)} className="px-3 py-1.5 text-xs border rounded-lg">Cambiar Rol</button><button onClick={() => handleToggleActive(u)} className="px-3 py-1.5 text-xs rounded-lg bg-red-50 text-red-700">{u.isActive ? 'Bloquear' : 'Desbloquear'}</button><button onClick={() => setSelected(u)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Eye className="w-4 h-4" /></button></div></td>
                  </tr>
                ))}
                {users.length === 0 && (<tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No hay usuarios</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Detalle usuario</h3>
              <button onClick={() => setSelected(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-2 text-sm">
              <p><span className="font-medium text-gray-900">Nombre:</span> {`${selected.name || ''} ${selected.lastName || ''}`.trim() || '—'}</p>
              <p><span className="font-medium text-gray-900">Email:</span> {selected.email}</p>
              <p><span className="font-medium text-gray-900">Rol:</span> {roleLabel(selected.role)}</p>
              <p><span className="font-medium text-gray-900">Estado:</span> {selected.isActive ? 'Activo' : 'Bloqueado'}</p>
              <p><span className="font-medium text-gray-900">Fecha:</span> {formatDate(selected.createdAt)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

