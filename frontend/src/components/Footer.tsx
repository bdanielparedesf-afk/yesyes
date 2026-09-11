import { Link } from 'react-router-dom';
import { Mail, MapPin, Send } from 'lucide-react';
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
  { name: 'Garantía', href: '/garantia' },
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
    <footer className="bg-white border-t border-[#FAD3E7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div className="space-y-4">
            <Link to="/" className="text-2xl font-bold text-[#4A2C3A] tracking-tight">
              YES<span className="text-[#E8A0BF]">YES</span>
            </Link>
            <p className="text-[#4A2C3A]/60 text-sm leading-relaxed">
              Productos novedosos y de tendencia con envíos de 15 a 25 días hábiles dentro de Chile.
            </p>
            <div className="space-y-2">
              <div className="flex items-center space-x-3 text-sm">
                <Mail className="w-4 h-4 text-[#E8A0BF]" />
                <span className="text-[#4A2C3A]/70">yesyeswebsms@gmail.com</span>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <MapPin className="w-4 h-4 text-[#E8A0BF]" />
                <span className="text-[#4A2C3A]/70">Santiago, Chile</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[#4A2C3A] font-semibold text-lg mb-6">Enlaces Rápidos</h3>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <Link to={link.href} className="text-[#4A2C3A]/60 hover:text-[#E8A0BF] transition-colors text-sm">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-[#4A2C3A] font-semibold text-lg mb-6">Ayuda</h3>
            <ul className="space-y-3">
              {helpLinks.map((link) => (
                <li key={link.name}>
                  <Link to={link.href} className="text-[#4A2C3A]/60 hover:text-[#E8A0BF] transition-colors text-sm">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-[#4A2C3A] font-semibold text-lg mb-6">Newsletter</h3>
            <p className="text-[#4A2C3A]/60 text-sm mb-4">
              Suscríbete y recibe ofertas exclusivas directamente en tu correo.
            </p>
            {subscribed ? (
              <div className="bg-[#FAD3E7]/40 border border-[#E8A0BF]/30 text-[#E8A0BF] px-4 py-3 rounded-[24px] text-sm">
                ¡Gracias por suscribirte!
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#4A2C3A]/40" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-[#FFF8FA] border border-[#FAD3E7] rounded-full focus:outline-none focus:ring-2 focus:ring-[#E8A0BF] focus:border-transparent text-sm text-[#4A2C3A] placeholder-[#4A2C3A]/40"
                  />
                </div>
                <button type="submit" className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-[#E8A0BF] hover:bg-[#BA90C6] text-white font-semibold rounded-full transition-all">
                  <Send className="w-4 h-4" />
                  <span>Suscribirse</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-[#FAD3E7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-[#4A2C3A]/50 text-sm">
            © 2025 YESYES. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
