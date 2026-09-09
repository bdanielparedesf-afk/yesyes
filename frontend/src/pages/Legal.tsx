import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Truck, RotateCcw, DollarSign, FileText, ShieldCheck, Cookie, Mail, MapPin, AlertCircle } from 'lucide-react';

export const CONTACT_EMAIL = 'yesyeswebsms@gmail.com';

interface Section {
  title: string;
  items: string[];
}

interface LegalDoc {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  sections: Section[];
  highlight?: string;
}

const docs: Record<string, LegalDoc> = {
  envios: {
    title: 'Política de Envíos',
    subtitle: 'Todo lo que necesitas saber sobre la entrega de tu pedido',
    icon: Truck,
    sections: [
      {
        title: 'Tiempo de entrega',
        items: [
          'De 15 a 25 días hábiles desde que tu pago es confirmado.',
          'Trabajamos con despacho internacional vía CJdropshipping.',
          'Tu pedido se procesa apenas el pago aparece confirmado en MercadoPago.',
        ],
      },
      {
        title: 'Cobertura',
        items: [
          'Despachamos solo a direcciones donde CJdropshipping tenga cobertura dentro de Chile continental.',
          'No llegamos a bases militares, apartados (casillas) ni zonas sin código postal.',
          'Si tu dirección no tiene cobertura, te avisamos y te reembolsamos el 100% antes del envío.',
        ],
      },
      {
        title: 'Seguimiento',
        items: [
          `Una vez enviado tu pedido, te llega el número de seguimiento a ${CONTACT_EMAIL}.`,
          'Los retrasos de aduana o del courier no son responsabilidad de YESYES, pero te ayudamos a rastrear tu pedido.',
        ],
      },
    ],
  },
  devoluciones: {
    title: 'Devoluciones y Garantía',
    subtitle: 'Tienes 10 días corridos para cambiar de opinión',
    icon: RotateCcw,
    sections: [
      {
        title: 'Devoluciones',
        items: [
          'Tienes 10 días corridos desde que recibes el producto para solicitar devolución.',
          'Solo aceptamos productos sin uso, en su empaque original.',
          `Escríbenos a ${CONTACT_EMAIL} con fotos del producto para iniciar el proceso.`,
          'Si tu comuna no tiene cobertura de CJ, no podemos despachar: te reembolsamos el 100% antes del envío.',
        ],
      },
      {
        title: 'Garantía',
        items: [
          'Garantía de 10 días por falla de fábrica.',
          `Debes enviar video o foto a ${CONTACT_EMAIL} mostrando la falla.`,
          'No hay garantía por mal uso, golpes, caídas o desgaste normal del producto.',
        ],
      },
    ],
    highlight: 'El costo de envío de retorno lo paga el cliente, salvo que sea falla de fábrica.',
  },
  reembolsos: {
    title: 'Política de Reembolsos',
    subtitle: 'Cómo y cuándo recibes tu dinero de vuelta',
    icon: DollarSign,
    sections: [
      {
        title: 'Plazos',
        items: [
          'Si tu devolución es aprobada, el reembolso se hace en 5 a 10 días hábiles.',
          'El dinero vuelve al mismo medio de pago que usaste en la compra.',
        ],
      },
      {
        title: 'Costos',
        items: [
          'El costo de envío de retorno lo paga el cliente.',
          'Excepción: si el producto tiene falla de fábrica, YESYES cubre el retorno.',
          'Si tu dirección no tiene cobertura de CJ, te reembolsamos el 100% antes de despachar.',
        ],
      },
    ],
  },
  terminos: {
    title: 'Términos y Condiciones',
    subtitle: 'Las reglas de la casa, claras y sin letra chica',
    icon: FileText,
    sections: [
      {
        title: 'Servicio',
        items: [
          'YESYES vende productos importados vía CJdropshipping dentro de Chile.',
          'Al comprar aceptas los tiempos de entrega de 15 a 25 días hábiles.',
          'Al comprar aceptas la política de devolución de 10 días corridos y garantía de 10 días.',
        ],
      },
      {
        title: 'Contacto oficial único',
        items: [
          `El único canal oficial de atención es ${CONTACT_EMAIL}.`,
          'No atendemos por teléfono ni por redes sociales.',
        ],
      },
      {
        title: 'Precios y pagos',
        items: [
          'Los precios están en pesos chilenos (CLP) e incluyen lo mostrado en pantalla al momento de la compra.',
          'Los pagos se procesan de forma 100% segura a través de MercadoPago.',
          'Tu pedido se procesa cuando el pago está confirmado.',
        ],
      },
    ],
  },
  privacidad: {
    title: 'Política de Privacidad',
    subtitle: 'Qué datos pedimos, para qué y cómo los protegemos',
    icon: ShieldCheck,
    sections: [
      {
        title: 'Datos que recolectamos',
        items: [
          'Nombre, email y dirección de envío, únicamente para procesar tu pedido.',
          'Datos de pago NO pasan por YESYES: los maneja MercadoPago de forma cifrada.',
        ],
      },
      {
        title: 'Uso de la información',
        items: [
          'Usamos tus datos para despachar tu pedido y enviarte el número de seguimiento.',
          `Para cualquier gestión, escribenos a ${CONTACT_EMAIL}.`,
          'Nunca vendemos ni compartimos tus datos con terceros con fines comerciales.',
        ],
      },
      {
        title: 'Tus derechos',
        items: [
          'Puedes solicitar la eliminación de tu cuenta y datos escribiendo a nuestro correo oficial.',
          'Al comprar, autorizas el uso de tus datos para completar la entrega del pedido.',
        ],
      },
    ],
  },
  cookies: {
    title: 'Política de Cookies',
    subtitle: 'Cómo usamos cookies para mejorar tu experiencia',
    icon: Cookie,
    sections: [
      {
        title: 'Qué cookies usamos',
        items: [
          'Esenciales: mantienen tu sesión y tu carrito funcionando. Sin ellas la tienda no funciona.',
          'De sesión: se borran al cerrar el navegador.',
        ],
      },
      {
        title: 'Control',
        items: [
          'Puedes borrar o bloquear cookies desde la configuración de tu navegador.',
          'Si bloqueas las esenciales, el carrito y el login pueden dejar de funcionar.',
        ],
      },
    ],
  },
};

const relatedLinks: Array<{ to: string; label: string }> = [
  { to: '/envios', label: 'Envíos' },
  { to: '/devoluciones', label: 'Devoluciones y Garantía' },
  { to: '/reembolsos', label: 'Reembolsos' },
  { to: '/terminos', label: 'Términos y Condiciones' },
  { to: '/privacidad', label: 'Privacidad' },
  { to: '/cookies', label: 'Cookies' },
];

export default function Legal({ kind }: { kind: string }) {
  const doc = docs[kind] ?? docs.envios;
  const Icon = doc.icon;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-50 text-primary-600 mb-4"
          >
            <Icon className="w-7 h-7" />
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-900">{doc.title}</h1>
          <p className="mt-2 text-gray-600">{doc.subtitle}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        {doc.sections.map((section, i) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{section.title}</h2>
            <ul className="space-y-2">
              {section.items.map((item, j) => (
                <li key={j} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}

        {doc.highlight && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900 font-medium">{doc.highlight}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">¿Tienes preguntas?</h2>
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Mail className="w-4 h-4" />
              {CONTACT_EMAIL}
            </a>
            <span className="inline-flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400" />
              Santiago, Chile
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-center pt-2">
          {relatedLinks
            .filter((l) => l.to !== `/${kind}`)
            .map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="px-4 py-2 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-sm text-gray-700 rounded-full transition-colors"
              >
                {l.label}
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
