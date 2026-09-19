import { Link } from 'react-router-dom';
import { Mail, MapPin, Send, Facebook, Instagram, Twitter } from 'lucide-react';
import { useState } from 'react';

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
    <footer className="bg-neutral-900 text-neutral-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="text-2xl font-black text-white tracking-tight">
              YES<span className="text-primary-600">YES</span>
            </Link>
            <p className="text-sm text-neutral-400">
              Tu marketplace de confianza. Productos novedosos con envíos a todo Chile.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <a href="#" className="text-neutral-400 hover:text-white transition-colors"><Instagram className="w-5 h-5" /></a>
              <a href="#" className="text-neutral-400 hover:text-white transition-colors"><Facebook className="w-5 h-5" /></a>
              <a href="#" className="text-neutral-400 hover:text-white transition-colors"><Twitter className="w-5 h-5" /></a>
            </div>
          </div>

          {/* Shop */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Tienda</h3>
            <ul className="space-y-2">
              <li><Link to="/productos" className="text-sm hover:text-white transition-colors">Todos los productos</Link></li>
              <li><Link to="/ofertas" className="text-sm hover:text-white transition-colors">Ofertas</Link></li>
              <li><Link to="/favoritos" className="text-sm hover:text-white transition-colors">Favoritos</Link></li>
            </ul>
          </div>

          {/* Help */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Ayuda</h3>
            <ul className="space-y-2">
              <li><Link to="/envios" className="text-sm hover:text-white transition-colors">Envíos</Link></li>
              <li><Link to="/devoluciones" className="text-sm hover:text-white transition-colors">Devoluciones</Link></li>
              <li><Link to="/faq" className="text-sm hover:text-white transition-colors">Preguntas frecuentes</Link></li>
              <li><Link to="/contacto" className="text-sm hover:text-white transition-colors">Contacto</Link></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Newsletter</h3>
            {subscribed ? (
              <div className="bg-primary-900/30 border border-primary-700 text-primary-300 px-4 py-3 rounded-lg text-sm">
                ¡Gracias por suscribirte!
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    className="w-full pl-10 pr-4 py-2 text-sm text-neutral-100 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white font-semibold text-sm rounded-lg transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Suscribirte
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="border-t border-neutral-800 mt-8 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <MapPin className="w-4 h-4" />
            <span>Santiago, Chile</span>
            <span>·</span>
            <a href="mailto:yesyeswebsms@gmail.com" className="hover:text-neutral-300 transition-colors">yesyeswebsms@gmail.com</a>
          </div>
          <p className="text-xs text-neutral-600">
            © {new Date().getFullYear()} YESYES. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
