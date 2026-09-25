import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, ChevronRight, ShoppingBag, AlertCircle } from 'lucide-react';
import { getCustomerOrders, type CustomerOrder } from '@/services/orders';

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Pago pendiente', PAID: 'Pagado', PROCESSING: 'Procesando',
  SHIPPED: 'En camino', DELIVERED: 'Entregado', CANCELLED: 'Cancelado',
  FULFILLED: 'Completado', PARTIALLY_FULFILLED: 'Parcialmente enviado',
};

export default function Orders() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true); setError('');
    getCustomerOrders().then(setOrders).catch(() => setError('No pudimos cargar tus pedidos. Intenta nuevamente.')).finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-neutral-500" aria-busy="true">Cargando pedidos…</div>;
  return (
    <div className="min-h-screen bg-[#FFF8FA]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-3xl font-bold text-[#4A2C3A]">Mis Pedidos</h1>
        {error && <div role="alert" className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"><AlertCircle size={20} /><span>{error}</span><button type="button" onClick={load} className="ml-auto rounded-xl border border-red-300 px-3 py-2 text-sm font-semibold">Reintentar</button></div>}
        {!error && orders.length === 0 ? (
          <div className="space-y-4 py-16 text-center"><Package className="mx-auto h-16 w-16 text-[#FAD3E7]" /><h2 className="text-xl font-bold text-[#4A2C3A]">No tienes pedidos aún</h2><p className="text-[#4A2C3A]/60">Cuando realices una compra, aparecerá aquí.</p><Link to="/productos" className="mt-2 inline-flex items-center rounded-full bg-[#E8A0BF] px-6 py-3 font-semibold text-white"><ShoppingBag className="mr-2 h-5 w-5" />Ir a productos</Link></div>
        ) : (
          <div className="space-y-4">{orders.map((order) => <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-[#FAD3E7] bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-bold text-[#4A2C3A]">{order.orderNumber}</h2><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">{STATUS_LABELS[order.status] || order.status}</span></div><p className="mt-1 text-sm text-[#4A2C3A]/60">{new Date(order.createdAt).toLocaleDateString('es-CL')}</p></div><div className="flex items-center justify-between gap-6 sm:justify-end"><span className="text-lg font-bold">${order.total.toLocaleString('es-CL')}</span><Link to={`/pedido/${order.id}`} className="flex items-center font-medium text-[#B76E92]">Ver detalle <ChevronRight className="h-4 w-4" /></Link></div></div>
            <div className="mt-4 flex items-center gap-3 overflow-x-auto pb-2">{order.orderItems.map((item) => <img key={item.id} src={item.productImage} alt={item.productName} className="h-12 w-12 flex-none rounded-lg bg-stone-100 object-cover" />)}<span className="whitespace-nowrap text-sm text-[#4A2C3A]/60">{order.orderItems.reduce((sum, item) => sum + item.quantity, 0)} productos</span></div>
          </motion.div>)}</div>
        )}
      </div>
    </div>
  );
}
