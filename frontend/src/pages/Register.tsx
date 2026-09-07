import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/store/useAuthStore';
import { signIn } from '@/services/auth';

const ADMIN_EMAIL = 'bdanielparedesf@gmail.com';

function isAdminEmail(email?: string): boolean {
  return email?.toLowerCase() === ADMIN_EMAIL;
}

export default function Register() {
  const navigate = useNavigate();
  const { register, status, user, checkSession } = useAuthStore();
  const [form, setForm] = useState({ name: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (status === 'authenticated') {
      if (isAdminEmail(user?.email)) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [status, navigate, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    if (form.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      await register({
        name: form.name,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      toast.success('Cuenta creada correctamente');
      if (isAdminEmail(form.email)) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al crear la cuenta');
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
            <h2 className="mt-4 text-2xl font-bold text-gray-900">Crea tu cuenta</h2>
            <p className="text-gray-500 text-sm mt-1">Únete a YESYES y empieza a comprar</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Tu nombre"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Tu apellido"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="tu@email.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  required
                  className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-all disabled:opacity-50">
              {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">o</span>
            </div>
          </div>

          <button
            onClick={() => signIn('google', '/')}
            className="w-full flex items-center justify-center space-x-3 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21.808 10.23H21.75V10.22H12V14.21H17.4556C16.7268 16.2345 14.8918 17.77 12.6667 17.77C9.1803 17.77 6.3513 14.935 6.3513 11.449C6.3513 7.962 9.1803 5.129 12.6667 5.129C14.2845 5.129 15.7519 5.7961 16.7967 6.8596L19.4541 4.2022C17.9347 2.7685 15.9449 2.051 13.8333 2C9.2793 2 5.5019 5.778 5.5019 10.331C5.5019 14.885 9.2793 18.663 13.8333 18.663C16.1873 18.663 18.3499 17.8366 19.9771 16.473C21.4378 15.2715 22.3333 13.5245 22.3333 11.556C22.3333 11.0286 22.2028 10.5316 21.808 10.23Z" fill="#FFC107" stroke="#F57C00" strokeWidth="0.5" />
              <path d="M3.5999 7.5L6.6399 10.538C7.4259 9.927 8.4259 9.47 9.5199 9.47C10.4591 9.47 11.3191 9.854 11.9791 10.533L13.8333 12.449C14.1333 12.764 14.1333 13.265 13.8333 13.581L12.0488 15.332C11.4857 15.884 10.6667 16.147 9.7778 16.147C7.9259 16.147 6.3999 15.083 5.7328 13.542L3.5999 7.5Z" fill="#4285F4" stroke="#1E88E5" strokeWidth="0.5" />
              <path d="M21.808 10.23H21.75V10.22H12V14.21H17.4556C17.198 14.9193 16.7195 15.5271 16.1025 16.0075L18.0668 17.9718C19.3677 16.9322 20.2612 15.4695 20.6667 13.8333C21.0667 12.2666 20.9259 10.5833 20.2669 9.0271C19.9444 8.2737 19.4176 7.5765 18.7482 7.0026L21.0765 5.4973C22.2043 6.5908 22.9634 8.0404 23.1349 9.5908C23.2305 10.3789 23.2263 11.1753 23.1286 11.9649C22.9927 13.0278 22.5556 14.0044 21.8762 14.8309C21.3328 15.5127 20.6249 16.0895 19.8179 16.4922L21.808 10.23Z" fill="#34A853" stroke="#2E7D32" strokeWidth="0.5" />
              <path d="M4.2422 1.7578L9.5999 7.1304C9.5999 7.1304 10.4 8.0833 10.4 9.47C10.4 10.857 9.6 11.764 9.6 11.764C9.6 11.764 8.4 13.083 7.0488 13.083C5.6967 13.083 4.8 12.165 4.8 10.813C4.8 9.461 5.6034 8.5436 6.4 7.8333C6.4 7.8333 7.2 6.9158 7.6 6.3887C8.0 5.8617 8.2 5.2658 8.2 4.6699C8.2 4.0735 7.6 3.4781 7.2 3.125C6.8 2.772 6.3 2.5 5.8 2.333C5.2 2.333 4.8 2.166 4.4 2.166C4 2.166 3.7 2.083 3.5999 2.0001C5.2954 2.1666 9.4844 2.8333 9.6667 11.449C9.4197 12.375 8.4744 13.0271 7.5256 12.5833C6.8981 12.2715 6.4807 11.4159 6.3699 10.5187C6.2525 9.5653 6.1286 8.6266 6.2176 7.686C6.2878 6.9923 6.1359 6.3628 6.1359 5.6691C6.1359 4.9741 6.1359 4.2805 6.2069 3.6143C6.2778 2.9477 6.0204 2.4469 5.8039 1.7578" fill="#EA4335" stroke="#D32F2F" strokeWidth="0.1" />
              <path d="M2.8333 2.8333C2.8333 2.8333 2.8333 2.8333 2.8333 2.8333C4.4266 4.4266 5.7468 6.106 6.125 7.8655C6.5029 9.6255 7.3987 11.2427 8.7477 12.5917C7.4259 13.9193 5.6056 14.5833 3.5999 14.5833C2.8833 14.5833 2.1667 13.8667 2.1667 13.1501C2.1667 12.4335 2.8833 11.7169 3.5999 11.7169" fill="#C1272D" stroke="#B71C1C" strokeWidth="0.5" />
            </svg>
            <span className="font-medium text-gray-700">Continuar con Google</span>
          </button>

          <p className="text-center text-sm text-gray-600">
            ¿Ya tienes cuenta? <Link to="/login" className="text-primary-500 font-semibold hover:text-primary-600">Inicia Sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
