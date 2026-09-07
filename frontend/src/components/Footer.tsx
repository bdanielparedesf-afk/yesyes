import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone, Send } from 'lucide-react';
import { useState } from 'react';

const quickLinks = [
  { name: 'Productos', href: '/productos' },
  { name: 'Contacto', href: '/contacto' },
  { name: 'FAQ', href: '/faq' },
  { name: 'Términos', href: '/terminos' },
  { name: 'Privacidad', href: '/privacidad' },
];

const helpLinks = [
  { name: 'Envíos', href: '/envios' },
  { name: 'Devoluciones', href: '/devoluciones' },
  { name: 'Reembolsos', href: '/reembolsos' },
  { name: 'Cookies', href: '/cookies' },
];

export default function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div className="space-y-4">
            <Link to="/" className="text-2xl font-bold text-white tracking-tight">
              YES<span className="text-primary-500">YES</span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed">
              Tu tienda online favorita con los mejores productos al mejor precio. Envíos a todo Chile y pagos seguros.
            </p>
            <div className="space-y-2">
              <div className="flex items-center space-x-3 text-sm">
                <Mail className="w-4 h-4 text-primary-500" />
                <span>hola@yesyes.cl</span>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <Phone className="w-4 h-4 text-primary-500" />
                <span>+56 9 1234 5678</span>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <MapPin className="w-4 h-4 text-primary-500" />
                <span>Santiago, Chile</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-white font-semibold text-lg mb-6">Enlaces Rápidos</h3>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <Link to={link.href} className="text-gray-400 hover:text-primary-500 transition-colors text-sm">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold text-lg mb-6">Ayuda</h3>
            <ul className="space-y-3">
              {helpLinks.map((link) => (
                <li key={link.name}>
                  <Link to={link.href} className="text-gray-400 hover:text-primary-500 transition-colors text-sm">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold text-lg mb-6">Newsletter</h3>
            <p className="text-gray-400 text-sm mb-4">
              Suscríbete y recibe ofertas exclusivas directamente en tu correo.
            </p>
            {subscribed ? (
              <div className="bg-primary-500/10 border border-primary-500/30 text-primary-400 px-4 py-3 rounded-xl text-sm">
                ¡Gracias por suscribirte!
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  />
                </div>
                <button type="submit" className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-all">
                  <Send className="w-4 h-4" />
                  <span>Suscribirse</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-500 text-sm">
            © 2025 YESYES. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
