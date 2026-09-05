import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, HelpCircle, Truck, Shield, RotateCcw, CreditCard } from 'lucide-react';

const faqs = [
  {
    question: '¿Cuáles son los métodos de pago aceptados?',
    answer: 'Aceptamos Mercado Pago, que incluye tarjetas de crédito (Visa, Mastercard, American Express), débito y transferencia bancaria. Todos los pagos son seguros y encriptados.',
    icon: CreditCard,
  },
  {
    question: '¿Cuánto tarda el envío?',
    answer: 'Los envíos a todo Chile demoran entre 7 y 15 días hábiles dependiendo de la región. Recibirás un código de seguimiento una vez despachado tu pedido.',
    icon: Truck,
  },
  {
    question: '¿Puedo devolver un producto?',
    answer: 'Sí, tienes hasta 30 días después de recibir tu pedido para solicitar una devolución. El producto debe estar en su estado original y con todos los empaques.',
    icon: RotateCcw,
  },
  {
    question: '¿Qué garantía tienen los productos?',
    answer: 'Todos nuestros productos cuentan con 30 días de garantía por defecto. Algunos productos incluyen garantía extendida del fabricante.',
    icon: Shield,
  },
  {
    question: '¿Cómo puedo rastrear mi pedido?',
    answer: 'Una vez que tu pedido sea despachado, recibirás un correo electrónico con el número de seguimiento y el enlace para rastrear tu envío en tiempo real.',
    icon: HelpCircle,
  },
  {
    question: '¿Hacen envíos a todo Chile?',
    answer: 'Sí, realizamos envíos a todas las regiones de Chile continental. Para zonas extremas consulta por tiempos de entrega específicos.',
    icon: Truck,
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const filtered = faqs.filter((f) => f.question.toLowerCase().includes(search.toLowerCase()) || f.answer.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900">Preguntas Frecuentes</h1>
          <p className="mt-4 text-gray-600">Encuentra respuestas a las dudas más comunes</p>
        </div>
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar pregunta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div className="space-y-4">
          {filtered.map((faq, index) => {
            const Icon = faq.icon;
            const isOpen = openIndex === index;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary-50 rounded-full">
                      <Icon className="w-5 h-5 text-primary-500" />
                    </div>
                    <span className="font-semibold text-gray-900">{faq.question}</span>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-6 text-gray-600 leading-relaxed pl-16">{faq.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">No se encontraron preguntas.</div>
        )}
      </div>
    </div>
  );
}
