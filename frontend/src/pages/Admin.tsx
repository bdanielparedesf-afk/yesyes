import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DollarSign, Loader2, Package, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/useAuthStore';

const ADMIN_EMAIL = 'bdanielparedesf@gmail.com';

/* ================= Tipos ================= */

interface DashboardProduct {
  id: string;
  name: string;
  slug?: string;
  status?: string;
  isActive?: boolean;
  stock?: number;
  supplierUrl?: string;
  productImages?: { url: string; alt?: string }[];
}

interface DashboardOrder {
  id: string;
  orderNumber?: string;
  total: number;
  status: string;
  createdAt: string;
  user?: { name?: string; lastName?: string; email?: string };
}

interface ProductsPayload {
  products?: DashboardProduct[];
  total?: number;
}

interface OrdersPayload {
  orders?: DashboardOrder[];
  total?: number;
}

interface UsersPayload {
  users?: unknown[];
  total?: number;
}

/* ============== Constantes ============== */

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  PAID: 'Pagado',
  PROCESSING: 'En preparación',
  SUPPLIER_ORDERED: 'Pedido al proveedor',
  SUPPLIER_PROCESSING: 'Proveedor preparando',
  SHIPPED: 'Enviado',
  IN_TRANSIT: 'En tránsito',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  REFUND_REQUESTED: 'Reembolso solicitado',
  REFUND_PROCESSING: 'Reembolso en proceso',
  REFUNDED: 'Reembolsado',
  DISPUTED: 'En disputa',
  PENDING: 'Pendiente',
  FULFILLED: 'Completado',
  RETURN_REQUESTED: 'Devolución solicitada',
  RETURNED: 'Devuelto',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: 'bg-amber-100 text-amber-800',
  PAID: 'bg-green-100 text-green-800',
  PROCESSING: 'bg-sky-100 text-sky-800',
  SUPPLIER_ORDERED: 'bg-indigo-100 text-indigo-800',
  SUPPLIER_PROCESSING: 'bg-indigo-100 text-indigo-800',
  SHIPPED: 'bg-blue-100 text-blue-800',
  IN_TRANSIT: 'bg-cyan-100 text-cyan-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
  REFUND_REQUESTED: 'bg-orange-100 text-orange-800',
  REFUND_PROCESSING: 'bg-orange-100 text-orange-800',
  REFUNDED: 'bg-rose-100 text-rose-800',
  DISPUTED: 'bg-red-100 text-red-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  FULFILLED: 'bg-emerald-100 text-emerald-800',
  RETURN_REQUESTED: 'bg-amber-100 text-amber-800',
  RETURNED: 'bg-gray-100 text-gray-800',
};

const ALERT_BADGES: Record<string, string> = {
  'SIN STOCK': 'bg-red-100 text-red-800',
  'STOCK BAJO': 'bg-amber-100 text-amber-800',
  'SIN LINK': 'bg-red-100 text-red-800',
  'NO PUBLICADO': 'bg-gray-200 text-gray-700',
};

/* =============== Helpers =============== */

const formatCLP = (n: number) => `$${Number(n).toLocaleString('es-CL')}`;

const compactCLP = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${Math.round(n / 1_000)}k` : `$${n}`;

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const clientName = (o: DashboardOrder) =>
  [o.user?.name, o.user?.lastName].filter(Boolean).join(' ') || o.user?.email || '—';

/**
 * Descarga un recurso probando varias URLs en orden. Permite usar primero los
 * endpoints públicos de la spec (/products, /orders, /users) y caer a los
 * equivalentes de /admin/* si aquellos aún no existen en el backend.
 */
async function fetchWithFallback<T>(urls: string[]): Promise<T | null> {
  for (const url of urls) {
    try {
      const res = await api.get(url);
      return res.data as T;
    } catch {
      // Se intenta con la siguiente URL.
    }
  }
  return null;
}

function getProductAlerts(p: DashboardProduct): { label: string; className: string }[] {
  const alerts: { label: string; className: string }[] = [];
  if (typeof p.stock === 'number' && p.stock <= 0) {
    alerts.push({ label: 'SIN STOCK', className: ALERT_BADGES['SIN STOCK'] });
  } else if (typeof p.stock === 'number' && p.stock < 5) {
    alerts.push({ label: 'STOCK BAJO', className: ALERT_BADGES['STOCK BAJO'] });
  }
  if (!p.supplierUrl) alerts.push({ label: 'SIN LINK', className: ALERT_BADGES['SIN LINK'] });
  const oculto = p.status ? p.status !== 'PUBLISHED' : p.isActive === false;
  if (oculto) alerts.push({ label: 'NO PUBLICADO', className: ALERT_BADGES['NO PUBLICADO'] });
  return alerts;
}

/* ============== Componentes ============== */

function KpiCard({
  label,
  value,
  subtext,
  icon: Icon,
  iconClassName,
  href,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  iconClassName: string;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="block bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 truncate">{value}</p>
          {subtext && <p className="mt-1 text-xs text-gray-400">{subtext}</p>}
        </div>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconClassName}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Link>
  );
}

export default function Admin() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL || user?.role === 'ADMIN';

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [products, setProducts] = useState<DashboardProduct[]>([]);
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalClients, setTotalClients] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [productsRes, ordersRes, usersRes] = await Promise.all([
        fetchWithFallback<ProductsPayload>(['/products?limit=1000', '/admin/products?limit=1000']),
        fetchWithFallback<OrdersPayload>(['/orders?limit=500', '/admin/orders?limit=500']),
        fetchWithFallback<UsersPayload>(['/users?limit=1', '/admin/users?limit=1']),
      ]);

      if (cancelled) return;

      const productList = productsRes?.products ?? [];
      setProducts(productList);
      setTotalProducts(productsRes?.total ?? productList.length);
      setOrders(ordersRes?.orders ?? []);
      setTotalClients(usersRes?.total ?? usersRes?.users?.length ?? 0);
      setFailed(!productsRes && !ordersRes && !usersRes);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const { ventasHoy, pedidosHoy } = useMemo(() => {
    const now = new Date();
    const today = orders.filter((o) => isSameDay(new Date(o.createdAt), now) && o.status !== 'CANCELLED');
    return {
      ventasHoy: today.reduce((acc, o) => acc + Number(o.total || 0), 0),
      pedidosHoy: today.length,
    };
  }, [orders]);

  const sales7Days = useMemo(() => {
    const days: { fecha: string; ventas: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ventas = orders
        .filter((o) => isSameDay(new Date(o.createdAt), d) && o.status !== 'CANCELLED')
        .reduce((acc, o) => acc + Number(o.total || 0), 0);
      days.push({ fecha: d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }), ventas });
    }
    return days;
  }, [orders]);

  const alertProducts = useMemo(() => products.filter((p) => getProductAlerts(p).length > 0), [products]);

  if (!isAdmin) return null;

  const ventasSemana = sales7Days.reduce((acc, d) => acc + d.ventas, 0);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Resumen general de tu tienda.</p>
      </div>

      {failed && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">
          No se pudieron cargar los datos del dashboard. Revisa tu conexión e intenta recargar la página.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
        </div>
      ) : (
        <>
          {/* KPIs: 3 cards, una por sección */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <KpiCard
              label="Total productos"
              value={totalProducts}
              subtext="Catálogo completo"
              icon={Package}
              iconClassName="bg-gray-100 text-gray-700"
              href="/admin/products"
            />
            <KpiCard
              label="Ventas hoy"
              value={formatCLP(ventasHoy)}
              subtext={`${pedidosHoy} ${pedidosHoy === 1 ? 'pedido' : 'pedidos'} hoy`}
              icon={DollarSign}
              iconClassName="bg-emerald-50 text-emerald-600"
              href="/admin/orders"
            />
            <KpiCard
              label="Total clientes"
              value={totalClients}
              subtext="Usuarios registrados"
              icon={Users}
              iconClassName="bg-blue-50 text-blue-600"
              href="/admin/users"
            />
          </div>

          {/* Gráfico: ventas últimos 7 días */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Ventas últimos 7 días</h2>
                <p className="text-xs text-gray-500 mt-0.5">Montos en CLP · excluye pedidos cancelados</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{formatCLP(ventasSemana)}</p>
                <p className="text-xs text-gray-400">Total 7 días</p>
              </div>
            </div>
            <div className="h-72 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sales7Days} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="fecha"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    tickFormatter={compactCLP}
                    domain={[0, (max: number) => Math.max(max, 1)]}
                  />
                  <Tooltip
                    formatter={(value) => [formatCLP(Number(value)), 'Ventas']}
                    cursor={{ fill: 'rgba(0, 128, 96, 0.06)' }}
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      fontSize: 12,
                      padding: '8px 12px',
                    }}
                  />
                  <Bar dataKey="ventas" fill="#008060" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Tablas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Últimos 5 pedidos */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Últimos 5 pedidos</h2>
                <Link to="/admin/orders" className="text-sm font-medium text-blue-600 hover:text-blue-800">
                  Ver todos
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Nº</th>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.slice(0, 5).map((o) => (
                      <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5 text-sm font-medium text-gray-900 whitespace-nowrap">
                          #{o.orderNumber || o.id.slice(-6).toUpperCase()}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-700 max-w-[180px] truncate">{clientName(o)}</td>
                        <td className="px-5 py-3.5 text-sm font-medium text-gray-900 whitespace-nowrap">
                          {formatCLP(Number(o.total))}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                              STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {STATUS_LABELS[o.status] || o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-500">
                          No hay pedidos registrados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Productos con alerta */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Productos con alerta</h2>
                <Link to="/admin/products" className="text-sm font-medium text-blue-600 hover:text-blue-800">
                  Ver todos
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Foto</th>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Alerta</th>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {alertProducts.slice(0, 5).map((p) => {
                      const alerts = getProductAlerts(p);
                      const image = p.productImages?.[0]?.url;
                      return (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3">
                            {image ? (
                              <img
                                src={image}
                                alt={p.name}
                                className="w-10 h-10 rounded-lg object-cover bg-gray-100 border border-gray-200"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
                                <Package className="w-4 h-4 text-gray-400" />
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3 text-sm font-medium text-gray-900 max-w-[200px] truncate">
                            {p.name}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap gap-1">
                              {alerts.map((a) => (
                                <span
                                  key={a.label}
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${a.className}`}
                                >
                                  {a.label}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Link
                              to="/admin/products"
                              className="text-sm font-medium text-blue-600 hover:text-blue-800"
                            >
                              Ver
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                    {alertProducts.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-500">
                          Sin alertas por ahora
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
