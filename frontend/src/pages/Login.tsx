import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'react-hot-toast';
import { signIn } from '@/services/auth';

const ADMIN_EMAIL = 'bdanielparedesf@gmail.com';

function isAdminEmail(email?: string): boolean {
  return email?.toLowerCase() === ADMIN_EMAIL;
}

export default function Login() {
  const navigate = useNavigate();
  const { login, status, checkSession, user } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Muestra los errores que llegan de vuelta del flujo de Google
  // (/login?error=...) y limpia el parámetro de la URL.
  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError) {
      toast.error(oauthError);
      searchParams.delete('error');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (status === 'authenticated') {
      if (isAdminEmail(user?.email)) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [status, navigate, user]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login({ email: form.email, password: form.password });
      toast.success('Sesión iniciada correctamente');
      if (isAdminEmail(form.email)) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (error: any) {
      const message = error.response?.data?.message;
      if (message === 'EMAIL_NOT_VERIFIED') {
        toast.error('Debes verificar tu email antes de iniciar sesión');
        navigate('/verificar-email');
      } else {
        toast.error(message || 'Error al iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#FFF8FA] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#E8A0BF] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8FA] flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-[24px] shadow-lg border border-[#FAD3E7] p-8 space-y-6">
          <div className="text-center">
            <Link to="/" className="text-3xl font-bold text-[#E8A0BF]">
              YES<span className="text-[#BA90C6]">YES</span>
            </Link>
            <h2 className="mt-4 text-2xl font-bold text-[#4A2C3A]">Inicia Sesión</h2>
            <p className="text-[#4A2C3A]/60 text-sm mt-1">Bienvenido de vuelta</p>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#4A2C3A]/80 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#4A2C3A]/40" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-[#FAD3E7] rounded-full focus:outline-none focus:ring-2 focus:ring-[#E8A0BF] focus:border-transparent"
                  placeholder="tu@email.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#4A2C3A]/80 mb-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#4A2C3A]/40" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  className="w-full pl-10 pr-10 py-3 border border-[#FAD3E7] rounded-full focus:outline-none focus:ring-2 focus:ring-[#E8A0BF] focus:border-transparent"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A2C3A]/40"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#E8A0BF] hover:bg-[#BA90C6] text-white font-bold rounded-full shadow-lg shadow-[#E8A0BF]/30 transition-all disabled:opacity-50"
            >
              {loading ? 'Cargando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#FAD3E7]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-[#4A2C3A]/60">o</span>
            </div>
          </div>

          <button
            onClick={() => {
              try {
                sessionStorage.setItem('yesyes_post_login', '1');
              } catch {
                /* sessionStorage no disponible */
              }
              signIn('google', '/');
            }}
            className="w-full flex items-center justify-center space-x-3 px-4 py-3 border border-[#FAD3E7] rounded-full hover:bg-[#FFF8FA] transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M21.808 10.23H21.75V10.22H12V14.21H17.4556C16.7268 16.2345 14.8918 17.77 12.6667 17.77C9.1803 17.77 6.3513 14.935 6.3513 11.449C6.3513 7.962 9.1803 5.129 12.6667 5.129C14.2845 5.129 15.7519 5.7961 16.7967 6.8596L19.4541 4.2022C17.9347 2.7685 15.9449 2.051 13.8333 2C9.2793 2 5.5019 5.778 5.5019 10.331C5.5019 14.885 9.2793 18.663 13.8333 18.663C16.1873 18.663 18.3499 17.8366 19.9771 16.473C21.4378 15.2715 22.3333 13.5245 22.3333 11.556C22.3333 11.0286 22.2028 10.5316 21.808 10.23Z"
                fill="#FFC107"
                stroke="#F57C00"
                strokeWidth="0.5"
              />
              <path
                d="M3.5999 7.5L6.6399 10.538C7.4259 9.927 8.4259 9.47 9.5199 9.47C10.4591 9.47 11.3191 9.854 11.9791 10.533L13.8333 12.449C14.1333 12.764 14.1333 13.265 13.8333 13.581L12.0488 15.332C11.4857 15.884 10.6667 16.147 9.7778 16.147C7.9259 16.147 6.3999 15.083 5.7328 13.542L3.5999 7.5Z"
                fill="#4285F4"
                stroke="#1E88E5"
                strokeWidth="0.5"
              />
              <path
                d="M21.808 10.23H21.75V10.22H12V14.21H17.4556C17.198 14.9193 16.7195 15.5271 16.1025 16.0075L18.0668 17.9718C19.3677 16.9322 20.2612 15.4695 20.6667 13.8333C21.0667 12.2666 20.9259 10.5833 20.2669 9.0271C19.9444 8.2737 19.4176 7.5765 18.7482 7.0026L21.0765 5.4973C22.2043 6.5908 22.9634 8.0404 23.1349 9.5908C23.2305 10.3789 23.2263 11.1753 23.1286 11.9649C22.9927 13.0278 22.5556 14.0044 21.8762 14.8309C21.3328 15.5127 20.6249 16.0895 19.8179 16.4922L21.808 10.23Z"
                fill="#34A853"
                stroke="#2E7D32"
                strokeWidth="0.5"
              />
              <path
                d="M4.2422 1.7578L9.5999 7.1304C9.5999 7.1304 10.4 8.0833 10.4 9.47C10.4 10.857 9.6 11.764 9.6 11.764C9.6 11.764 8.4 13.083 7.0488 13.083C5.6967 13.083 4.8 12.165 4.8 10.813C4.8 9.461 5.6034 8.5436 6.4 7.8333C6.4 7.8333 7.2 6.9158 7.6 6.3887C8.0 5.8617 8.2 5.2658 8.2 4.6699C8.2 4.0735 7.6 3.4781 7.2 3.125C6.8 2.772 6.3 2.5 5.8 2.333C5.2 2.333 4.8 2.166 4.4 2.166C4 2.166 3.7 2.083 3.5999 2.0001C5.2954 2.1666 9.4844 2.8333 9.6667 11.449C9.4197 12.375 8.4744 13.0271 7.5256 12.5833C6.8981 12.2715 6.4807 11.4159 6.3699 10.5187C6.2525 9.5653 6.1286 8.6266 6.2176 7.686C6.2878 6.9923 6.1359 6.3628 6.1359 5.6691C6.1359 4.9741 6.1359 4.2805 6.2069 3.6143C6.2778 2.9477 6.0204 2.4469 5.8039 1.7578"
                fill="#EA4335"
                stroke="#B71C1C"
                strokeWidth="0.1"
              />
            </svg>
            <span className="font-medium text-[#4A2C3A]/80">Continuar con Google</span>
          </button>

          <p className="text-center text-sm text-[#4A2C3A]/60">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="text-[#E8A0BF] font-semibold hover:text-[#BA90C6]">
              Regístrate
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
