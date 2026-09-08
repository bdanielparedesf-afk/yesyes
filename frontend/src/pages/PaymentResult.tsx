import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Clock, ShoppingBag, Home } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';

type Kind = 'success' | 'failure' | 'pending';

const CONFIG: Record<Kind, { icon: any; color: string; title: string; desc: string }> = {
  success: {
    icon: CheckCircle2,
    color: 'text-green-500',
    title: '¡Pago realizado con éxito!',
    desc: 'Gracias por tu compra. Recibirás un correo con el detalle de tu pedido y seguiremos el despacho desde tu cuenta.',
  },
  failure: {
    icon: XCircle,
    color: 'text-red-500',
    title: 'El pago no se completó',
    desc: 'Hubo un problema al procesar el pago y no se realizó ningún cobro. Puedes intentarlo nuevamente cuando quieras.',
  },
  pending: {
    icon: Clock,
    color: 'text-amber-500',
    title: 'Pago pendiente',
    desc: 'Tu pago quedó pendiente de confirmación (por ejemplo, una transferencia). Se acreditará automáticamente y te avisaremos.',
  },
};

export default function PaymentResult({ kind }: { kind: Kind }) {
  const [searchParams] = useSearchParams();
  const clearCart = useCartStore((s) => s.clearCart);
  const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id');

  useEffect(() => {
    // El carrito solo se vacía cuando el pago fue aprobado.
    if (kind === 'success') {
      clearCart();
    }
  }, [kind, clearCart]);

  const { icon: Icon, color, title, desc } = CONFIG[kind];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center space-y-5"
      >
        <Icon className={`w-16 h-16 mx-auto ${color}`} />
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-500 text-sm">{desc}</p>

        {paymentId && (
          <p className="text-xs text-gray-400">
            N° de pago Mercado Pago: <span className="font-mono">{paymentId}</span>
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/30 transition-all"
          >
            <Home className="w-4 h-4" /> Volver al inicio
          </Link>
          <Link
            to="/productos"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-all"
          >
            <ShoppingBag className="w-4 h-4" /> Seguir comprando
          </Link>
        </div>
      </motion.div>
    </div>
  );
}