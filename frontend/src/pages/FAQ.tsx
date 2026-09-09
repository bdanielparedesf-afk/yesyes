import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, HelpCircle, Truck, Shield, RotateCcw, CreditCard } from 'lucide-react';

const faqs = [
  {
    question: '¿Cuáles son los métodos de pago aceptados?',
    answer: 'Aceptamos tarjetas de crédito, débito y transferencia a través de MercadoPago. Pago 100% seguro. Tu pedido se procesa cuando el pago está confirmado.',
    icon: CreditCard,
  },
  {
    question: '¿Cuánto tarda el envío?',
    answer: 'Nuestros productos son importados y despachados por CJdropshipping. 15 a 25 días hábiles. Solo Chile donde CJ tenga cobertura.',
    icon: Truck,
  },
  {
    question: '¿Puedo devolver un producto?',
    answer: 'Devolución por arrepentimiento: 10 días, sin uso, en caja original. Costo de retorno lo paga el comprador. Escríbenos a yesyeswebsms@gmail.com.',
    icon: RotateCcw,
  },
  {
    question: '¿Qué garantía tienen los productos?',
    answer: 'Garantía legal 6 meses por falla de fábrica según ley chilena. Escríbenos a yesyeswebsms@gmail.com con video. No cubre mal uso o golpes.',
    icon: Shield,
  },
  {
    question: '¿Cómo puedo rastrear mi pedido?',
    answer: 'Una vez despachado tu pedido, recibirás el número de seguimiento en tu correo con el enlace para seguir tu envío en tiempo real. Si tienes dudas, escríbenos a yesyeswebsms@gmail.com y te ayudamos a rastrearlo.',
    icon: HelpCircle,
  },
  {
    question: '¿Hacen envíos a todo Chile?',
    answer: 'Despachamos solo a comunas y regiones donde CJdropshipping tenga cobertura dentro de Chile continental. No llegamos a bases militares, apartados ni zonas sin código postal.',
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
