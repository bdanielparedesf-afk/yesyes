import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, Tag } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { toast } from 'react-hot-toast';

export default function Cart() {
  const { items, removeItem, updateQuantity, totalPrice } = useCartStore();
  const navigate = useNavigate();
  const [coupon, setCoupon] = useState('');
  const [discount, setDiscount] = useState(0);

  const subtotal = totalPrice();
  const shipping = subtotal > 50000 ? 0 : 4990;
  const discountAmount = Math.round(subtotal * discount);
  const total = subtotal + shipping - discountAmount;

  const applyCoupon = () => {
    if (coupon.toLowerCase() === 'yesyes10') {
      setDiscount(0.1);
      toast.success('Cupón aplicado: 10% de descuento');
    } else {
      setDiscount(0);
      toast.error('Cupón inválido');
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <ShoppingBag className="w-24 h-24 text-gray-300 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900">Tu carrito está vacío</h2>
          <p className="text-gray-500">Agrega productos para comenzar tu compra.</p>
          <Link to="/productos" className="inline-flex items-center px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg shadow-lg shadow-primary-500/30 transition-all">
            Ir a Productos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Tu Carrito</h1>
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Tabla */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Producto</th>
                    <th className="text-center py-4 px-4 text-sm font-semibold text-gray-600">Cantidad</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold text-gray-600">Precio</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold text-gray-600">Subtotal</th>
                    <th className="py-4 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-4">
                          <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
                          <div>
                            <p className="font-semibold text-gray-900">{item.name}</p>
                            {item.variant && <p className="text-sm text-gray-500">{item.variant}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center space-x-2">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 rounded-md hover:bg-gray-100">
                            <Minus className="w-4 h-4 text-gray-600" />
                          </button>
                          <span className="w-8 text-center font-medium text-gray-900">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 rounded-md hover:bg-gray-100">
                            <Plus className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right text-gray-700">${item.price.toLocaleString('es-CL')}</td>
                      <td className="py-4 px-4 text-right font-semibold text-gray-900">${(item.price * item.quantity).toLocaleString('es-CL')}</td>
                      <td className="py-4 px-4 text-right">
                        <button onClick={() => { removeItem(item.id); toast.success('Producto eliminado'); }} className="p-2 text-red-500 hover:text-red-700 transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Resumen */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Resumen</h3>
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>${subtotal.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Envío</span>
                <span>{shipping === 0 ? 'Gratis' : `$${shipping.toLocaleString('es-CL')}`}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Descuento</span>
                  <span>-${discountAmount.toLocaleString('es-CL')}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold text-gray-900 pt-4 border-t border-gray-200">
                <span>Total</span>
                <span>${total.toLocaleString('es-CL')}</span>
              </div>

              {/* Cupón */}
              <div className="pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Cupón de descuento</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value)}
                    placeholder="Ingresa tu cupón"
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button onClick={applyCoupon} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors">
                    <Tag className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <button onClick={() => navigate('/checkout')} className="w-full mt-4 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-lg shadow-lg shadow-primary-500/30 transition-all flex items-center justify-center space-x-2">
                <span>Ir a pagar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
