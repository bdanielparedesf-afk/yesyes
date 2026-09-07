import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import api from '@/lib/axios';

export default function VerificarEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verificando tu email...');

  useEffect(() => {
    const token = searchParams.get('token');
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    // Si viene de redirección del backend
    if (success === 'true') {
      setStatus('success');
      setMessage('¡Tu email ha sido verificado correctamente!');
      return;
    }

    if (error) {
      setStatus('error');
      setMessage(decodeURIComponent(error));
      return;
    }

    // Si viene con token en la URL, verificar directamente
    if (token) {
      verificarToken(token);
    } else {
      setStatus('error');
      setMessage('Enlace de verificación inválido');
    }
  }, [searchParams]);

  const verificarToken = async (token: string) => {
    try {
      await api.get(`/auth/verify-email?token=${token}`);
      setStatus('success');
      setMessage('¡Tu email ha sido verificado correctamente!');
    } catch (error: any) {
      setStatus('error');
      setMessage(error.response?.data?.message || 'Error al verificar el email');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 space-y-6">
          <div className="text-center">
            <Link to="/" className="text-3xl font-bold text-primary-500">
              YES<span className="text-primary-600">YES</span>
            </Link>
            <h2 className="mt-4 text-2xl font-bold text-gray-900">Verificación de Email</h2>
          </div>

          <div className="flex flex-col items-center space-y-4">
            {status === 'loading' && (
              <>
                <Loader2 className="w-16 h-16 text-primary-500 animate-spin" />
                <p className="text-gray-600 text-center">{message}</p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle className="w-16 h-16 text-green-500" />
                <p className="text-green-600 text-center font-medium">{message}</p>
                <Link
                  to="/login"
                  className="w-full flex items-center justify-center px-4 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors font-medium"
                >
                  Iniciar Sesión
                </Link>
              </>
            )}

            {status === 'error' && (
              <>
                <XCircle className="w-16 h-16 text-red-500" />
                <p className="text-red-600 text-center">{message}</p>
                <div className="w-full space-y-3">
                  <Link
                    to="/login"
                    className="w-full flex items-center justify-center px-4 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors font-medium"
                  >
                    Ir al Login
                  </Link>
                  <Link
                    to="/register"
                    className="w-full flex items-center justify-center px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium text-gray-700"
                  >
                    Crear Cuenta Nueva
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}