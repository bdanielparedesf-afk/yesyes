import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCartStore } from '@/store/useCartStore';
import { toast } from 'react-hot-toast';
import { CreditCard, Shield, Loader2, MapPin, User, Mail, Phone, ShoppingCart } from 'lucide-react';
import { createPaymentPreference } from '@/services/payment';
import RemoteImage from '@/components/RemoteImage';

export default function Checkout() {
  const { items, totalPrice } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    zip: '',
  });

  const subtotal = totalPrice();
  const shipping = subtotal > 50000 ? 0 : 4990;
  const total = subtotal + shipping;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await createPaymentPreference({
        items: items.map((item) => ({
          productId: item.productId || item.id || '',
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        payer: {
          name: form.name,
          surname: '',
          email: form.email,
          phone: {
            area_code: '+56',
            number: form.phone,
          },
        },
        shippingAddress: {
          address: form.address,
          city: form.city,
          zip: form.zip,
        },
      });

      const initPoint = response.init_point || response.sandbox_init_point;
      window.location.href = initPoint;
    } catch (error: any) {
      const errDetail = error?.response?.data?.detail || error?.message || 'Error desconocido';
      console.error('Error creating payment preference:', errDetail);
      toast.error(error.response?.data?.detail || error.response?.data?.message || 'Error al crear preferencia');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary-700 animate-spin mx-auto" />
          <p className="text-neutral-500">Redirigiendo a Mercado Pago...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-24 h-24 bg-neutral-100 rounded-full flex items-center justify-center mx-auto">
            <ShoppingCart className="w-10 h-10 text-neutral-300" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900">Tu carrito está vacío</h2>
          <p className="text-neutral-500">Agrega productos para continuar con el pago.</p>
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
        <h1 className="text-3xl font-bold text-neutral-900 mb-8">Checkout</h1>
        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Form */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-[var(--radius-xl)] shadow-sm border border-neutral-100 p-6 space-y-6">
                <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary-700" />
                  Datos de envío
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Nombre completo</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        placeholder="Juan Pérez"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        placeholder="tu@email.com"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Teléfono</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <input
                        type="tel"
                        required
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        placeholder="+56 9 1234 5678"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Dirección</label>
                    <input
                      type="text"
                      required
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className="w-full px-4 py-2.5 border border-neutral-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      placeholder="Calle, número, departamento"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Ciudad</label>
                    <input
                      type="text"
                      required
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="w-full px-4 py-2.5 border border-neutral-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      placeholder="Santiago"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Código Postal</label>
                    <input
                      type="text"
                      required
                      value={form.zip}
                      onChange={(e) => setForm({ ...form, zip: e.target.value })}
                      className="w-full px-4 py-2.5 border border-neutral-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      placeholder="8340000"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-6">
              <div className="bg-white rounded-[var(--radius-xl)] shadow-sm border border-neutral-100 p-6 space-y-4">
                <h3 className="text-lg font-bold text-neutral-900">Resumen del pedido</h3>
                <div className="space-y-3 text-sm">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <RemoteImage src={item.image} alt={item.name} decoding="async" className="w-10 h-10 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 truncate">{item.name}</p>
                        <p className="text-xs text-neutral-500">x{item.quantity}</p>
                      </div>
                      <span className="text-sm font-medium text-neutral-900">
                        ${(item.price * item.quantity).toLocaleString('es-CL')}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-neutral-100 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-neutral-600">
                    <span>Subtotal</span>
                    <span>${subtotal.toLocaleString('es-CL')}</span>
                  </div>
                  <div className="flex justify-between text-neutral-600">
                    <span>Envío</span>
                    <span>{shipping === 0 ? 'Gratis' : `$${shipping.toLocaleString('es-CL')}`}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold text-neutral-900 pt-2 border-t border-neutral-100">
                    <span>Total</span>
                    <span>${total.toLocaleString('es-CL')}</span>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full mt-4 py-3 bg-primary-700 hover:bg-primary-800 text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-5 h-5" />
                  Pagar con Mercado Pago
                </button>
                <p className="text-xs text-neutral-500 flex items-center justify-center gap-1">
                  <Shield className="w-3 h-3" />
                  Pago seguro con Mercado Pago
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
