import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Package, Truck, CheckCircle, Clock } from 'lucide-react';
import { getCustomerOrder, type CustomerOrder } from '@/services/orders';

export default function OrderDetail() {
  const { id = '' } = useParams();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    getCustomerOrder(id).then(setOrder).catch(() => setError('No pudimos cargar este pedido.')).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-gray-500" aria-busy="true">Cargando pedido…</div>;
  if (!order) return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center"><Package className="h-16 w-16 text-gray-300" /><h1 className="text-2xl font-bold">Pedido no encontrado</h1><p className="text-gray-500">{error || 'El pedido no existe o no te pertenece.'}</p><Link to="/mis-pedidos" className="rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white">Ver mis pedidos</Link></div>;

  const address = order.shippingAddress as { address?: string; city?: string; zip?: string };
  const StatusIcon = order.status === 'DELIVERED' ? CheckCircle : order.status === 'SHIPPED' ? Truck : Clock;
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/mis-pedidos" className="inline-flex items-center text-gray-600 hover:text-primary-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Volver a mis pedidos
        </Link>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
                <span className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                  <StatusIcon className="h-4 w-4" />
                  <span>{order.status}</span>
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">Fecha: {new Date(order.createdAt).toLocaleDateString('es-CL')}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold text-gray-900">${order.total.toLocaleString('es-CL')}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Productos</h2>
          <div className="space-y-4">
            {order.orderItems.map((item) => (
              <div key={item.id} className="flex items-center space-x-4">
                <img src={item.productImage} alt={item.productName} className="w-16 h-16 rounded-lg bg-gray-100 object-cover" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.productName}</p>
                  <p className="text-sm text-gray-500">Cantidad: {item.quantity}</p>
                </div>
                <span className="font-semibold text-gray-900">${item.totalPrice.toLocaleString('es-CL')}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Envío</h2>
          <div className="grid sm:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <p className="font-medium text-gray-900">Dirección</p>
              <p>{address.address || 'No informada'}{address.city ? `, ${address.city}` : ''}{address.zip ? ` · ${address.zip}` : ''}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
