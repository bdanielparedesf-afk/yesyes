import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function RecuperarPassword() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setEnviado(true);
        toast.success('Si el email existe, recibirás un enlace de recuperación');
      } else {
        toast.error('Error al solicitar recuperación');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 space-y-6">
          <div className="text-center">
            <Link to="/" className="text-3xl font-bold text-primary-500">YES<span className="text-primary-600">YES</span></Link>
            <h2 className="mt-4 text-2xl font-bold text-gray-900">Recuperar contraseña</h2>
            <p className="text-gray-500 text-sm mt-1">Te enviaremos un enlace para restablecer tu contraseña</p>
          </div>

          {enviado ? (
            <div className="text-center space-y-4">
              <p className="text-gray-600">Si el email está registrado, recibirás un enlace en tu bandeja de entrada.</p>
              <Link to="/login" className="block w-full py-3 bg-primary-500 text-white font-bold rounded-xl text-center hover:bg-primary-600 transition-colors">
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="tu@email.com"
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-all disabled:opacity-50">
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
