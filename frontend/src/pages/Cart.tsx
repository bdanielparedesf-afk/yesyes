import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, Tag } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { toast } from 'react-hot-toast';
import RemoteImage from '@/components/RemoteImage';

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
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md">
          <ShoppingBag className="w-24 h-24 text-neutral-300 mx-auto" />
          <h2 className="text-2xl font-bold text-neutral-900">Tu carrito está vacío</h2>
          <p className="text-neutral-500">
            Agrega productos para comenzar tu compra.
          </p>
          <Link
            to="/productos"
            className="inline-flex items-center px-8 py-3 bg-primary-700 hover:bg-primary-800 text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all"
          >
            Ver productos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-neutral-900 mb-8">Tu carrito</h1>
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart items: lista responsive (sin scroll horizontal en móvil) */}
          <div className="lg:col-span-2 bg-white rounded-[var(--radius-xl)] shadow-sm border border-neutral-100 overflow-hidden divide-y divide-neutral-100">
            {items.map((item) => (
              <div key={item.id} className="p-4 sm:p-6 flex gap-4 sm:gap-5 hover:bg-neutral-50/60 transition-colors">
                <RemoteImage
                  src={item.image}
                  alt={item.name}
                  loading="lazy"
                  decoding="async"
                  className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-xl object-cover border border-neutral-100 bg-neutral-50"
                />
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-neutral-900 text-sm sm:text-base line-clamp-2">{item.name}</p>
                      {item.variant && <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">{item.variant}</p>}
                      <p className="mt-1 text-sm text-neutral-500 sm:hidden">${item.price.toLocaleString('es-CL')} c/u</p>
                    </div>
                    <button
                      onClick={() => { removeItem(item.id); toast.success('Producto eliminado'); }}
                      aria-label={`Eliminar ${item.name} del carrito`}
                      className="p-2 rounded-full text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-auto pt-3 flex items-end justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        aria-label="Disminuir cantidad"
                        className="w-8 h-8 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center text-sm font-semibold text-neutral-900">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        aria-label="Aumentar cantidad"
                        className="w-8 h-8 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="hidden sm:block text-xs text-neutral-400">${item.price.toLocaleString('es-CL')} c/u</p>
                      <p className="font-bold text-neutral-900">
                        ${(item.price * item.quantity).toLocaleString('es-CL')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="space-y-6">
            <div className="bg-white rounded-[var(--radius-xl)] shadow-sm border border-neutral-100 p-6 space-y-4">
              <h3 className="text-lg font-bold text-neutral-900">Resumen</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal</span>
                  <span>${subtotal.toLocaleString('es-CL')}</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Envío</span>
                  <span>{shipping === 0 ? 'Gratis' : `$${shipping.toLocaleString('es-CL')}`}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-primary-700">
                    <span>Descuento</span>
                    <span>-${discountAmount.toLocaleString('es-CL')}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold text-neutral-900 pt-4 border-t border-neutral-100">
                  <span>Total</span>
                  <span>${total.toLocaleString('es-CL')}</span>
                </div>
              </div>

              {/* Coupon */}
              <div className="pt-4">
                <label className="block text-sm font-medium text-neutral-700 mb-2">Cupón de descuento</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value)}
                    placeholder="Ingresa tu cupón"
                    className="flex-1 px-4 py-2.5 text-sm border border-neutral-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={applyCoupon}
                    className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-full transition-colors"
                  >
                    <Tag className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <button
                onClick={() => navigate('/checkout')}
                className="w-full mt-4 py-3 bg-primary-700 hover:bg-primary-800 text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                Ir a pagar
              </button>
            </div>

            <Link
              to="/productos"
              className="block text-center text-sm text-neutral-600 hover:text-primary-700 transition-colors"
            >
              Continuar comprando
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
