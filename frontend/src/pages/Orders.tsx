import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, ChevronRight, ShoppingBag } from 'lucide-react';

interface Order {
  id: string;
  date: string;
  status: string;
  total: number;
  items: { name: string; quantity: number; image: string }[];
}

const mockOrders: Order[] = [
  {
    id: 'ORD-1001',
    date: '2025-01-15',
    status: 'Entregado',
    total: 59980,
    items: [
      { name: 'Audífonos Bluetooth Pro', quantity: 1, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop' },
      { name: 'Mouse Inalámbrico Ergo', quantity: 2, image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=400&fit=crop' },
    ],
  },
  {
    id: 'ORD-1002',
    date: '2025-02-20',
    status: 'En camino',
    total: 34990,
    items: [
      { name: 'Teclado Mecánico RGB', quantity: 1, image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=400&fit=crop' },
    ],
  },
  {
    id: 'ORD-1003',
    date: '2025-03-05',
    status: 'Procesando',
    total: 15990,
    items: [
      { name: 'Mochila Impermeable Urban', quantity: 1, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop' },
    ],
  },
];

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('yesyes-orders');
    if (stored) {
      setOrders(JSON.parse(stored));
    } else {
      setOrders(mockOrders);
      localStorage.setItem('yesyes-orders', JSON.stringify(mockOrders));
    }
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Entregado':
        return 'bg-green-100 text-green-700';
      case 'En camino':
        return 'bg-blue-100 text-blue-700';
      case 'Procesando':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-[#FAD3E7]/40 text-[#4A2C3A]/70';
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8FA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-[#4A2C3A] mb-8">Mis Pedidos</h1>
        {orders.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <Package className="w-16 h-16 text-[#FAD3E7] mx-auto" />
            <h2 className="text-xl font-bold text-[#4A2C3A]">No tienes pedidos aún</h2>
            <p className="text-[#4A2C3A]/60">Cuando realices tu primera compra, aparecerá aquí.</p>
            <Link to="/productos" className="inline-flex items-center px-6 py-3 bg-[#E8A0BF] hover:bg-[#BA90C6] text-white font-semibold rounded-full shadow-lg shadow-[#E8A0BF]/30 transition-all">
              <ShoppingBag className="w-5 h-5 mr-2" />
              Ir a Productos
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[24px] shadow-sm border border-[#FAD3E7] p-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-bold text-[#4A2C3A]">{order.id}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-sm text-[#4A2C3A]/60 mt-1">Fecha: {new Date(order.date).toLocaleDateString('es-CL')}</p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end space-x-6">
                    <span className="text-lg font-bold text-[#4A2C3A]">${order.total.toLocaleString('es-CL')}</span>
                    <Link to={`/pedido/${order.id}`} className="flex items-center text-[#E8A0BF] hover:text-[#BA90C6] font-medium">
                      Ver detalle <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
                <div className="mt-4 flex items-center space-x-3 overflow-x-auto pb-2">
                  {order.items.map((item, idx) => (
                    <img key={idx} src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  ))}
                  <span className="text-sm text-[#4A2C3A]/60">{order.items.reduce((a, b) => a + b.quantity, 0)} productos</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
