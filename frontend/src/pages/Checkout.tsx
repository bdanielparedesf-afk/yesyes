import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCartStore } from '@/store/useCartStore';
import { toast } from 'react-hot-toast';
import { CreditCard, Shield, Truck, Loader2 } from 'lucide-react';
import { createPaymentPreference } from '@/services/payment';

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
          id: item.id,
          title: item.name,
          description: item.variant || '',
          price: item.price,
          quantity: item.quantity,
          image: item.image,
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
        total,
      });

      // En producción (credenciales APP_USR) MP devuelve init_point; el sandbox
      // solo existe con credenciales de prueba. Preferimos el real.
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
      <div className="min-h-screen bg-[#FFF8FA] flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-[#E8A0BF] animate-spin mx-auto" />
          <p className="text-[#4A2C3A]/70">Redirigiendo a Mercado Pago...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#FFF8FA] flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-[#4A2C3A]">Tu carrito está vacío</h2>
          <p className="text-[#4A2C3A]/60">Agrega productos para continuar con el pago.</p>
          <Link to="/productos" className="inline-flex items-center px-6 py-3 bg-[#E8A0BF] hover:bg-[#BA90C6] text-white font-semibold rounded-full shadow-lg shadow-[#E8A0BF]/30 transition-all">
            Ir a Productos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8FA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-[#4A2C3A] mb-8">Checkout</h1>
        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-[24px] shadow-sm border border-[#FAD3E7] p-6 space-y-4">
                <h2 className="text-xl font-bold text-[#4A2C3A]">Datos de envío</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#4A2C3A]/80 mb-1">Nombre completo</label>
                    <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-6 py-3 border border-[#FAD3E7] rounded-full focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#4A2C3A]/80 mb-1">Email</label>
                    <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-6 py-3 border border-[#FAD3E7] rounded-full focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#4A2C3A]/80 mb-1">Teléfono</label>
                    <input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-6 py-3 border border-[#FAD3E7] rounded-full focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#4A2C3A]/80 mb-1">Ciudad</label>
                    <input type="text" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full px-6 py-3 border border-[#FAD3E7] rounded-full focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-[#4A2C3A]/80 mb-1">Dirección</label>
                    <input type="text" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-6 py-3 border border-[#FAD3E7] rounded-full focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#4A2C3A]/80 mb-1">Código Postal</label>
                    <input type="text" required value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} className="w-full px-6 py-3 border border-[#FAD3E7] rounded-full focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]" />
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-white rounded-[24px] shadow-sm border border-[#FAD3E7] p-6 space-y-4">
                <h3 className="text-lg font-bold text-[#4A2C3A]">Resumen</h3>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center space-x-3">
                      <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#4A2C3A] truncate">{item.name}</p>
                        <p className="text-xs text-[#4A2C3A]/60">Cant: {item.quantity}</p>
                      </div>
                      <span className="text-sm font-semibold text-[#4A2C3A]">${(item.price * item.quantity).toLocaleString('es-CL')}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[#FAD3E7] pt-4 space-y-2">
                  <div className="flex justify-between text-[#4A2C3A]/70">
                    <span>Subtotal</span>
                    <span>${subtotal.toLocaleString('es-CL')}</span>
                  </div>
                  <div className="flex justify-between text-[#4A2C3A]/70">
                    <span className="flex items-center"><Truck className="w-4 h-4 mr-1" />Envío</span>
                    <span>{shipping === 0 ? 'Gratis' : `$${shipping.toLocaleString('es-CL')}`}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold text-[#4A2C3A] pt-2 border-t border-[#FAD3E7]">
                    <span>Total</span>
                    <span>${total.toLocaleString('es-CL')}</span>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full mt-4 flex items-center justify-center space-x-2 px-6 py-3 bg-[#E8A0BF] hover:bg-[#BA90C6] text-white font-bold rounded-full shadow-lg shadow-[#E8A0BF]/30 transition-all disabled:opacity-50">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                  <span>{loading ? 'Procesando...' : 'Pagar con Mercado Pago'}</span>
                </button>
                <p className="text-xs text-[#4A2C3A]/60 text-center flex items-center justify-center">
                  <Shield className="w-3 h-3 mr-1" /> Pago seguro y encriptado
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
