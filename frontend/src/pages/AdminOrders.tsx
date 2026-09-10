import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { X, Loader2, ExternalLink } from 'lucide-react';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/useAuthStore';

const ADMIN_EMAIL = 'bdanielparedesf@gmail.com';

interface OrderItem {
  id: string;
  productId?: string;
  productName: string;
  productImage?: string;
  quantity: number;
  price: number;
  supplierUrl?: string;
}

interface OrderUser {
  id: string;
  name?: string;
  email?: string;
  lastName?: string;
  phone?: string;
}

interface Order {
  id: string;
  orderNumber?: string;
  status: string;
  total: number;
  subtotal?: number;
  shippingCost?: number;
  createdAt: string;
  shippingAddress?: any;
  user?: OrderUser;
  orderItems: OrderItem[];
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente', PAID: 'Pagado', SHIPPED: 'Enviado', DELIVERED: 'Entregado',
  FULFILLED: 'Completado', CANCELLED: 'Cancelado', REFUNDED: 'Reembolsado',
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800', PAID: 'bg-green-100 text-green-800',
  SHIPPED: 'bg-blue-100 text-blue-800', DELIVERED: 'bg-emerald-100 text-emerald-800',
  FULFILLED: 'bg-emerald-100 text-emerald-800', CANCELLED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-gray-100 text-gray-800',
};

const formatDateTime = (d: string) => new Date(d).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const formatCLP = (n: number) => `$${Number(n).toLocaleString('es-CL')}`;
const clientName = (o: Order) =>
  [o.user?.name, o.user?.lastName].filter(Boolean).join(' ') || o.user?.email || '—';

export default function AdminOrders() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = (user?.email?.toLowerCase() === ADMIN_EMAIL) || user?.role === 'ADMIN';

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/orders');
      setOrders(res.data.orders || res.data || []);
    } catch {
      toast.error('Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, []);

  if (!isAdmin) return null;

  const openModal = async (order: Order) => {
    setSelectedOrder(order);
    setSelectedStatus(order.status);
    try {
      const res = await api.get(`/admin/orders/${order.id}`);
      const full = res.data.order || res.data;
      if (full && full.id) {
        setSelectedOrder(full);
        setSelectedStatus(full.status);
      }
    } catch {
      // silent: usa snapshot de la tabla
    }
  };

  const closeModal = () => {
    setSelectedOrder(null);
    setSelectedStatus('');
  };

  const handleSaveStatus = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    try {
      await api.put(`/admin/orders/${selectedOrder.id}/status`, { status: selectedStatus });
      toast.success('Estado actualizado');
      closeModal();
      loadOrders();
    } catch {
      toast.error('Error al actualizar estado');
    } finally {
      setSaving(false);
    }
  };

  const getAddress = (order: Order) => {
    if (!order.shippingAddress) return 'Sin dirección';
    const a = order.shippingAddress;
    if (typeof a === 'string') return a;
    return `${a.street || ''} ${a.number || ''}, ${a.city || ''}, ${a.region || ''}`.replace(/,\s*,/g, ',').trim();
  };
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Pedidos</h2>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-900" /></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Nº</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Cliente</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Total CLP</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">#{o.orderNumber || o.id.slice(-6).toUpperCase()}</td>
                      <td className="px-6 py-3 text-sm text-gray-700">{clientName(o)}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{formatDateTime(o.createdAt)}</td>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{formatCLP(o.total)}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-800'}`}>
                          {STATUS_LABELS[o.status] || o.status}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <button onClick={() => openModal(o)} className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors" title="Ver detalle">
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No hay pedidos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Pedido #{selectedOrder.orderNumber || selectedOrder.id.slice(-6).toUpperCase()}</h3>
              <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">Cliente</p>
                  <p className="text-sm font-medium text-gray-900">{selectedOrder.user?.name || '—'}</p>
                  <p className="text-sm text-gray-600">{selectedOrder.user?.email || ''}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">Dirección</p>
                  <p className="text-sm text-gray-900">{getAddress(selectedOrder)}</p>
                  <p className="text-sm text-gray-600 mt-1">{formatDateTime(selectedOrder.createdAt)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-3">Productos</p>
                <div className="space-y-3">
                  {selectedOrder.orderItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 bg-gray-50 rounded-xl p-3">
                      <img src={item.productImage || '/placeholder.png'} alt={item.productName} className="w-14 h-14 rounded-lg object-cover bg-white flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                        <p className="text-sm text-gray-600">{item.quantity} x {formatCLP(item.price)}</p>
                      </div>
                      {item.supplierUrl && (
                        <a href={item.supplierUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex-shrink-0">
                          <ExternalLink className="w-3.5 h-3.5" /> Ver original
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span><span>{formatCLP(selectedOrder.subtotal ?? selectedOrder.total)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Envío</span><span>{formatCLP(selectedOrder.shippingCost ?? 0)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-gray-900 pt-1.5 border-t border-gray-200">
                  <span>Total</span><span>{formatCLP(selectedOrder.total)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="PENDING">Pendiente</option>
                  <option value="PAID">Pagado</option>
                  <option value="SHIPPED">Enviado</option>
                  <option value="DELIVERED">Entregado</option>
                  <option value="FULFILLED">Completado</option>
                  <option value="CANCELLED">Cancelado</option>
                  <option value="REFUNDED">Reembolsado</option>
                </select>
                <button onClick={handleSaveStatus} disabled={saving} className="px-4 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
                  {saving ? 'Guardando...' : 'Guardar estado'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
