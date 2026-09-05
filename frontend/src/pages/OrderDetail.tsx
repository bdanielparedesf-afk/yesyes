import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Package, Truck, CheckCircle, Clock } from 'lucide-react';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  image: string;
}

interface Order {
  id: string;
  date: string;
  status: string;
  total: number;
  shipping: number;
  items: OrderItem[];
  address: string;
  city: string;
  tracking?: string;
}

const mockOrder: Order = {
  id: 'ORD-1001',
  date: '2025-01-15',
  status: 'Entregado',
  total: 59980,
  shipping: 0,
  items: [
    { name: 'Audífonos Bluetooth Pro', quantity: 1, price: 19990, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop' },
    { name: 'Mouse Inalámbrico Ergo', quantity: 2, price: 9990, image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=400&fit=crop' },
  ],
  address: 'Av. Providencia 1234',
  city: 'Santiago',
  tracking: 'CHL123456789',
};

export default function OrderDetail() {
  const { id } = useParams();
  const order = id === mockOrder.id ? mockOrder : null;

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <Package className="w-16 h-16 text-gray-300 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900">Pedido no encontrado</h2>
          <p className="text-gray-500">El pedido que buscas no existe.</p>
          <Link to="/mis-pedidos" className="inline-flex items-center px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg shadow-lg shadow-primary-500/30 transition-all">
            Ver mis pedidos
          </Link>
        </div>
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (order.status) {
      case 'Entregado':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'En camino':
        return <Truck className="w-5 h-5 text-blue-600" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

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
                <h1 className="text-2xl font-bold text-gray-900">{order.id}</h1>
                <span className="flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                  {getStatusIcon()}
                  <span className="ml-1">{order.status}</span>
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">Fecha: {new Date(order.date).toLocaleDateString('es-CL')}</p>
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
            {order.items.map((item, idx) => (
              <div key={idx} className="flex items-center space-x-4">
                <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-500">Cantidad: {item.quantity}</p>
                </div>
                <span className="font-semibold text-gray-900">${(item.price * item.quantity).toLocaleString('es-CL')}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Envío</h2>
          <div className="grid sm:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <p className="font-medium text-gray-900">Dirección</p>
              <p>{order.address}, {order.city}</p>
            </div>
            {order.tracking && (
              <div>
                <p className="font-medium text-gray-900">Seguimiento</p>
                <p>{order.tracking}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
